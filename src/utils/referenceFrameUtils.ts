// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';
import { findFrameIndexByTimestamp } from './skeletonTimelineUtils';

const TIMESTAMP_TOLERANCE_SEC = 1 / 30;

/**
 * referenceFrames 그리드 FPS 추정.
 * sparse/legacy 데이터는 실제 timestamp span 기준.
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

  const expectedFullGrid = Math.floor(last * nominalFps) + 1;
  const gridRatio = referenceFrames.length / Math.max(1, expectedFullGrid);

  // 30fps 풀 그리드에 가깝면 nominal 유지, 아니면 실측 FPS
  return gridRatio >= 0.9 ? nominalFps : derived;
}

/** timestamp span이 영상 길이 대비 충분한지 */
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
 * referenceFrames[currentFrame] — 인덱스 직접 접근.
 *
 * 1) 풀 30fps 그리드: Math.floor(currentTime * fps)
 * 2) sparse/legacy: timestamp binary search
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

  const lastIdx = referenceFrames.length - 1;
  const lastTs = referenceFrames[lastIdx]?.timestamp ?? 0;
  if (t > lastTs) return -1;

  const effectiveFps = resolveReferenceFramesFps(referenceFrames, rate);
  const expectedFullGrid = Math.floor(lastTs * rate) + 1;
  const isFullGrid = referenceFrames.length >= expectedFullGrid * 0.9;

  if (isFullGrid) {
    const gridIndex = Math.floor(t * rate);
    if (gridIndex >= 0 && gridIndex <= lastIdx) {
      const frame = referenceFrames[gridIndex];
      if (frame && Math.abs((frame.timestamp ?? 0) - t) <= TIMESTAMP_TOLERANCE_SEC + 0.001) {
        return gridIndex;
      }
    }
  }

  const tsIndex = findFrameIndexByTimestamp(referenceFrames, t);
  if (tsIndex >= 0) return tsIndex;

  const derivedIndex = Math.floor(t * effectiveFps);
  if (derivedIndex >= 0 && derivedIndex <= lastIdx) return derivedIndex;

  return -1;
}

/** referenceFrames[index] — 합성·demo·fallback 없음 */
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
