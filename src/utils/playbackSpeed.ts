// @ts-nocheck
export const PLAYBACK_SPEED_MIN = 0.1;
export const PLAYBACK_SPEED_MAX = 2;
export const PLAYBACK_SPEED_STEP = 0.1;
export const PLAYBACK_SPEED_DEFAULT = 1;

export const PLAYBACK_SPEED_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function clampPlaybackSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PLAYBACK_SPEED_DEFAULT;
  return Math.round(Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, n)) * 10) / 10;
}

export function formatPlaybackSpeed(value) {
  const v = clampPlaybackSpeed(value);
  return v % 1 === 0 ? `${v}x` : `${v.toFixed(1)}x`;
}

export function applySpeechRate(baseRate, speedMultiplier = 1) {
  const mult = clampPlaybackSpeed(speedMultiplier);
  const result = (Number(baseRate) || 1) * mult;
  return Math.min(3, Math.max(0.1, Math.round(result * 100) / 100));
}
