// @ts-nocheck
/**
 * @deprecated findNearestFrame 제거 — PracticePlayer.findFrameIndexByTimestamp 사용.
 */
import type { SkeletonFrameData } from '../types/groupPractice';
import {
  findFrameIndexByTimestamp,
  resolvePracticeFrameAtTime,
} from '../services/practice/PracticePlayer';

/** @deprecated resolvePracticeFrameAtTime 사용 */
export function findNearestFrame(frames: SkeletonFrameData[] | null | undefined, time: number) {
  return resolvePracticeFrameAtTime(frames, time);
}

export { findFrameIndexByTimestamp, resolvePracticeFrameAtTime };

export default resolvePracticeFrameAtTime;
