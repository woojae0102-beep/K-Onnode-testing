// @ts-nocheck
import type { DetectionFrame } from '../../services/MultiPersonTracker';
import type { AnalysisResult } from '../../services/videoAnalysisTypes';
import type { MotionExtractionDebugState } from '../../types/motionExtraction';

import type { SkeletonAnalysisPackage } from './analysis/analysisTypes';

/** Overlay 토글 — Skeleton Debug Studio 전용 */
export interface SkeletonDebugOverlayOptions {
  skeleton: boolean;
  boundingBox: boolean;
  trackId: boolean;
  jointName: boolean;
  confidence: boolean;
  bone: boolean;
  centerPoint: boolean;
  velocity: boolean;
  prediction: boolean;
  kalmanPrediction: boolean;
  trackColor: boolean;
  lostTrack: boolean;
  recoveredTrack: boolean;
  /** false면 isEstimated(보간) 스켈레톤 숨김 — 겹침 완화 */
  showEstimated: boolean;
}

export const DEFAULT_OVERLAY_OPTIONS: SkeletonDebugOverlayOptions = {
  skeleton: true,
  boundingBox: false,
  trackId: true,
  jointName: false,
  confidence: false,
  bone: true,
  centerPoint: false,
  velocity: false,
  prediction: false,
  kalmanPrediction: false,
  trackColor: true,
  lostTrack: true,
  recoveredTrack: true,
  showEstimated: false,
};

/** 프레임별 통계 — 추출 중 수집 */
export interface SkeletonDebugFrameStat {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime: number;
  detected: number;
  tracked: number;
  visible: number;
  estimated: number;
  confidence: number;
  coverage: number;
  processingMs: number;
  queueLength: number;
  droppedFrames: number;
  mediaPipeDelayMs: number;
  workerQueue: number;
  poseQuality: number | null;
  trackingIds: number[];
  pipelineStage: string;
}

export type TrackLifecycleEventType = 'create' | 'lost' | 'recovered' | 'destroyed';

export interface TrackLifecycleEvent {
  type: TrackLifecycleEventType;
  frameIndex: number;
  timestamp: number;
}

export interface TrackHistoryEntry {
  trackId: number;
  color: string;
  events: TrackLifecycleEvent[];
  firstFrame: number;
  lastFrame: number;
  totalFrames: number;
  visibleFrames: number;
  estimatedFrames: number;
}

/** JSON Export 스키마 */
export interface SkeletonDebugJointExport {
  x: number;
  y: number;
  z: number;
  visibility: number;
  confidence: number;
}

export interface SkeletonDebugPersonExport {
  trackId: number;
  isEstimated: boolean;
  confidence: number;
  joints: Record<string, SkeletonDebugJointExport>;
  /** v2 analysis fields */
  velocity?: number;
  acceleration?: number;
  poseScore?: number;
  trackingScore?: number;
  hungarianCost?: number;
  matchingThreshold?: number;
  predictionError?: number;
  occlusionReason?: string | null;
}

export interface SkeletonDebugFrameExport {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime: number;
  persons: SkeletonDebugPersonExport[];
  /** v2 per-frame analysis */
  motionQuality?: number;
  coverageScore?: number;
  pipelineStageTimes?: Record<string, number>;
  failureReasons?: string[];
  hungarianMatches?: Array<{
    previousTrackId: number;
    currentDetectionIndex: number;
    cost: number;
    threshold: number;
    matched: boolean;
  }>;
}

export interface SkeletonDebugExportMeta {
  version: 1 | 2;
  exportedAt: string;
  groupId: string;
  videoWidth: number;
  videoHeight: number;
  sampleFps: number;
  sourceVideoDurationSec: number;
  sourceVideoNativeFps: number | null;
  peakTrackCount: number;
  frameCount: number;
  coverage: number;
}

export interface SkeletonDebugExportDocument {
  meta: SkeletonDebugExportMeta;
  frameStats: SkeletonDebugFrameStat[];
  trackHistory: TrackHistoryEntry[];
  frames: SkeletonDebugFrameExport[];
  /** v2 full analysis package (serializable subset) */
  analysis?: {
    extractionReport: SkeletonAnalysisPackage['extractionReport'];
    trackLifecycles: SkeletonAnalysisPackage['trackLifecycles'];
    coverageDropEvents: SkeletonAnalysisPackage['coverageDropEvents'];
    coverageTimeline: SkeletonAnalysisPackage['coverageTimeline'];
  };
}

export type SkeletonFailureCategory =
  | 'coverage_insufficient'
  | 'track_insufficient'
  | 'confidence_insufficient'
  | 'detection_insufficient'
  | 'tracking_loss'
  | 'worker_queue_overflow'
  | 'rvfc_stop'
  | 'frame_drop'
  | 'video_decode_issue'
  | 'pose_quality_insufficient'
  | 'cancelled'
  | 'unknown';

export interface SkeletonFailureAnalysis {
  categories: SkeletonFailureCategory[];
  primaryCause: SkeletonFailureCategory;
  message: string;
  details: Record<string, unknown>;
}

export type SkeletonDebugPlaybackMode = 'extraction' | 'replay';

export interface SkeletonDebugSession {
  mode: SkeletonDebugPlaybackMode;
  groupId: string;
  videoUrl: string | null;
  videoFileName: string;
  analysisResult: AnalysisResult | null;
  exportDocument: SkeletonDebugExportDocument;
  frameStats: SkeletonDebugFrameStat[];
  trackHistory: TrackHistoryEntry[];
  sampleFps: number;
  totalFrames: number;
  durationSec: number;
  failureAnalysis: SkeletonFailureAnalysis | null;
  analysisPackage: SkeletonAnalysisPackage | null;
}

export type SkeletonDebugLiveDiagnostics = Partial<MotionExtractionDebugState> & {
  rvfcScheduleCount: number;
  rvfcCallbackCount: number;
  workerBusy: boolean;
  workerIdle: boolean;
  workerRestartCount: number;
  averageProcessingTimeMs: number;
  trackingFps: number;
  mediaPipeFps: number;
  videoFps: number;
};
