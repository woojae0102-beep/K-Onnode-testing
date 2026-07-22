// @ts-nocheck
import type {
  FormationHole,
  FormationTimeline,
  MemberTrackMeta,
  PositionMap,
} from './danceDatabase';
import type { SkeletonFrameData } from './groupPractice';
import type { SkeletonValidationDebugReport } from '../utils/skeletonDataUtils';
import type { SkeletonRenderTimeline } from '../services/rendering/SkeletonTimelineBuilder';
import type { PracticeTimeline } from '../utils/practiceTimelineUtils';

export interface StageScale {
  width: number;
  height: number;
  depth: number;
}

/** 스켈레톤 좌표계 — MediaPipe 0~1 정규화 */
export type CoordinateSystem = 'normalized-0-1';

export const DEFAULT_STAGE_SCALE: StageScale = { width: 4, height: 3, depth: 2 };
export const DEFAULT_COORDINATE_SYSTEM: CoordinateSystem = 'normalized-0-1';

export interface ReferenceVideoMeta {
  videoId?: string | null;
  youtubeUrl?: string | null;
  fromCache?: boolean;
  /** IndexedDB reference video blob 키 */
  blobCacheKey?: string | null;
  /** 로컬 Blob 재생 URL (세션 내) */
  localPlaybackUrl?: string | null;
  mimeType?: string | null;
  durationSec?: number | null;
}

export interface SkeletonPipelineAudit {
  rawFrameCount: number;
  rawMemberCount: number;
  rawAiMemberCount: number;
  normalizedFrameCount: number;
  normalizedMemberCount: number;
  normalizedAiMemberCount: number;
  interpolatedMemberCount?: number;
}

export interface MotionMetadata {
  detectedMemberCount: number;
  aiMemberIds: string[];
  skeletonCoverageSec: number;
  lastFrameTimestamp: number;
  videoWidth: number;
  videoHeight: number;
  sampleFps: number;
  /** MediaPipe 추출 실제 프레임 수 (totalFrames = duration × fps 와 별개) */
  extractedFrameCount?: number;
  timeline?: PracticeTimeline;
  builtAt: string;
  pipelineAudit?: SkeletonPipelineAudit;
  validationReport?: SkeletonValidationDebugReport;
  /** 프레임 Pose Quality 요약 */
  poseQuality?: {
    avg: number;
    min: number;
    max: number;
    lowQualityFrames: number;
  };
  bpm?: number;
}

/**
 * GroupStudioSession에 필요한 전체 연습 패키지.
 * Frame 배열만 전달하지 말고 이 객체 전체를 사용한다.
 */
export interface PracticeSessionData {
  frames: SkeletonFrameData[];
  /** 추출 원본 스켈레톤 — referenceFrames[Math.floor(currentTime * sampleFps)] */
  referenceFrames: SkeletonFrameData[];
  /** 연습 타임라인 길이(초) — sourceVideoDurationSec와 동일 */
  duration: number;
  fps: number;
  /** duration × fps — 타임라인 프레임 수 */
  totalFrames: number;
  /** MediaPipe 추출 실제 프레임 수 */
  extractedFrameCount?: number;
  formationTimeline: FormationTimeline;
  memberTracks: MemberTrackMeta[];
  userMemberId: string;
  songId: string;
  groupId: string;
  stageScale: StageScale;
  coordinateSystem: CoordinateSystem;
  referenceVideo: ReferenceVideoMeta;
  motionMetadata: MotionMetadata;
  /** GroupMotionPipeline audit (연습 패키지) */
  motionPipelineAudit?: import('../services/motion/GroupMotionPipeline').MotionPipelineAudit;
  /** HTMLVideoElement.duration 기반 원본 영상 길이(초) */
  sourceVideoDurationSec: number;
  positionMap?: PositionMap;
  formationHole?: FormationHole;
  detectedMemberCount?: number;
  videoWidth?: number;
  videoHeight?: number;
  /** 60fps 렌더 타임라인 — Practice는 frames[frameIndex] 직접 접근 */
  renderTimeline?: SkeletonRenderTimeline;
  /** Pre-built Group Mode content (extraction 없음) */
  groupMotionContent?: import('./groupMotionContent').GroupMotionContent;
  groupPracticeRuntime?: import('./groupMotionContent').GroupPracticeRuntimeState;
  contentSource?: import('./groupMotionContent').GroupMotionContentSource;
  preBuiltContent?: boolean;
  productionDanceAsset?: import('./productionDanceAsset').ProductionDanceAsset;
  groupRuntimeActors?: import('./productionDanceAsset').GroupRuntimeActors;
  /** Group Mode motion asset (skeleton 없음) */
  groupMotionAsset?: import('../modes/group/types/groupMotionAsset').GroupMotionAsset;
  productionMotionAssetV2?: import('../modes/group/types/ProductionMotionAssetV2').ProductionMotionAssetV2;
  motionAssetStatus?: import('../modes/group/types/groupMotionAsset').GroupMotionAssetStatus;
  devMotionFixture?: boolean;
}
