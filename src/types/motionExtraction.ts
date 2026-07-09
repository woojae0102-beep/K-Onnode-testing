// @ts-nocheck
import type { DanceDatabase } from './danceDatabase';
import type { SkeletonData, SkeletonFrameData } from './groupPractice';
import type { AnalysisResult } from '../services/videoAnalysisTypes';

/** 실시간 추출 디버그 — Debug Overlay / 콘솔 출력용 */
export interface MotionExtractionDebugState {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime: number;
  /** RVFC 실측 FPS */
  measuredFps: number;
  /** 추출 샘플 FPS (30~60) */
  sampleFps: number;
  nativeFps: number | null;
  progress: number;
  pipelineStage: string;
  rawPoseCount: number;
  handCount: number;
  faceCount: number;
  trackedCount: number;
  visibleCount: number;
  estimatedCount: number;
  expectedMemberCount: number;
  missingMemberCount: number;
  trackingIds: number[];
  avgConfidence: number;
  poseQuality: number | null;
  beat: number | null;
  beatIndex: number | null;
  formation: string | null;
  interpolationHold: boolean;
  timelineDuration: number;
  timelineFrameIndex: number;
  timelineTotalFrames: number;
  /** 현재 프레임에서 유지 중인 trackId 목록 (실감지 + 보강 포함) */
  currentTrackedMembers: number[];
  /** 이번 프레임에서 lastDetectedPeople로부터 보간한 trackId 목록 */
  missingMembers: number[];
  /** Worker에 전송했으나 아직 FRAME_BUFFERED로 확인되지 않은 대기열 길이 */
  workerQueue: number;
  /** Frame Processing Lock — 이전 프레임 처리 중 새 샘플이 드롭되었는지 */
  processingFrame: boolean;
  /** 직전 프레임 처리(detect+track+worker dispatch)에 걸린 시간(ms) */
  processingDelay: number;
  /** 가려짐 초과로 소멸된 트랙 누적 수 */
  trackerResetCount: number;
  /** Track Stability 보정으로 되돌린 trackId 변경 누적 수 */
  trackIdChanges: number;
  /** 현재까지 진행된 Coverage 추정치 (0~1) */
  coverage: number;
  /** 마지막으로 처리된 원본 영상 시각(초) */
  lastTimestamp: number;
}

export interface ReferenceVideoMeta {
  blobCacheKey: string | null;
  localPlaybackUrl: string | null;
  durationSec: number;
  mimeType?: string;
  sizeBytes?: number;
}

export interface MotionExtractionResult {
  danceDatabase: DanceDatabase;
  frames: SkeletonFrameData[];
  /** 추출 스켈레톤 메타 — fps · duration · frameCount */
  skeletonData: SkeletonData;
  analysisResult: AnalysisResult;
  fromCache: boolean;
  referenceVideo: ReferenceVideoMeta;
  songId: string;
  groupId: string;
  userMemberId: string;
}

export const EMPTY_MOTION_DEBUG: MotionExtractionDebugState = {
  frameIndex: 0,
  timestamp: 0,
  sourceVideoTime: 0,
  measuredFps: 0,
  sampleFps: 30,
  nativeFps: null,
  progress: 0,
  pipelineStage: 'idle',
  rawPoseCount: 0,
  handCount: 0,
  faceCount: 0,
  trackedCount: 0,
  visibleCount: 0,
  estimatedCount: 0,
  expectedMemberCount: 0,
  missingMemberCount: 0,
  trackingIds: [],
  avgConfidence: 0,
  poseQuality: null,
  beat: null,
  beatIndex: null,
  formation: null,
  interpolationHold: false,
  timelineDuration: 0,
  timelineFrameIndex: 0,
  timelineTotalFrames: 0,
  currentTrackedMembers: [],
  missingMembers: [],
  workerQueue: 0,
  processingFrame: false,
  processingDelay: 0,
  trackerResetCount: 0,
  trackIdChanges: 0,
  coverage: 0,
  lastTimestamp: 0,
};
