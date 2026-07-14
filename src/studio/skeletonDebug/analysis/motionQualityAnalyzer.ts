// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from '../types';
import type { MotionQualityBreakdown, PerformanceBreakdown } from './analysisTypes';
import {
  frameDt,
  findPrevPerson,
  jointCompleteness,
  personPoseConfidence,
  personVelocity,
} from './analysisMath';

export function computeMotionQuality(
  frames: DetectionFrame[],
  frameIndex: number,
  frameStat: SkeletonDebugFrameStat | null,
): MotionQualityBreakdown {
  const frame = frames[frameIndex];
  const people = frame?.detectedPeople ?? [];
  const dt = frameDt(frames, frameIndex, 30);

  let poseSum = 0;
  let completeSum = 0;
  let stableCount = 0;
  let switchCount = 0;

  people.forEach((p) => {
    poseSum += personPoseConfidence(p);
    completeSum += jointCompleteness(p);
    const prev = findPrevPerson(frames[frameIndex - 1] ?? null, p.trackId);
    if (prev) {
      const vel = personVelocity(prev, p, dt);
      if (vel < 3 && !p.isEstimated) stableCount += 1;
      if (prev.trackId !== p.trackId) switchCount += 1;
    }
  });

  const n = Math.max(1, people.length);
  const pose = (poseSum / n) * 100;
  const jointCompletenessScore = (completeSum / n) * 100;
  const estimated = people.filter((p) => p.isEstimated).length;
  const predictionRatio = estimated / n;
  const tracking = Math.max(0, 100 - switchCount * 15 - estimated * 8);
  const coverage = (frameStat?.coverage ?? 0) * 100;
  const poseStability = (stableCount / n) * 100;

  const overall = Math.round(
    pose * 0.25 +
    jointCompletenessScore * 0.15 +
    tracking * 0.25 +
    coverage * 0.2 +
    poseStability * 0.15 -
    predictionRatio * 10,
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    tracking: Math.round(tracking),
    pose: Math.round(pose),
    coverage: Math.round(coverage),
    predictionRatio: Math.round(predictionRatio * 100),
    jointCompleteness: Math.round(jointCompletenessScore),
    poseStability: Math.round(poseStability),
  };
}

export function computePerformanceBreakdown(
  frameStat: SkeletonDebugFrameStat | null,
): PerformanceBreakdown {
  const totalMs = frameStat?.processingMs ?? 0;
  const mediaPipeMs = frameStat?.mediaPipeDelayMs ?? totalMs * 0.55;
  const workerMs = frameStat?.workerQueue ? Math.min(12, totalMs * 0.12) : totalMs * 0.08;
  const trackingMs = Math.max(0, totalMs - mediaPipeMs - workerMs);
  const hungarianMs = trackingMs * 0.14;
  const kalmanMs = trackingMs * 0.16;
  const orientationMs = trackingMs * 0.08;
  const rotationMs = trackingMs * 0.06;

  return {
    mediaPipeMs: Math.round(mediaPipeMs * 10) / 10,
    trackingMs: Math.round(trackingMs * 10) / 10,
    hungarianMs: Math.round(hungarianMs * 10) / 10,
    kalmanMs: Math.round(kalmanMs * 10) / 10,
    orientationMs: Math.round(orientationMs * 10) / 10,
    rotationMs: Math.round(rotationMs * 10) / 10,
    workerMs: Math.round(workerMs * 10) / 10,
    totalMs: Math.round(totalMs * 10) / 10,
  };
}
