// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from '../types';
import type { FrameDebugSnapshot } from '../live/debugEventTypes';
import type { MediaPipeRawFrameSnapshot } from './mediaPipeRawTypes';
import {
  attachPipelineLossToRaw,
  captureMediaPipeRawFrame,
  countSkeletonOutput,
} from './mediaPipeRawCapture';
import { CONFIDENCE_THRESHOLD, VISIBILITY_THRESHOLD } from './mediaPipeLandmarkUtils';

/** Live bus 스냅샷 또는 frameStat으로 post-hoc 분석 (알고리즘 미변경) */
export function buildMediaPipeRawAnalysisForFrame(opts: {
  frameIndex: number;
  timestamp: number;
  frame: DetectionFrame | null;
  frameStat: SkeletonDebugFrameStat | null;
  debugSnapshot: FrameDebugSnapshot | null;
  storedRaw: MediaPipeRawFrameSnapshot | null;
  prevStoredRaw: MediaPipeRawFrameSnapshot | null;
}): MediaPipeRawFrameSnapshot | null {
  const { frame, frameStat, storedRaw, prevStoredRaw } = opts;

  if (storedRaw?.pipelineFlow?.length) {
    return storedRaw;
  }

  if (storedRaw) {
    const people = frame?.detectedPeople ?? [];
    const visible = people.filter((p) => !p.isEstimated).length;
    const estimated = people.filter((p) => p.isEstimated).length;
    return attachPipelineLossToRaw(storedRaw, {
      afterTrackingVisible: visible,
      afterTrackingTotal: people.length,
      afterMappingTotal: people.length,
      skeletonOutputCount: countSkeletonOutput(people),
      estimatedCount: estimated,
    }, prevStoredRaw);
  }

  if (!frameStat && !frame) return null;

  const detected = frameStat?.detected ?? frame?.detectedPeople?.filter((p) => !p.isEstimated).length ?? 0;
  const tracked = frameStat?.tracked ?? frame?.detectedPeople?.length ?? 0;
  const estimated = frameStat?.estimated ?? frame?.detectedPeople?.filter((p) => p.isEstimated).length ?? 0;
  const rawCount = frameStat?.rawPoseCount ?? detected;
  const mediaPipeMs = frameStat?.mediaPipeDelayMs ?? opts.debugSnapshot?.mediapipe?.processingMs ?? 0;
  const totalMs = frameStat?.processingMs ?? mediaPipeMs;

  const degraded = captureMediaPipeRawFrame({
    frameIndex: opts.frameIndex,
    timestamp: opts.timestamp,
    results: { landmarks: Array.from({ length: rawCount }, () => []) },
    poseDetectionMs: mediaPipeMs * 0.85,
    landmarkProcessMs: mediaPipeMs * 0.1,
    postProcessMs: mediaPipeMs * 0.05,
    queueDelayMs: totalMs - mediaPipeMs,
  });

  degraded.persons = [];
  const people = frame?.detectedPeople ?? [];
  return attachPipelineLossToRaw(degraded, {
    afterTrackingVisible: detected,
    afterTrackingTotal: tracked,
    afterMappingTotal: tracked,
    skeletonOutputCount: countSkeletonOutput(people),
    estimatedCount: estimated,
  }, prevStoredRaw);
}

export function buildDegradedLossSummary(frameIndex: number, frameStat: SkeletonDebugFrameStat | null): string {
  if (!frameStat) return `Frame ${frameIndex}: no stats`;
  if (frameStat.detected === 0) {
    return `Frame ${frameIndex}: MediaPipe detected 0 — check raw landmarks / confidence>${CONFIDENCE_THRESHOLD} / visibility>${VISIBILITY_THRESHOLD}`;
  }
  if (frameStat.tracked > frameStat.detected) {
    return `Frame ${frameIndex}: ${frameStat.estimated} estimated fill from ${frameStat.detected} raw detections`;
  }
  return `Frame ${frameIndex}: detected=${frameStat.detected} tracked=${frameStat.tracked}`;
}
