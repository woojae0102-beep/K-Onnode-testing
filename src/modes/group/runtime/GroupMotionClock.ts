// @ts-nocheck
/**
 * Group Mode playback clock — 시간축만 관리 (skeleton lookup 없음).
 */

export type GroupMotionClock = {
  currentTimeSec: number;
  durationSec: number;
  isPlaying: boolean;
};

export function createGroupMotionClock(durationSec: number): GroupMotionClock {
  return {
    currentTimeSec: 0,
    durationSec: Math.max(0, durationSec),
    isPlaying: false,
  };
}

export function seekGroupMotionClock(clock: GroupMotionClock, timeSec: number): GroupMotionClock {
  const duration = clock.durationSec;
  const clamped = duration > 0
    ? Math.min(Math.max(0, timeSec), duration)
    : Math.max(0, timeSec);
  return { ...clock, currentTimeSec: clamped };
}

export function playGroupMotionClock(clock: GroupMotionClock): GroupMotionClock {
  return { ...clock, isPlaying: true };
}

export function pauseGroupMotionClock(clock: GroupMotionClock): GroupMotionClock {
  return { ...clock, isPlaying: false };
}

export default GroupMotionClock;
