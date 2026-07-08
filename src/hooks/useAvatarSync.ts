// @ts-nocheck
import { useCallback, useRef } from 'react';
import { resolvePracticeFrameAtTime } from '../utils/skeletonTimelineUtils';

export function useAvatarSync(skeletonData) {
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const isPausedRef = useRef(false);

  const start = useCallback(() => {
    startTimeRef.current = performance.now();
    isPausedRef.current = false;
    pausedAtRef.current = 0;
  }, []);

  const pause = useCallback(() => {
    if (!isPausedRef.current) {
      pausedAtRef.current = performance.now() - startTimeRef.current;
      isPausedRef.current = true;
    }
  }, []);

  const resume = useCallback(() => {
    if (isPausedRef.current) {
      startTimeRef.current = performance.now() - pausedAtRef.current;
      isPausedRef.current = false;
    }
  }, []);

  const getElapsed = useCallback(() => {
    if (isPausedRef.current) return pausedAtRef.current / 1000;
    return (performance.now() - startTimeRef.current) / 1000;
  }, []);

  const getCurrentFrame = useCallback(() => {
    return resolvePracticeFrameAtTime(skeletonData, getElapsed());
  }, [skeletonData, getElapsed]);

  return {
    start,
    pause,
    resume,
    getElapsed,
    getCurrentFrame,
    isPausedRef,
  };
}

export default useAvatarSync;
