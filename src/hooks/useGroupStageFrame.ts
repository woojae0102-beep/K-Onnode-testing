// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SkeletonFrameData } from '../types/groupPractice';
import type { SkeletonRenderTimeline } from '../services/rendering/SkeletonTimelineBuilder';
import {
  StageMotionEngine,
  resetSharedStageMotionEngine,
} from '../services/rendering/StageMotionEngine';
import { resolvePracticeVideoDuration } from '../services/practice/PracticePlayer';

export interface UseGroupStageFrameOptions {
  sourceFrames: SkeletonFrameData[] | null | undefined;
  timeSec: number;
  sourceVideoDurationSec?: number | null;
  renderTimeline?: SkeletonRenderTimeline | null;
  /** 세션 재시작 시 motion engine 상태 초기화 */
  sessionKey?: string;
}

export interface UseGroupStageFrameResult {
  frame: SkeletonFrameData | null;
  videoDuration: number;
  resolveAt: (timeSec: number) => SkeletonFrameData | null;
}

/**
 * Practice 단일 프레임 진입점 — Timestamp 기반 + Render Motion Engine.
 */
export function useGroupStageFrame({
  sourceFrames,
  timeSec,
  sourceVideoDurationSec = null,
  renderTimeline = null,
  sessionKey = '',
}: UseGroupStageFrameOptions): UseGroupStageFrameResult {
  const engineRef = useRef<StageMotionEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new StageMotionEngine();
  }

  useEffect(() => {
    engineRef.current?.reset();
    resetSharedStageMotionEngine();
  }, [sessionKey, sourceFrames?.length]);

  const videoDuration = useMemo(
    () => resolvePracticeVideoDuration(sourceFrames, sourceVideoDurationSec),
    [sourceFrames, sourceVideoDurationSec],
  );

  const resolveAt = useCallback(
    (t: number) => {
      if (!sourceFrames?.length) return null;
      return engineRef.current?.resolveFrameAtTime(sourceFrames, t) ?? null;
    },
    [sourceFrames],
  );

  const frame = useMemo(
    () => resolveAt(timeSec),
    [resolveAt, timeSec],
  );

  return { frame, videoDuration, resolveAt };
}

export default useGroupStageFrame;
