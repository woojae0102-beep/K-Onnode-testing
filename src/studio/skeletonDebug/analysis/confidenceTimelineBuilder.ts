// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from '../types';
import type { ConfidenceTimelinePoint } from './analysisTypes';
import { personPoseConfidence } from './analysisMath';

export function buildConfidenceTimelines(
  frames: DetectionFrame[],
): Map<number, ConfidenceTimelinePoint[]> {
  const byTrack = new Map<number, ConfidenceTimelinePoint[]>();

  frames.forEach((frame, frameIndex) => {
    frame.detectedPeople?.forEach((person) => {
      const id = person.trackId;
      if (!byTrack.has(id)) byTrack.set(id, []);
      const conf = personPoseConfidence(person);
      const series = byTrack.get(id)!;
      const prev = series[series.length - 1];
      const isDrop = prev != null && prev.confidence - conf > 0.25;
      series.push({
        frameIndex,
        timestamp: frame.timestamp ?? frameIndex / 30,
        confidence: conf,
        isDrop,
      });
    });
  });

  return byTrack;
}

export function getConfidenceDropFrames(
  timelines: Map<number, ConfidenceTimelinePoint[]>,
): number[] {
  const frames = new Set<number>();
  timelines.forEach((series) => {
    series.forEach((p) => {
      if (p.isDrop) frames.add(p.frameIndex);
    });
  });
  return Array.from(frames).sort((a, b) => a - b);
}
