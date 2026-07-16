// @ts-nocheck

export type PipelineStageName =
  | 'video_frame'
  | 'mediapipe_detection'
  | 'person_detection'
  | 'tracking'
  | 'hungarian_matching'
  | 'kalman_prediction'
  | 'occlusion_recovery'
  | 'member_mapping'
  | 'skeleton_output'
  | 'coverage_update'
  | 'dance_database';

export interface PipelineStageSnapshot {
  stage: PipelineStageName;
  label: string;
  timeMs: number;
  inputCount: number;
  outputCount: number;
  failed: boolean;
  confidence: number | null;
  trackCount: number | null;
  detail?: string;
}

export interface HungarianMatchRow {
  previousTrackId: number;
  currentDetectionIndex: number;
  cost: number;
  threshold: number;
  matched: boolean;
  reason?: string;
}

export interface KalmanInspectionRow {
  trackId: number;
  jointName: string;
  predictionX: number;
  predictionY: number;
  actualX: number;
  actualY: number;
  distanceError: number;
  predictionConfidence: number;
  predictionAgeFrames: number;
}

export interface PersonInspectionRow {
  trackId: number;
  memberLabel: string;
  status: 'visible' | 'occluded' | 'lost' | 'outside_screen' | 'predicted';
  visiblePercent: number;
  confidence: number;
  trackingStability: 'stable' | 'unstable' | 'switched' | 'new';
  predictionMethod: 'none' | 'kalman' | 'hold';
  avgJointVisibility: number;
  reason?: string;
}

export interface FrameRcaIssue {
  problem: string;
  reason: string;
  evidence: string[];
  suggestedCause: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface MotionQualityBreakdown {
  overall: number;
  tracking: number;
  pose: number;
  coverage: number;
  predictionRatio: number;
  jointCompleteness: number;
  poseStability: number;
}

export interface PerformanceBreakdown {
  mediaPipeMs: number;
  trackingMs: number;
  hungarianMs: number;
  kalmanMs: number;
  orientationMs: number;
  rotationMs: number;
  workerMs: number;
  totalMs: number;
  imageDecodeMs?: number;
  poseDetectionMs?: number;
  landmarkMs?: number;
  postProcessMs?: number;
}

export interface FrameAnalysisSnapshot {
  frameIndex: number;
  timestamp: number;
  pipeline: PipelineStageSnapshot[];
  hungarian: HungarianMatchRow[];
  kalman: KalmanInspectionRow[];
  persons: PersonInspectionRow[];
  rcaIssues: FrameRcaIssue[];
  motionQuality: MotionQualityBreakdown;
  performance: PerformanceBreakdown;
  mediaPipeRaw: import('../mediapipe/mediaPipeRawTypes').MediaPipeRawFrameSnapshot | null;
}

export interface EnhancedTrackLifecycle {
  trackId: number;
  color: string;
  createdFrame: number;
  createdTimestamp: number;
  destroyedFrame: number | null;
  destroyedTimestamp: number | null;
  destroyReason: string | null;
  averageConfidence: number;
  maxVelocity: number;
  occlusionCount: number;
  recoveryCount: number;
  hungarianReassignmentCount: number;
  predictionFrameCount: number;
  visibleFrames: number;
  estimatedFrames: number;
  events: Array<{
    type: 'create' | 'lost' | 'recovered' | 'destroyed' | 'reassignment';
    frameIndex: number;
    timestamp: number;
    detail?: string;
  }>;
}

export interface CoverageTimelinePoint {
  frameIndex: number;
  timestamp: number;
  coverage: number;
}

export interface CoverageDropEvent {
  fromFrame: number;
  toFrame: number;
  fromCoverage: number;
  toCoverage: number;
  dropAmount: number;
  reason: string;
  evidence: string[];
}

export interface ConfidenceTimelinePoint {
  frameIndex: number;
  timestamp: number;
  confidence: number;
  isDrop: boolean;
}

export interface PerformanceTimelinePoint {
  frameIndex: number;
  timestamp: number;
  performance: PerformanceBreakdown;
}

export interface ExtractionProblemEntry {
  frameIndex: number;
  problem: string;
  reason: string;
  severity: 'warning' | 'critical';
}

export interface ExtractionRcaReport {
  passed: boolean;
  coverage: number;
  peakTrack: number;
  averageConfidence: number;
  trackingStabilityPercent: number;
  motionQualityAverage: number;
  failureReason: string | null;
  problems: ExtractionProblemEntry[];
  rootCauseContributions: {
    detectorPct: number;
    trackingPct: number;
    hungarianPct: number;
    confidencePct: number;
    queuePct: number;
  };
}

export interface SkeletonAnalysisPackage {
  version: 2;
  builtAt: string;
  frameAnalyses: Map<number, FrameAnalysisSnapshot>;
  mediaPipeRawByFrame: Map<number, import('../mediapipe/mediaPipeRawTypes').MediaPipeRawFrameSnapshot>;
  trackLifecycles: EnhancedTrackLifecycle[];
  coverageTimeline: CoverageTimelinePoint[];
  coverageDropEvents: CoverageDropEvent[];
  confidenceByTrack: Map<number, ConfidenceTimelinePoint[]>;
  performanceTimeline: PerformanceTimelinePoint[];
  extractionReport: ExtractionRcaReport;
}
