// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { STUDIO_SONGS } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';
import { getDefaultMotionCaptureProvider, ConfigurationError } from '../services/motionProviders';
import { saveProductionDanceAssetToServer } from '../services/group/ProductionDanceAssetApi';
import { listAvatarAssets, uploadAvatarAssetFile } from '../services/group/AvatarAssetService';
import type {
  ProductionDanceAsset,
  ProductionMemberMotion,
  AvatarAssetRecord,
} from '../types/productionDanceAsset';
import { PRODUCTION_ERRORS } from '../types/productionDanceAsset';

export type ProductionStudioPhase =
  | 'setup'
  | 'config_check'
  | 'upload'
  | 'job_created'
  | 'processing'
  | 'motion_received'
  | 'track_mapping'
  | 'avatar_binding'
  | 'formation_build'
  | 'preview'
  | 'saving'
  | 'complete'
  | 'error';

const STAGE_PRESETS = ['stage-default', 'stage-dark', 'stage-concert', 'stage-neon'];

function defaultFormationTrack(groupId: string, memberId: string, durationSec: number) {
  const anchor = GROUP_DATA[groupId]?.members?.find((m) => m.id === memberId)?.formationAnchor
    || { x: 0, y: 0, z: 0 };
  return [
    { timestamp: 0, position: anchor },
    { timestamp: durationSec, position: anchor },
  ];
}

export function useProductionDanceStudio() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<ProductionStudioPhase>('setup');
  const [groupId, setGroupId] = useState('blackpink');
  const [songId, setSongId] = useState('how-you-like-that');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [jobId, setJobId] = useState('');
  const [jobProgress, setJobProgress] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const [error, setError] = useState('');
  const [outputs, setOutputs] = useState([]);
  const [trackMapping, setTrackMapping] = useState<Record<string, string>>({});
  const [avatarAssetIds, setAvatarAssetIds] = useState<Record<string, string>>({});
  const [avatarLibrary, setAvatarLibrary] = useState<AvatarAssetRecord[]>([]);
  const [stageBackgroundId, setStageBackgroundId] = useState('stage-default');
  const [draftAsset, setDraftAsset] = useState<ProductionDanceAsset | null>(null);

  useEffect(() => {
    getDefaultMotionCaptureProvider().then((p) => p.isConfigured()).then(setApiConfigured);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const songsForGroup = STUDIO_SONGS.filter((s) => s.groupId === groupId);
  const groupMembers = GROUP_DATA[groupId]?.members || [];

  const refreshAvatarLibrary = useCallback(async () => {
    try {
      const assets = await listAvatarAssets(groupId);
      setAvatarLibrary(assets);
    } catch {
      setAvatarLibrary([]);
    }
  }, [groupId]);

  useEffect(() => {
    refreshAvatarLibrary();
  }, [refreshAvatarLibrary]);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('setup');
    setJobId('');
    setJobProgress(0);
    setStepMessage('');
    setError('');
    setOutputs([]);
    setTrackMapping({});
    setAvatarAssetIds({});
    setDraftAsset(null);
    setVideoFile(null);
  }, []);

  const checkConfig = useCallback(async () => {
    setPhase('config_check');
    setStepMessage('DeepMotion API 설정 확인 중...');
    setError('');
    try {
      const provider = await getDefaultMotionCaptureProvider();
      const ok = await provider.isConfigured();
      setApiConfigured(ok);
      if (!ok) {
        throw new ConfigurationError(PRODUCTION_ERRORS.DEEPMOTION_API_KEY_MISSING);
      }
      setPhase('upload');
      setStepMessage('API 설정 확인 완료. 영상을 업로드하세요.');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }, []);

  const startProduction = useCallback(async () => {
    if (!videoFile) {
      setError('안무 영상을 선택해 주세요.');
      return;
    }
    setError('');
    setPhase('job_created');
    setStepMessage('DeepMotion Job 생성 중...');

    try {
      const provider = await getDefaultMotionCaptureProvider();
      const job = await provider.createJob({ groupId, songId, videoFile });
      setJobId(job.jobId);
      setPhase('processing');
      setStepMessage(`Job ${job.jobId} — Processing...`);

      pollRef.current = setInterval(async () => {
        try {
          const status = await provider.getJobStatus(job.jobId);
          setJobProgress(status.progress ?? 0);
          setStepMessage(status.message || `Processing (${status.status})...`);
          if (status.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setPhase('motion_received');
            setStepMessage('Motion 수신 중...');
            const outs = await provider.getOutputs(job.jobId);
            if (!outs.length) {
              throw new Error(`${PRODUCTION_ERRORS.MOTION_OUTPUT_INVALID}: output 없음`);
            }
            setOutputs(outs);
            const initialMap: Record<string, string> = {};
            outs.forEach((o) => {
              initialMap[o.trackId] = '';
            });
            setTrackMapping(initialMap);
            setPhase('track_mapping');
            setStepMessage('Track → Member 매핑을 확인하세요.');
          } else if (status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(status.error || PRODUCTION_ERRORS.DEEPMOTION_JOB_FAILED);
            setPhase('error');
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setError((err as Error).message);
          setPhase('error');
        }
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }, [videoFile, groupId, songId]);

  const confirmTrackMapping = useCallback(() => {
    const mapped = Object.values(trackMapping).filter(Boolean);
    const unique = new Set(mapped);
    if (mapped.length !== outputs.length || unique.size !== mapped.length) {
      setError(`${PRODUCTION_ERRORS.MEMBER_TRACK_MAPPING_REQUIRED}: 모든 Track에 고유 Member를 매핑하세요.`);
      return;
    }
    setError('');
    setPhase('avatar_binding');
    setStepMessage('각 멤버 Avatar Asset을 선택하거나 업로드하세요.');
  }, [trackMapping, outputs.length]);

  const uploadMemberAvatar = useCallback(async (memberId: string, file: File) => {
    const gm = groupMembers.find((m) => m.id === memberId);
    const asset = await uploadAvatarAssetFile({
      groupId,
      memberId,
      memberName: gm?.nameKr,
      file,
    });
    setAvatarAssetIds((prev) => ({ ...prev, [memberId]: asset.id }));
    await refreshAvatarLibrary();
    return asset;
  }, [groupId, groupMembers, refreshAvatarLibrary]);

  const buildDraftAsset = useCallback((): ProductionDanceAsset => {
    const song = songsForGroup.find((s) => s.id === songId);
    const durationSec = song?.duration || 180;
    const members: ProductionMemberMotion[] = Object.entries(trackMapping)
      .filter(([, memberId]) => memberId)
      .map(([trackId, memberId]) => {
        const gm = groupMembers.find((m) => m.id === memberId);
        const out = outputs.find((o) => o.trackId === trackId);
        const avatarAssetId = avatarAssetIds[memberId] || '';
        const libAsset = avatarLibrary.find((a) => a.id === avatarAssetId);
        const avatarAssetUrl = libAsset?.url || '';
        const hasMotion = Boolean(out?.motionUrl);
        const hasAvatar = Boolean(avatarAssetId && avatarAssetUrl);
        return {
          memberId,
          memberName: gm?.nameKr || memberId,
          motionAssetUrl: out?.motionUrl || '',
          motionFormat: (out?.format as ProductionMemberMotion['motionFormat']) || 'fbx',
          avatarAssetUrl,
          avatarAssetId: avatarAssetId || undefined,
          formationTrack: defaultFormationTrack(groupId, memberId, durationSec),
          motionDurationSec: durationSec,
          status: hasMotion && hasAvatar ? 'ready' : 'failed',
        };
      });

    const allReady = members.length > 0 && members.every((m) => m.status === 'ready');

    return {
      id: `${groupId}/${songId}`,
      groupId,
      songId,
      title: song?.title || songId,
      version: 1,
      durationSec,
      fps: 30,
      members,
      stage: {
        backgroundId: stageBackgroundId,
        cameraPreset: 'group-practice',
        stagePreset: GROUP_DATA[groupId]?.defaultFormation || 'diamond',
      },
      status: allReady ? 'ready' : 'draft',
      provider: 'deepmotion',
      providerJobId: jobId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    trackMapping, avatarAssetIds, avatarLibrary, outputs, groupMembers,
    groupId, songId, songsForGroup, stageBackgroundId, jobId,
  ]);

  const goPreview = useCallback(() => {
    const asset = buildDraftAsset();
    const missingAvatar = asset.members.some((m) => !m.avatarAssetId || !m.avatarAssetUrl);
    if (missingAvatar) {
      setError(`${PRODUCTION_ERRORS.AVATAR_ASSET_MISSING}: 모든 멤버 Avatar Asset 필요`);
      return;
    }
    const missingMotion = asset.members.some((m) => !m.motionAssetUrl);
    if (missingMotion) {
      setError(`${PRODUCTION_ERRORS.MOTION_OUTPUT_INVALID}: 모든 멤버 Motion Output 필요`);
      return;
    }
    setDraftAsset(asset);
    setPhase('preview');
    setStepMessage('Preview — 저장 전 확인');
  }, [buildDraftAsset]);

  const saveAsset = useCallback(async () => {
    const asset = draftAsset || buildDraftAsset();
    if (asset.status !== 'ready') {
      setError('모든 검증을 통과해야 ready 상태로 저장할 수 있습니다.');
      return;
    }
    setPhase('saving');
    setStepMessage('Production Asset 서버 저장 중...');
    try {
      const saved = await saveProductionDanceAssetToServer(asset, 'ready');
      setDraftAsset(saved);
      setPhase('complete');
      setStepMessage(`저장 완료 — ${saved.id} (Firestore)`);
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }, [draftAsset, buildDraftAsset]);

  return {
    phase,
    groupId,
    setGroupId,
    songId,
    setSongId,
    videoFile,
    setVideoFile,
    apiConfigured,
    jobId,
    jobProgress,
    stepMessage,
    error,
    outputs,
    trackMapping,
    setTrackMapping,
    avatarAssetIds,
    setAvatarAssetIds,
    avatarLibrary,
    uploadMemberAvatar,
    stageBackgroundId,
    setStageBackgroundId,
    stagePresets: STAGE_PRESETS,
    draftAsset,
    songsForGroup,
    groupMembers,
    reset,
    checkConfig,
    startProduction,
    confirmTrackMapping,
    goPreview,
    saveAsset,
  };
}

export default useProductionDanceStudio;
