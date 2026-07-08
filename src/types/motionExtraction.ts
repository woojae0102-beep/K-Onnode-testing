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
};
