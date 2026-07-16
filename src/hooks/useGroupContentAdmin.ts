// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { STUDIO_SONGS } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';
import { createGroupMotionContent } from '../services/admin/GroupContentCreationEngine';
import { persistGroupMotionContent } from '../services/admin/GroupContentPersistence';
import { listAvailableMoCapProviders } from '../services/admin/mocap/MoCapProviderRegistry';
import type { MoCapProvider } from '../services/admin/mocap/MoCapProvider.types';
import type {
  GroupContentAdminPhase,
  GroupContentCreationResult,
  MoCapProviderId,
} from '../types/groupContentAdmin';
import type { AnalysisResult } from '../services/videoAnalysisTypes';

export function useGroupContentAdmin() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const abortRef = useRef(false);

  const [phase, setPhase] = useState<GroupContentAdminPhase>('setup');
  const [groupId, setGroupId] = useState('blackpink');
  const [songId, setSongId] = useState('how-you-like-that');
  const [providerId, setProviderId] = useState<MoCapProviderId>('local_holistic');
  const [providers, setProviders] = useState<MoCapProvider[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [creationResult, setCreationResult] = useState<GroupContentCreationResult | null>(null);
  const [persistInfo, setPersistInfo] = useState(null);
  const [lastProviderId, setLastProviderId] = useState<MoCapProviderId | null>(null);
  const [lastProviderLabel, setLastProviderLabel] = useState('');

  useEffect(() => {
    listAvailableMoCapProviders().then(setProviders);
  }, []);

  const songsForGroup = STUDIO_SONGS.filter((s) => s.groupId === groupId);

  const startExtraction = useCallback(async () => {
    if (!videoFile) {
      setError('영상 파일을 선택해 주세요.');
      return;
    }
    abortRef.current = false;
    setError('');
    setPhase('processing');
    setProgress(0);
    setStep('MoCap 추출 시작...');
    setAnalysisResult(null);
    setCreationResult(null);
    setPersistInfo(null);

    const url = URL.createObjectURL(videoFile);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.muted = true;
    }

    try {
      const result = await createGroupMotionContent({
        job: {
          groupId,
          songId,
          videoFile,
          providerId,
          referenceMemberId: GROUP_DATA[groupId]?.members?.[0]?.id || 'member_1',
        },
        trackToMember: new Map(),
        video: videoRef.current || undefined,
        onStatus: setStep,
        onProgress: setProgress,
        abortRef,
      });

      setAnalysisResult(result.analysisResult);
      setCreationResult(result);
      setLastProviderId(result.providerId);
      setLastProviderLabel(result.providerLabel);
      setPhase('member_mapping');
      setStep('트랙 → 멤버 매핑을 확인하세요.');
    } catch (err) {
      console.error('[useGroupContentAdmin]', err);
      setError((err as Error)?.message || '제작 실패');
      setPhase('error');
    }
  }, [groupId, songId, videoFile, providerId]);

  const confirmMemberMapping = useCallback(async (trackToMember: Map<number, string>) => {
    if (!analysisResult) return;
    setPhase('validating');
    setStep('Member 매핑 적용 중...');
    setError('');

    try {
      const result = await createGroupMotionContent({
        job: {
          groupId,
          songId,
          videoFile: videoFile!,
          providerId,
          referenceMemberId: GROUP_DATA[groupId]?.members?.[0]?.id || 'member_1',
        },
        trackToMember,
        existingAnalysisResult: analysisResult,
        existingProviderId: lastProviderId || providerId,
        existingProviderLabel: lastProviderLabel,
        onStatus: setStep,
        onProgress: setProgress,
        abortRef,
      });

      setCreationResult(result);
      setPhase('persisting');
      setStep('IndexedDB + JSON 저장 중...');

      const persist = await persistGroupMotionContent(result.danceDatabase, result.groupMotionContent);
      setPersistInfo(persist);
      setPhase('complete');
      setStep(`저장 완료 — ${persist.packageKey}`);
    } catch (err) {
      console.error('[useGroupContentAdmin] persist', err);
      setError((err as Error)?.message || '저장 실패');
      setPhase('error');
    }
  }, [analysisResult, groupId, songId, videoFile, providerId, lastProviderId, lastProviderLabel]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setPhase('setup');
    setStep('취소됨');
  }, []);

  const reset = useCallback(() => {
    abortRef.current = false;
    setPhase('setup');
    setProgress(0);
    setStep('');
    setError('');
    setAnalysisResult(null);
    setCreationResult(null);
    setPersistInfo(null);
    setLastProviderId(null);
    setLastProviderLabel('');
    setVideoFile(null);
  }, []);

  return {
    videoRef,
    phase,
    groupId,
    setGroupId,
    songId,
    setSongId,
    providerId,
    setProviderId,
    providers,
    songsForGroup,
    videoFile,
    setVideoFile,
    progress,
    step,
    error,
    analysisResult,
    creationResult,
    persistInfo,
    startExtraction,
    confirmMemberMapping,
    cancel,
    reset,
  };
}

export default useGroupContentAdmin;
