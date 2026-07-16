// @ts-nocheck
import type { RawPersonDebug } from './mediaPipeLandmarkUtils';

export interface MediaPipeTimingBreakdown {
  imageDecodeMs: number;
  poseDetectionMs: number;
  landmarkMs: number;
  postProcessMs: number;
  totalMs: number;
}

export interface JointStabilityRow {
  jointName: string;
  deltaPx: number;
  flicker: boolean;
  lostReason: string | null;
}

export interface PipelineRemovalEntry {
  trackOrDetectionId: string;
  stage: string;
  reason: string;
}

export interface PipelineFlowStage {
  label: string;
  count: number;
}

export interface PipelineLossReport {
  frameIndex: number;
  timestamp: number;
  flow: PipelineFlowStage[];
  removals: PipelineRemovalEntry[];
  primaryLossStage: string | null;
  summary: string;
}

export interface MediaPipeRawFrameSnapshot {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime?: number;
  rawDetectionCount: number;
  rawLandmarkCount: number;
  detectedPersons: number;
  persons: RawPersonDebug[];
  timing: MediaPipeTimingBreakdown;
  /** Tracking stage 이후 파이프라인 카운트 (publish 시 채움) */
  pipelineFlow?: PipelineFlowStage[];
  removals?: PipelineRemovalEntry[];
  lossReport?: PipelineLossReport;
  jointStability?: JointStabilityRow[];
}
