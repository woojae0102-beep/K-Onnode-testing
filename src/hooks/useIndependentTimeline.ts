// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SkeletonFrameData } from '../types/groupPractice';
import { resolvePracticeFrameAtTime } from '../utils/skeletonTimelineUtils';
import { isPracticePlaybackFinished } from '../services/practice/PracticePlayer';

export function useIndependentTimeline(
  skeletonData: SkeletonFrameData[],
  totalDuration: number,
) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const startTimestampRef = useRef<number | null>(null);
  const animFrameRef = useRef(0);

  const startTimeline = useCallback(() => {
    if (startTimestampRef.current !== null) return;

    startTimestampRef.current = performance.now();
    setIsRunning(true);
    setIsFinished(false);

    const tick = () => {
      if (startTimestampRef.current === null) return;

      const elapsed = (performance.now() - startTimestampRef.current) / 1000;

      if (isPracticePlaybackFinished(elapsed, totalDuration)) {
        setCurrentTime(totalDuration);
        setIsRunning(false);
        setIsFinished(true);
        return;
      }

      setCurrentTime(elapsed);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [totalDuration]);

  const forceStop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setIsRunning(false);
  }, []);

  const getCurrentFrame = useCallback((): SkeletonFrameData | null => {
    return resolvePracticeFrameAtTime(skeletonData, currentTime);
  }, [currentTime, skeletonData]);

  useEffect(
    () => () => {
      cancelAnimationFrame(animFrameRef.current);
    },
    [],
  );

  return {
    currentTime,
    isRunning,
    isFinished,
    startTimeline,
    forceStop,
    getCurrentFrame,
    progress: totalDuration > 0 ? currentTime / totalDuration : 0,
  };
}

export default useIndependentTimeline;
