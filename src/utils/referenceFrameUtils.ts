// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';

/**
 * referenceFrames 그리드 FPS — (frameCount-1) / duration
 * 9794 frames / 163s ≈ 60fps
 */
export function resolveReferenceFramesFps(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  nominalFps = 30,
): number {
  if (!referenceFrames?.length || referenceFrames.length < 2) {
    return nominalFps;
  }

  const first = referenceFrames[0]?.timestamp ?? 0;
  const last = referenceFrames[referenceFrames.length - 1]?.timestamp ?? 0;
  const span = last - first;
  if (!Number.isFinite(span) || span <= 0) return nominalFps;

  const derived = (referenceFrames.length - 1) / span;
  if (!Number.isFinite(derived) || derived <= 0) return nominalFps;
  return derived;
}

export function resolveReferenceTimelineCoverage(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  videoDurationSec?: number | null,
): number {
  if (!referenceFrames?.length) return 0;
  const first = referenceFrames[0]?.timestamp ?? 0;
  const last = referenceFrames[referenceFrames.length - 1]?.timestamp ?? 0;
  const span = Math.max(0, last - first);
  const expected = Number(videoDurationSec);
  const denom = Number.isFinite(expected) && expected > 0 ? expected : last || span || 1;
  return Math.min(1, span / denom);
}

/**
 * currentFrame = Math.floor(currentTime * fps)
 * referenceFrames[currentFrame] — 보간·demo·fallback 없음
 */
export function resolveReferenceFrameIndex(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  currentTimeSec: number,
  fps: number,
): number {
  if (!referenceFrames?.length) return -1;

  const t = Number(currentTimeSec);
  if (!Number.isFinite(t) || t < 0) return -1;

  const lastIdx = referenceFrames.length - 1;
  const lastTs = referenceFrames[lastIdx]?.timestamp ?? lastIdx / Math.max(1, fps);
  if (t > lastTs + 1 / Math.max(1, fps)) return -1;

  const effectiveFps = resolveReferenceFramesFps(referenceFrames, fps);
  const index = Math.floor(t * effectiveFps);
  if (index < 0 || index > lastIdx) return -1;
  return index;
}

export function resolveReferenceFrameAtTime(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  currentTimeSec: number,
  fps: number,
): SkeletonFrameData | null {
  const index = resolveReferenceFrameIndex(referenceFrames, currentTimeSec, fps);
  if (index < 0) return null;
  return referenceFrames[index] ?? null;
}

export default resolveReferenceFrameAtTime;
