// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';

/**
 * referenceFrames[currentFrame] — 인덱스 직접 접근.
 *
 * currentFrame = Math.floor(currentTime * fps)
 * elapsedTime / animationTime / demoAnimation / timestamp 보간 금지.
 */
export function resolveReferenceFrameIndex(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  currentTimeSec: number,
  fps: number,
): number {
  if (!referenceFrames?.length) return -1;

  const t = Number(currentTimeSec);
  const rate = Number(fps);
  if (!Number.isFinite(t) || t < 0 || !Number.isFinite(rate) || rate <= 0) return -1;

  const index = Math.floor(t * rate);
  if (index < 0 || index >= referenceFrames.length) return -1;
  return index;
}

/** referenceFrames[Math.floor(currentTime * fps)] — 합성·demo·fallback 없음 */
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
