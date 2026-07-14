// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import { getSkeletonDebugTrackColor } from '../skeletonDebugColors';
import type { EnhancedTrackLifecycle } from './analysisTypes';
import {
  findClosestPrevTrack,
  findPrevPerson,
  frameDt,
  personPoseConfidence,
  personVelocity,
} from './analysisMath';
import { buildHungarianInspector } from './hungarianInspectorBuilder';

export function buildEnhancedTrackLifecycles(
  frames: DetectionFrame[],
  sampleFps: number,
): EnhancedTrackLifecycle[] {
  const states = new Map<number, {
    confidences: number[];
    velocities: number[];
    occlusionCount: number;
    recoveryCount: number;
    reassignmentCount: number;
    predictionFrames: number;
    visibleFrames: number;
    estimatedFrames: number;
    events: EnhancedTrackLifecycle['events'];
    firstFrame: number;
    lastFrame: number;
    destroyReason: string | null;
  }>();

  frames.forEach((frame, frameIndex) => {
    const timestamp = frame.timestamp ?? frameIndex / sampleFps;
    const dt = frameDt(frames, frameIndex, sampleFps);
    const prev = frameIndex > 0 ? frames[frameIndex - 1] : null;
    const hungarian = buildHungarianInspector(prev, frame, sampleFps);

    frame.detectedPeople?.forEach((person) => {
      const id = person.trackId;
      if (!states.has(id)) {
        states.set(id, {
          confidences: [],
          velocities: [],
          occlusionCount: 0,
          recoveryCount: 0,
          reassignmentCount: 0,
          predictionFrames: 0,
          visibleFrames: 0,
          estimatedFrames: 0,
          events: [{ type: 'create', frameIndex, timestamp }],
          firstFrame: frameIndex,
          lastFrame: frameIndex,
          destroyReason: null,
        });
      }
      const s = states.get(id)!;
      s.lastFrame = frameIndex;
      s.confidences.push(personPoseConfidence(person));

      const prevPerson = findPrevPerson(prev, id);
      if (prevPerson) {
        s.velocities.push(personVelocity(prevPerson, person, dt));
      }

      if (person.isEstimated) {
        s.estimatedFrames += 1;
        s.predictionFrames += 1;
        if (prevPerson && !prevPerson.isEstimated) {
          s.occlusionCount += 1;
          s.events.push({ type: 'lost', frameIndex, timestamp, detail: 'Occlusion start' });
        }
      } else {
        s.visibleFrames += 1;
        if (prevPerson?.isEstimated) {
          s.recoveryCount += 1;
          s.events.push({ type: 'recovered', frameIndex, timestamp });
        }
      }

      const closest = findClosestPrevTrack(prev, person);
      if (closest && closest.trackId !== id && closest.distance < 0.12) {
        s.reassignmentCount += 1;
        s.events.push({
          type: 'reassignment',
          frameIndex,
          timestamp,
          detail: `From track ${closest.trackId}`,
        });
      }
    });

    hungarian.filter((h) => h.reason?.includes('Track switch')).forEach((h) => {
      const s = states.get(h.previousTrackId);
      if (s) s.reassignmentCount += 1;
    });
  });

  const lastIdx = Math.max(0, frames.length - 1);
  const result: EnhancedTrackLifecycle[] = [];

  states.forEach((s, trackId) => {
    const lastPresent = findLastPresent(frames, trackId);
    let destroyReason: string | null = null;
    if (lastPresent >= 0 && lastPresent < lastIdx) {
      const lastPerson = frames[lastPresent]?.detectedPeople?.find((p) => p.trackId === trackId);
      if (lastPerson?.isEstimated) {
        destroyReason = 'Long Occlusion';
        s.events.push({
          type: 'destroyed',
          frameIndex: lastPresent + 1,
          timestamp: frames[lastPresent + 1]?.timestamp ?? 0,
          detail: destroyReason,
        });
      } else {
        destroyReason = 'Left Frame / Tracking End';
        s.events.push({ type: 'destroyed', frameIndex: lastPresent + 1, timestamp: frames[lastPresent + 1]?.timestamp ?? 0 });
      }
    }

    result.push({
      trackId,
      color: getSkeletonDebugTrackColor(trackId),
      createdFrame: s.firstFrame,
      createdTimestamp: frames[s.firstFrame]?.timestamp ?? 0,
      destroyedFrame: lastPresent < lastIdx ? lastPresent + 1 : null,
      destroyedTimestamp: lastPresent < lastIdx ? frames[lastPresent + 1]?.timestamp ?? null : null,
      destroyReason,
      averageConfidence: s.confidences.length
        ? s.confidences.reduce((a, b) => a + b, 0) / s.confidences.length
        : 0,
      maxVelocity: s.velocities.length ? Math.max(...s.velocities) : 0,
      occlusionCount: s.occlusionCount,
      recoveryCount: s.recoveryCount,
      hungarianReassignmentCount: s.reassignmentCount,
      predictionFrameCount: s.predictionFrames,
      visibleFrames: s.visibleFrames,
      estimatedFrames: s.estimatedFrames,
      events: s.events,
    });
  });

  return result.sort((a, b) => a.trackId - b.trackId);
}

function findLastPresent(frames: DetectionFrame[], trackId: number): number {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    if (frames[i].detectedPeople?.some((p) => p.trackId === trackId)) return i;
  }
  return -1;
}
