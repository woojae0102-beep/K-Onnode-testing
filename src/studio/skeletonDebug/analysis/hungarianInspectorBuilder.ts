// @ts-nocheck
import type { DetectionFrame, TrackedPerson } from '../../../services/MultiPersonTracker';
import {
  averageDetectionConfidence,
  computeAdaptiveMatchThreshold,
} from '../../../services/motion/adaptiveMatchThreshold';
import { hungarianAssign, jointsPoseDistance } from '../../../services/skeleton/poseSimilarity';
import type { HungarianMatchRow } from './analysisTypes';
import { findPrevPerson } from './analysisMath';

const DEFAULT_THRESHOLD = 0.72;

export function buildHungarianInspector(
  prevFrame: DetectionFrame | null,
  currFrame: DetectionFrame | null,
  sampleFps = 30,
): HungarianMatchRow[] {
  if (!prevFrame?.detectedPeople?.length || !currFrame?.detectedPeople?.length) return [];

  const prevTracks = prevFrame.detectedPeople.filter((p) => !p.isEstimated);
  const currDetections = currFrame.detectedPeople.filter((p) => !p.isEstimated);
  if (!prevTracks.length || !currDetections.length) return [];

  const avgConf = averageDetectionConfidence(currDetections);
  const baseThreshold = computeAdaptiveMatchThreshold({
    poseConfidence: avgConf,
    sampleFps,
  });

  const costMatrix = prevTracks.map((prev) =>
    currDetections.map((curr) => jointsPoseDistance(prev.joints, curr.joints)),
  );
  const assignment = hungarianAssign(costMatrix);
  const rows: HungarianMatchRow[] = [];

  assignment.forEach((currIdx, prevIdx) => {
    const prev = prevTracks[prevIdx];
    if (!prev) return;
    const cost = currIdx >= 0 ? (costMatrix[prevIdx]?.[currIdx] ?? Infinity) : Infinity;
    const threshold = baseThreshold;
    const matched = currIdx >= 0 && cost <= threshold;
    rows.push({
      previousTrackId: prev.trackId,
      currentDetectionIndex: currIdx,
      cost: Number.isFinite(cost) ? cost : 999,
      threshold,
      matched,
      reason: matched ? undefined : `cost ${cost.toFixed(3)} > threshold ${threshold.toFixed(3)}`,
    });
  });

  // Track switches: same detection position, different trackId
  currDetections.forEach((curr, currIdx) => {
    const closestPrev = findBestPrevMatch(prevTracks, curr);
    if (!closestPrev) return;
    const actualPrev = findPrevPerson(prevFrame, curr.trackId);
    if (actualPrev && actualPrev.trackId !== closestPrev.trackId) {
      const cost = jointsPoseDistance(closestPrev.joints, curr.joints);
      rows.push({
        previousTrackId: closestPrev.trackId,
        currentDetectionIndex: currIdx,
        cost,
        threshold: DEFAULT_THRESHOLD,
        matched: false,
        reason: `Track switch: ${closestPrev.trackId} → ${curr.trackId}`,
      });
    }
  });

  return rows;
}

function findBestPrevMatch(prevTracks: TrackedPerson[], curr: TrackedPerson): TrackedPerson | null {
  let best: TrackedPerson | null = null;
  let bestCost = Infinity;
  prevTracks.forEach((prev) => {
    const cost = jointsPoseDistance(prev.joints, curr.joints);
    if (cost < bestCost) {
      bestCost = cost;
      best = prev;
    }
  });
  return bestCost < 1.2 ? best : null;
}

export function averageHungarianCost(rows: HungarianMatchRow[]): number {
  const costs = rows.filter((r) => r.matched && Number.isFinite(r.cost)).map((r) => r.cost);
  return costs.length ? costs.reduce((s, c) => s + c, 0) / costs.length : 0;
}
