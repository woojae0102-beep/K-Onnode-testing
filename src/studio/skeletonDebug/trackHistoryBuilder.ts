// @ts-nocheck
import type { DetectionFrame } from '../../services/MultiPersonTracker';
import type { TrackHistoryEntry, TrackLifecycleEvent } from './types';
import { getSkeletonDebugTrackColor } from './skeletonDebugColors';

type TrackState = {
  trackId: number;
  events: TrackLifecycleEvent[];
  firstFrame: number;
  lastFrame: number;
  visibleFrames: number;
  estimatedFrames: number;
  wasVisible: boolean;
  wasEstimatedOnly: boolean;
  wasAbsent: boolean;
};

/**
 * DetectionFrame 시퀀스에서 Track 생성/소실/복구/소멸 이벤트를 역추적한다.
 */
export function buildTrackHistory(frames: DetectionFrame[]): TrackHistoryEntry[] {
  const states = new Map<number, TrackState>();

  frames.forEach((frame, frameIndex) => {
    const timestamp = frame.timestamp ?? frameIndex / 30;
    const presentIds = new Set<number>();
    const visibleIds = new Set<number>();
    const estimatedIds = new Set<number>();

    (frame.detectedPeople || []).forEach((person) => {
      const id = person.trackId;
      presentIds.add(id);
      if (person.isEstimated) estimatedIds.add(id);
      else visibleIds.add(id);
    });

    presentIds.forEach((trackId) => {
      if (!states.has(trackId)) {
        states.set(trackId, {
          trackId,
          events: [{ type: 'create', frameIndex, timestamp }],
          firstFrame: frameIndex,
          lastFrame: frameIndex,
          visibleFrames: 0,
          estimatedFrames: 0,
          wasVisible: false,
          wasEstimatedOnly: false,
          wasAbsent: true,
        });
      }
    });

    states.forEach((state, trackId) => {
      const isPresent = presentIds.has(trackId);
      const isVisible = visibleIds.has(trackId);
      const isEstimatedOnly = estimatedIds.has(trackId) && !isVisible;

      state.lastFrame = Math.max(state.lastFrame, isPresent ? frameIndex : state.lastFrame);

      if (isVisible) {
        state.visibleFrames += 1;
        if (state.wasEstimatedOnly || state.wasAbsent) {
          state.events.push({ type: 'recovered', frameIndex, timestamp });
        }
        state.wasVisible = true;
        state.wasEstimatedOnly = false;
        state.wasAbsent = false;
      } else if (isEstimatedOnly) {
        state.estimatedFrames += 1;
        if (state.wasVisible) {
          state.events.push({ type: 'lost', frameIndex, timestamp });
        }
        state.wasVisible = false;
        state.wasEstimatedOnly = true;
        state.wasAbsent = false;
      } else if (!isPresent) {
        if (state.wasVisible || state.wasEstimatedOnly) {
          state.events.push({ type: 'lost', frameIndex, timestamp });
        }
        state.wasVisible = false;
        state.wasEstimatedOnly = false;
        state.wasAbsent = true;
      }
    });
  });

  const lastFrameIndex = Math.max(0, frames.length - 1);
  const lastTimestamp = frames[lastFrameIndex]?.timestamp ?? lastFrameIndex / 30;

  const entries: TrackHistoryEntry[] = [];
  states.forEach((state) => {
    const lastPresentFrame = findLastPresentFrame(frames, state.trackId);
    if (lastPresentFrame >= 0 && lastPresentFrame < lastFrameIndex) {
      state.events.push({
        type: 'destroyed',
        frameIndex: lastPresentFrame + 1,
        timestamp: frames[lastPresentFrame + 1]?.timestamp ?? lastTimestamp,
      });
    }
    entries.push({
      trackId: state.trackId,
      color: getSkeletonDebugTrackColor(state.trackId),
      events: state.events,
      firstFrame: state.firstFrame,
      lastFrame: lastPresentFrame >= 0 ? lastPresentFrame : state.lastFrame,
      totalFrames: state.lastFrame - state.firstFrame + 1,
      visibleFrames: state.visibleFrames,
      estimatedFrames: state.estimatedFrames,
    });
  });

  return entries.sort((a, b) => a.trackId - b.trackId);
}

function findLastPresentFrame(frames: DetectionFrame[], trackId: number): number {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    if (frames[i].detectedPeople?.some((p) => p.trackId === trackId)) return i;
  }
  return -1;
}

/** 특정 프레임에서 lost/recovered 이벤트가 발생한 trackId 집합 */
export function getTrackEventsAtFrame(
  history: TrackHistoryEntry[],
  frameIndex: number,
): { lost: number[]; recovered: number[]; created: number[] } {
  const lost: number[] = [];
  const recovered: number[] = [];
  const created: number[] = [];
  history.forEach((entry) => {
    entry.events.forEach((ev) => {
      if (ev.frameIndex !== frameIndex) return;
      if (ev.type === 'lost') lost.push(entry.trackId);
      if (ev.type === 'recovered') recovered.push(entry.trackId);
      if (ev.type === 'create') created.push(entry.trackId);
    });
  });
  return { lost, recovered, created };
}

export default buildTrackHistory;
