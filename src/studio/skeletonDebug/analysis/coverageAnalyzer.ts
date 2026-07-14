// @ts-nocheck
import type { SkeletonDebugFrameStat } from '../types';
import type { CoverageDropEvent, CoverageTimelinePoint } from './analysisTypes';

export function buildCoverageTimeline(
  frameStats: SkeletonDebugFrameStat[],
): CoverageTimelinePoint[] {
  return frameStats.map((f) => ({
    frameIndex: f.frameIndex,
    timestamp: f.timestamp,
    coverage: f.coverage,
  }));
}

export function detectCoverageDrops(
  frameStats: SkeletonDebugFrameStat[],
  minDrop = 0.05,
): CoverageDropEvent[] {
  const events: CoverageDropEvent[] = [];
  for (let i = 1; i < frameStats.length; i += 1) {
    const prev = frameStats[i - 1];
    const curr = frameStats[i];
    const drop = prev.coverage - curr.coverage;
    if (drop < minDrop) continue;

    const lostMembers = Math.max(0, prev.visible - curr.visible);
    let reason = 'Coverage decrease';
    const evidence: string[] = [
      `Coverage ${Math.round(prev.coverage * 100)}% → ${Math.round(curr.coverage * 100)}%`,
    ];

    if (curr.droppedFrames > prev.droppedFrames) {
      reason = 'Worker Queue Overflow';
      evidence.push(`Dropped frames +${curr.droppedFrames - prev.droppedFrames}`);
    } else if (lostMembers >= 2) {
      reason = `${lostMembers} Members Lost`;
      evidence.push(`Visible ${prev.visible} → ${curr.visible}`);
    } else if (curr.detected < prev.detected) {
      reason = 'MediaPipe Miss';
      evidence.push(`Detected ${prev.detected} → ${curr.detected}`);
    } else if (curr.estimated > prev.estimated) {
      reason = 'Occlusion / Prediction increase';
      evidence.push(`Estimated ${prev.estimated} → ${curr.estimated}`);
    }

    events.push({
      fromFrame: prev.frameIndex,
      toFrame: curr.frameIndex,
      fromCoverage: prev.coverage,
      toCoverage: curr.coverage,
      dropAmount: drop,
      reason,
      evidence,
    });
  }
  return events;
}
