// @ts-nocheck
import type { FrameAnalysisSnapshot, HungarianMatchRow, KalmanInspectionRow } from '../analysis/analysisTypes';
import type { FrameDebugSnapshot } from './debugEventTypes';
import { buildPipelineInspector } from '../analysis/pipelineInspectorBuilder';
import { buildHungarianInspector } from '../analysis/hungarianInspectorBuilder';
import { buildKalmanInspector } from '../analysis/kalmanInspectorBuilder';
import { analyzeFrameRca } from '../analysis/frameRcaAnalyzer';
import { computeMotionQuality, computePerformanceBreakdown } from '../analysis/motionQualityAnalyzer';
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from '../types';

export function frameAnalysisFromDebugSnapshot(
  snap: FrameDebugSnapshot,
  frameStat: SkeletonDebugFrameStat | null,
  frames: DetectionFrame[] = [],
): FrameAnalysisSnapshot {
  const hungarian: HungarianMatchRow[] = snap.hungarian.map((h) => ({
    previousTrackId: h.previousTrackId,
    currentDetectionIndex: h.currentDetectionId,
    cost: h.cost,
    threshold: h.threshold,
    matched: h.matched,
    reason: h.reason,
  }));

  const kalman: KalmanInspectionRow[] = snap.kalman.map((k) => ({
    trackId: k.trackId,
    jointName: 'center',
    predictionX: k.predictedPosition.x,
    predictionY: k.predictedPosition.y,
    actualX: k.actualPosition?.x ?? k.predictedPosition.x,
    actualY: k.actualPosition?.y ?? k.predictedPosition.y,
    distanceError: k.distanceError,
    predictionConfidence: k.predictionConfidence,
    predictionAgeFrames: k.predictionAge,
  }));

  const perf = snap.performance;
  const performance = perf
    ? {
        mediaPipeMs: perf.mediaPipeMs,
        trackingMs: perf.trackingMs,
        hungarianMs: perf.hungarianMs,
        kalmanMs: perf.kalmanMs,
        orientationMs: perf.trackingMs * 0.08,
        rotationMs: perf.trackingMs * 0.06,
        workerMs: perf.workerMs,
        totalMs: perf.totalMs,
      }
    : computePerformanceBreakdown(frameStat);

  const pipeline = buildPipelineInspector(snap.frameIndex, null, frameStat);
  if (snap.mediapipe) {
    const mp = pipeline.find((s) => s.stage === 'mediapipe_detection');
    if (mp) {
      mp.timeMs = snap.mediapipe.processingMs;
      mp.outputCount = snap.mediapipe.detectedPersons;
      mp.confidence = snap.mediapipe.detectionConfidence;
    }
  }
  if (snap.tracking) {
    const tr = pipeline.find((s) => s.stage === 'tracking');
    if (tr) {
      tr.timeMs = snap.tracking.trackingMs;
      tr.outputCount = snap.tracking.trackedPersons;
      tr.trackCount = snap.tracking.trackIds.length;
    }
  }
  if (perf) {
    const hun = pipeline.find((s) => s.stage === 'hungarian_matching');
    if (hun) hun.timeMs = perf.hungarianMs;
    const kal = pipeline.find((s) => s.stage === 'kalman_prediction');
    if (kal) kal.timeMs = perf.kalmanMs;
  }

  return {
    frameIndex: snap.frameIndex,
    timestamp: snap.timestamp,
    pipeline,
    hungarian,
    kalman,
    persons: [],
    rcaIssues: snap.rca.map((r) => ({
      problem: r.problem,
      reason: r.reason,
      evidence: r.evidence,
      suggestedCause: r.suggestedCause,
      severity: r.severity,
    })),
    motionQuality: frames.length
      ? computeMotionQuality(frames, snap.frameIndex, frameStat)
      : computeMotionQuality([], snap.frameIndex, frameStat),
    performance,
  };
}

export function resolveFrameAnalysis(options: {
  frameIndex: number;
  debugSnapshot: FrameDebugSnapshot | null;
  postHoc: FrameAnalysisSnapshot | null;
  frameStat: SkeletonDebugFrameStat | null;
  frames: DetectionFrame[];
  sampleFps: number;
}): FrameAnalysisSnapshot | null {
  const { debugSnapshot, postHoc, frameStat, frames, frameIndex, sampleFps } = options;
  if (debugSnapshot && (debugSnapshot.hungarian.length || debugSnapshot.kalman.length || debugSnapshot.performance)) {
    const base = frameAnalysisFromDebugSnapshot(debugSnapshot, frameStat, frames);
    if (postHoc) {
      return {
        ...base,
        persons: postHoc.persons,
        rcaIssues: base.rcaIssues.length ? base.rcaIssues : postHoc.rcaIssues,
        motionQuality: postHoc.motionQuality,
        hungarian: base.hungarian.length ? base.hungarian : postHoc.hungarian,
        kalman: base.kalman.length ? base.kalman : postHoc.kalman,
      };
    }
    if (frames.length) {
      const prev = frames[frameIndex - 1] ?? null;
      const curr = frames[frameIndex] ?? null;
      if (!base.hungarian.length) base.hungarian = buildHungarianInspector(prev, curr, sampleFps);
      if (!base.kalman.length) base.kalman = buildKalmanInspector(frames, frameIndex);
      if (!base.rcaIssues.length) base.rcaIssues = analyzeFrameRca(frames, frameIndex, frameStat, sampleFps);
    }
    return base;
  }
  return postHoc;
}
