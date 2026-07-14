// @ts-nocheck

export interface DebugFrameEvent {
  type: 'frame';
  frameIndex: number;
  timestamp: number;
  sourceVideoTime: number;
  emittedAtMs: number;
}

export interface DebugMediaPipeEvent {
  type: 'mediapipe';
  frameIndex: number;
  timestamp: number;
  detectedPersons: number;
  detectionConfidence: number;
  processingMs: number;
  emittedAtMs: number;
}

export interface DebugTrackingEvent {
  type: 'tracking';
  frameIndex: number;
  timestamp: number;
  trackedPersons: number;
  trackIds: number[];
  trackingMs: number;
  visibleCount: number;
  estimatedCount: number;
  emittedAtMs: number;
}

export interface DebugHungarianEvent {
  type: 'hungarian';
  frameIndex: number;
  timestamp: number;
  previousTrackId: number;
  currentDetectionId: number;
  cost: number;
  threshold: number;
  matched: boolean;
  rejected: boolean;
  reason?: string;
  emittedAtMs: number;
}

export interface DebugKalmanEvent {
  type: 'kalman';
  frameIndex: number;
  timestamp: number;
  trackId: number;
  predictedPosition: { x: number; y: number };
  actualPosition: { x: number; y: number } | null;
  distanceError: number;
  predictionConfidence: number;
  predictionAge: number;
  emittedAtMs: number;
}

export interface DebugOcclusionEvent {
  type: 'occlusion';
  frameIndex: number;
  timestamp: number;
  trackId: number;
  reason: string;
  visibility: number;
  bboxOverlap: number;
  emittedAtMs: number;
}

export interface DebugCoverageEvent {
  type: 'coverage';
  frameIndex: number;
  timestamp: number;
  coverage: number;
  peakTrack: number;
  detectedCount: number;
  trackedCount: number;
  emittedAtMs: number;
}

export interface DebugWorkerEvent {
  type: 'worker';
  frameIndex: number;
  timestamp: number;
  workerQueue: number;
  droppedFrames: number;
  overflow: boolean;
  workerMs: number;
  emittedAtMs: number;
}

export interface DebugPerformanceEvent {
  type: 'performance';
  frameIndex: number;
  timestamp: number;
  mediaPipeMs: number;
  trackingMs: number;
  hungarianMs: number;
  kalmanMs: number;
  workerMs: number;
  totalMs: number;
  rvfcFps: number;
  queueLength: number;
  emittedAtMs: number;
}

export interface DebugRcaEvent {
  type: 'rca';
  frameIndex: number;
  timestamp: number;
  problem: string;
  reason: string;
  evidence: string[];
  suggestedCause: string;
  severity: 'info' | 'warning' | 'critical';
  coverage?: number;
  emittedAtMs: number;
}

export type DebugBusEvent =
  | DebugFrameEvent
  | DebugMediaPipeEvent
  | DebugTrackingEvent
  | DebugHungarianEvent
  | DebugKalmanEvent
  | DebugOcclusionEvent
  | DebugCoverageEvent
  | DebugWorkerEvent
  | DebugPerformanceEvent
  | DebugRcaEvent;

export type DebugBusEventType = DebugBusEvent['type'];

export interface FrameDebugSnapshot {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime: number;
  frame?: DebugFrameEvent;
  mediapipe?: DebugMediaPipeEvent;
  tracking?: DebugTrackingEvent;
  hungarian: DebugHungarianEvent[];
  kalman: DebugKalmanEvent[];
  occlusions: DebugOcclusionEvent[];
  coverage?: DebugCoverageEvent;
  worker?: DebugWorkerEvent;
  performance?: DebugPerformanceEvent;
  rca: DebugRcaEvent[];
}

export interface LiveDebugState {
  enabled: boolean;
  isLive: boolean;
  currentFrameIndex: number;
  currentTimestamp: number;
  coverage: number;
  detectedCount: number;
  trackedCount: number;
  peakTrack: number;
  workerQueue: number;
  droppedFrames: number;
  queueLength: number;
  rvfcFps: number;
  mediaPipeFps: number;
  trackingFps: number;
  totalProcessingMs: number;
  frameSnapshot: FrameDebugSnapshot | null;
  rcaLog: DebugRcaEvent[];
  performanceRing: DebugPerformanceEvent[];
  coverageRing: DebugCoverageEvent[];
  confidenceByTrack: Map<number, Array<{ frameIndex: number; confidence: number; isDrop: boolean }>>;
}

export const COVERAGE_RCA_THRESHOLD = 0.85;
export const PERFORMANCE_RING_SIZE = 120;
export const PERFORMANCE_THRESHOLD_MS = 40;
