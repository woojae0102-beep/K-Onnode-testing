// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';
import { findFrameIndexByTimestamp } from '../services/practice/PracticePlayer';

/**
 * referenceFrames[currentFrameIndex] — timestamp 기준 인덱스.
 * coverage 밖이면 -1.
 */
export function resolveReferenceFrameIndex(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  timeSec: number,
): number {
  return findFrameIndexByTimestamp(referenceFrames, timeSec);
}

/** session.referenceFrames[currentFrame] — 합성·demo·fallback 없음 */
export function resolveReferenceFrameAtTime(
  referenceFrames: SkeletonFrameData[] | null | undefined,
  timeSec: number,
): SkeletonFrameData | null {
  const index = resolveReferenceFrameIndex(referenceFrames, timeSec);
  if (index < 0 || !referenceFrames?.[index]) return null;
  return referenceFrames[index];
}

export default resolveReferenceFrameAtTime;
