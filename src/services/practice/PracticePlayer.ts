// @ts-nocheck
/**
 * PracticePlayer — Skeleton Timestamp 기준 재생.
 *
 * videoDuration = Timeline Duration
 * Timeline Duration = Skeleton 마지막 timestamp
 * 종료: currentTime >= videoDuration (frameCount 기준 종료 금지)
 */
import type { SkeletonFrameData } from '../../types/groupPractice';
import {
  findFrameIndexByTimestamp,
  resolvePracticeFrameAtTime,
} from '../../utils/skeletonTimelineUtils';

export {
  findFrameIndexByTimestamp,
  resolvePracticeFrameAtTime,
};

/** Skeleton frames 마지막 timestamp = Timeline Duration */
export function resolveSkeletonLastTimestamp(frames: SkeletonFrameData[] | null | undefined): number {
  if (!frames?.length) return 0;
  const last = frames[frames.length - 1]?.timestamp;
  return Number.isFinite(last) && last > 0 ? last : 0;
}

/**
 * Practice videoDuration — HTMLVideo duration 우선, 없으면 skeleton 마지막 timestamp.
 */
export function resolvePracticeVideoDuration(
  frames: SkeletonFrameData[] | null | undefined,
  sourceVideoDurationSec?: number | null,
): number {
  const videoDur = Number(sourceVideoDurationSec);
  const lastTs = resolveSkeletonLastTimestamp(frames);

  if (Number.isFinite(videoDur) && videoDur > 0) {
    return videoDur;
  }
  return lastTs;
}

/** 재생 종료 — timestamp 기준 (frameCount 사용 금지) */
export function isPracticePlaybackFinished(currentTime: number, videoDuration: number): boolean {
  const t = Number(currentTime);
  const dur = Number(videoDuration);
  if (!Number.isFinite(dur) || dur <= 0) return false;
  return t >= dur;
}

export default resolvePracticeFrameAtTime;
