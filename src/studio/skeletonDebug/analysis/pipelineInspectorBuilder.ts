// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from '../types';
import type { PipelineStageSnapshot } from './analysisTypes';

export function buildPipelineInspector(
  frameIndex: number,
  frame: DetectionFrame | null,
  frameStat: SkeletonDebugFrameStat | null,
): PipelineStageSnapshot[] {
  const detected = frameStat?.detected ?? frame?.detectedPeople?.filter((p) => !p.isEstimated).length ?? 0;
  const tracked = frameStat?.tracked ?? frame?.detectedPeople?.length ?? 0;
  const visible = frameStat?.visible ?? detected;
  const estimated = frameStat?.estimated ?? frame?.detectedPeople?.filter((p) => p.isEstimated).length ?? 0;
  const mediaPipeMs = frameStat?.mediaPipeDelayMs ?? 0;
  const totalMs = frameStat?.processingMs ?? 0;
  const trackingMs = Math.max(0, totalMs - mediaPipeMs);
  const workerMs = frameStat?.workerQueue ? Math.min(totalMs * 0.15, 8) : 0;
  const hungarianMs = trackingMs * 0.12;
  const kalmanMs = estimated > 0 ? trackingMs * 0.18 : trackingMs * 0.05;
  const conf = frameStat?.confidence ?? 0;
  const coverage = frameStat?.coverage ?? 0;

  return [
    { stage: 'video_frame', label: 'Video Frame', timeMs: 0.5, inputCount: 1, outputCount: 1, failed: false, confidence: null, trackCount: null },
    { stage: 'mediapipe_detection', label: 'MediaPipe Detection', timeMs: mediaPipeMs, inputCount: 1, outputCount: detected, failed: detected === 0, confidence: conf, trackCount: detected },
    { stage: 'person_detection', label: 'Person Detection', timeMs: mediaPipeMs * 0.2, inputCount: detected, outputCount: detected, failed: false, confidence: conf, trackCount: detected },
    { stage: 'tracking', label: 'Tracking', timeMs: trackingMs, inputCount: detected, outputCount: tracked, failed: tracked < detected, confidence: conf, trackCount: tracked },
    { stage: 'hungarian_matching', label: 'Hungarian Matching', timeMs: hungarianMs, inputCount: tracked, outputCount: visible, failed: false, confidence: conf, trackCount: visible },
    { stage: 'kalman_prediction', label: 'Kalman Prediction', timeMs: kalmanMs, inputCount: visible, outputCount: estimated, failed: false, confidence: conf, trackCount: estimated, detail: estimated ? `Predicted: ${estimated}` : undefined },
    { stage: 'occlusion_recovery', label: 'Occlusion Recovery', timeMs: kalmanMs * 0.5, inputCount: estimated, outputCount: estimated, failed: false, confidence: conf, trackCount: estimated, detail: estimated ? `Recovered hold: ${estimated}` : undefined },
    { stage: 'member_mapping', label: 'Member Mapping', timeMs: 0.3, inputCount: tracked, outputCount: tracked, failed: false, confidence: conf, trackCount: tracked },
    { stage: 'skeleton_output', label: 'Skeleton Output', timeMs: 0.5, inputCount: tracked, outputCount: tracked, failed: tracked === 0, confidence: conf, trackCount: tracked, detail: `Members: ${tracked}` },
    { stage: 'coverage_update', label: 'Coverage Update', timeMs: 0.2, inputCount: 1, outputCount: 1, failed: coverage < 0.85, confidence: coverage, trackCount: visible, detail: `${Math.round(coverage * 100)}%` },
    { stage: 'dance_database', label: 'Dance Database', timeMs: workerMs, inputCount: tracked, outputCount: tracked, failed: (frameStat?.workerQueue ?? 0) > 30, confidence: null, trackCount: tracked, detail: frameStat?.workerQueue ? `Queue: ${frameStat.workerQueue}` : 'Studio only — not built' },
  ];
}
