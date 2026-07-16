// @ts-nocheck
/**
 * Independent Render Clock — Analysis Clock과 완전 분리.
 * MediaPipe 2FPS여도 renderTime은 RAF마다 진행한다.
 */

export type RenderSyncMode = 'LIVE_RENDER' | 'ANALYSIS_REPLAY';

export type RenderClock = {
  time: number;
  lastRafTimestamp: number | null;
  isRunning: boolean;
};

export function createRenderClock(initialTime = 0): RenderClock {
  return { time: initialTime, lastRafTimestamp: null, isRunning: true };
}

export function resetRenderClock(clock: RenderClock, time = 0): void {
  clock.time = time;
  clock.lastRafTimestamp = null;
  clock.isRunning = true;
}

export function pauseRenderClock(clock: RenderClock): void {
  clock.isRunning = false;
  clock.lastRafTimestamp = null;
}

export function resumeRenderClock(clock: RenderClock): void {
  clock.isRunning = true;
  clock.lastRafTimestamp = null;
}

/**
 * RAF delta 기반 renderTime 진행 — lastAnalysisTime으로 clamp하지 않음.
 */
export function tickRenderClock(clock: RenderClock, rafTimestamp: number, durationSec: number): number {
  if (!clock.isRunning) return clock.time;

  if (clock.lastRafTimestamp == null) {
    clock.lastRafTimestamp = rafTimestamp;
    return clock.time;
  }

  const deltaSec = Math.min(0.1, (rafTimestamp - clock.lastRafTimestamp) / 1000);
  clock.lastRafTimestamp = rafTimestamp;

  const maxTime = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : Infinity;
  clock.time = Math.max(0, Math.min(maxTime, clock.time + deltaSec));
  return clock.time;
}

/**
 * LIVE_RENDER: video.currentTime을 render clock에 반영 (분석 도착과 무관).
 * drift가 크면 hard sync, 작으면 video가 master.
 */
export function syncRenderClockFromVideo(clock: RenderClock, videoTime: number, durationSec: number): number {
  const maxTime = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : Infinity;
  const clamped = Math.max(0, Math.min(maxTime, videoTime));
  clock.time = clamped;
  clock.lastRafTimestamp = null;
  return clock.time;
}
