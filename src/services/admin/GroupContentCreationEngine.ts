// @ts-nocheck
/**
 * Admin Group Content Creation Engine
 * Video → MoCap Provider → Member 분리 → Validation → DanceDatabase / GroupMotionContent
 *
 * Group Mode 런타임과 완전 분리. setGroupModeActive 호출 없음.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import { buildDanceDatabase } from '../dance/DanceDatabaseService';
import { adaptDanceDatabaseToGroupMotionContent } from '../group/GroupMotionContentAdapter';
import { getMoCapProvider } from './mocap/MoCapProviderRegistry';
import type {
  GroupContentCreationJob,
  GroupContentCreationResult,
  MoCapProviderId,
} from '../../types/groupContentAdmin';
import { validateGroupMotionContent } from './GroupContentValidator';
import type { AnalysisResult } from '../videoAnalysisTypes';

export type CreateGroupContentOptions = {
  job: GroupContentCreationJob;
  trackToMember: Map<number, string> | Record<number, string>;
  video?: HTMLVideoElement;
  onStatus?: (msg: string) => void;
  onProgress?: (pct: number) => void;
  abortRef?: { current: boolean };
  /** 멤버 매핑 확정 시 MoCap 재추출 생략 */
  existingAnalysisResult?: AnalysisResult;
  existingProviderId?: MoCapProviderId;
  existingProviderLabel?: string;
};

async function buildFromAnalysis(
  job: GroupContentCreationJob,
  analysisResult: AnalysisResult,
  trackToMember: Map<number, string> | Record<number, string>,
  providerId: MoCapProviderId,
  providerLabel: string,
  onStatus?: (msg: string) => void,
  onProgress?: (pct: number) => void,
): Promise<GroupContentCreationResult> {
  const group = GROUP_DATA[job.groupId];
  onStatus?.('Member ID 기반 DanceDatabase 빌드...');
  onProgress?.(75);

  const referenceMemberId = job.referenceMemberId || group.members[0]?.id;
  const danceDatabase = await buildDanceDatabase({
    groupId: job.groupId,
    songId: job.songId,
    userMemberId: referenceMemberId,
    analysisResult,
    trackToMember,
    videoId: job.videoId,
    sampleFps: analysisResult.sampleFps,
  });

  const groupMotionContent = adaptDanceDatabaseToGroupMotionContent(danceDatabase, 'indexeddb');
  const validation = validateGroupMotionContent(groupMotionContent);
  if (!validation.valid) {
    throw new Error(`콘텐츠 검증 실패: ${validation.issues.join('; ')}`);
  }

  onProgress?.(100);
  onStatus?.('Admin 콘텐츠 제작 완료');

  return {
    analysisResult,
    danceDatabase,
    groupMotionContent,
    providerId,
    providerLabel,
    createdAt: new Date().toISOString(),
  };
}

export async function createGroupMotionContent(
  opts: CreateGroupContentOptions,
): Promise<GroupContentCreationResult> {
  const {
    job,
    trackToMember,
    video,
    onStatus,
    onProgress,
    abortRef,
    existingAnalysisResult,
    existingProviderId,
    existingProviderLabel,
  } = opts;
  const group = GROUP_DATA[job.groupId];
  const song = getSongById(job.songId);
  if (!group) throw new Error(`Unknown group: ${job.groupId}`);
  if (!song) throw new Error(`Unknown song: ${job.songId}`);

  if (existingAnalysisResult) {
    return buildFromAnalysis(
      job,
      existingAnalysisResult,
      trackToMember,
      existingProviderId || job.providerId,
      existingProviderLabel || job.providerId,
      onStatus,
      onProgress,
    );
  }

  const provider = getMoCapProvider(job.providerId);
  if (!provider) throw new Error(`Unknown MoCap provider: ${job.providerId}`);

  onStatus?.(`Provider: ${provider.label}`);
  const available = await provider.isAvailable();
  if (!available) throw new Error(`Provider not available: ${provider.label}`);

  const { analysisResult, providerId, providerLabel } = await provider.extract({
    groupId: job.groupId,
    songId: job.songId,
    videoFile: job.videoFile,
    video,
    videoId: job.videoId,
    onStatus,
    onProgress: (pct) => onProgress?.(Math.min(70, pct * 0.7)),
    abortRef,
  });

  if (abortRef?.current) throw new Error('콘텐츠 제작이 취소되었습니다.');

  return buildFromAnalysis(
    job,
    analysisResult,
    trackToMember,
    providerId,
    providerLabel,
    onStatus,
    onProgress,
  );
}

export default createGroupMotionContent;
