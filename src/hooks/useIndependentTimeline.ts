// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';

function interpolateJoints(a: JointPoint, b: JointPoint, ratio: number): JointPoint {
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
    z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * ratio,
    visibility: a.visibility ?? b.visibility,
  };
}

function interpolateFrames(
  a: SkeletonFrameData,
  b: SkeletonFrameData,
  ratio: number,
): SkeletonFrameData {
  const result: SkeletonFrameData = {
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * ratio,
    members: [],
  };

  a.members.forEach((memberA, i) => {
    const memberB = b.members[i];
    if (!memberB) return;

    const joints: Record<string, JointPoint> = {};
    Object.keys(memberA.joints).forEach((jointName) => {
      const jointA = memberA.joints[jointName];
      const jointB = memberB.joints?.[jointName];
      if (!jointA) return;
      joints[jointName] = jointB ? interpolateJoints(jointA, jointB, ratio) : jointA;
    });

    result.members.push({
      ...memberA,
      joints,
    } as SkeletonMemberData);
  });

  return result;
}

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

      if (elapsed >= totalDuration) {
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
    if (!skeletonData.length) return null;

    let frameIndex = skeletonData.findIndex((f) => f.timestamp > currentTime);
    if (frameIndex === -1) frameIndex = skeletonData.length - 1;
    if (frameIndex === 0) return skeletonData[0];

    const prevFrame = skeletonData[frameIndex - 1];
    const nextFrame = skeletonData[frameIndex];
    const delta = nextFrame.timestamp - prevFrame.timestamp;
    if (delta <= 0) return prevFrame;

    const ratio = (currentTime - prevFrame.timestamp) / delta;
    return interpolateFrames(prevFrame, nextFrame, ratio);
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
