// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';

export function findNearestFrame(frames: SkeletonFrameData[] | null | undefined, time: number) {
  if (!frames?.length) return null;
  return frames.reduce((nearest, frame) =>
    Math.abs(frame.timestamp - time) < Math.abs(nearest.timestamp - time) ? frame : nearest,
  );
}

export default findNearestFrame;
