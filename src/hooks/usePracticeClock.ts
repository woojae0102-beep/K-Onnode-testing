// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { PRACTICE_RENDER_FPS } from '../config/practiceRenderConfig';
import { isPracticePlaybackFinished } from '../services/practice/PracticePlayer';

export interface PracticeClockOptions {
  /** videoDuration = Timeline Duration (초) */
  durationSec: number;
  fps?: number;
  /** @deprecated coverage 기준 조기 종료 금지 */
  coverageEndSec?: number;
  /** YouTube 등 외부 시간 주입 (null이면 자체 RAF) */
  externalTimeSec?: number | null;
  externalRunning?: boolean;
}

/**
 * PracticeClock — Skeleton Timestamp / videoDuration 단일 시간축.
 * 종료: currentTime >= videoDuration (frameCount 기준 종료 금지)
 */
export function usePracticeClock({
  durationSec,
  fps = PRACTICE_RENDER_FPS,
  externalTimeSec = null,
  externalRunning = false,
}: PracticeClockOptions) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const startAtRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const videoDuration = Math.max(0, Number(durationSec) || 0);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const finish = useCallback(() => {
    stopLoop();
    setCurrentTime(videoDuration);
    setIsRunning(false);
    setIsFinished(true);
  }, [videoDuration, stopLoop]);

  const start = useCallback(() => {
    if (externalTimeSec != null) {
      setIsRunning(true);
      setIsFinished(false);
      return;
    }
    startAtRef.current = performance.now();
    setIsRunning(true);
    setIsFinished(false);

    const tick = () => {
      if (startAtRef.current == null) return;
      const elapsed = (performance.now() - startAtRef.current) / 1000;
      if (isPracticePlaybackFinished(elapsed, videoDuration)) {
        finish();
        return;
      }
      setCurrentTime(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [externalTimeSec, videoDuration, finish]);

  const forceStop = useCallback(() => {
    stopLoop();
    startAtRef.current = null;
    setIsRunning(false);
  }, [stopLoop]);

  const reset = useCallback(() => {
    stopLoop();
    startAtRef.current = null;
    setCurrentTime(0);
    setIsRunning(false);
    setIsFinished(false);
  }, [stopLoop]);

  useEffect(() => {
    if (externalTimeSec == null || !externalRunning) return;
    const t = Math.max(0, externalTimeSec);
    setCurrentTime(t);
    if (isPracticePlaybackFinished(t, videoDuration)) {
      finish();
    }
  }, [externalTimeSec, externalRunning, videoDuration, finish]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const currentFrameIndex = Math.max(0, Math.round(currentTime * fps));

  return {
    currentTime,
    currentFrameIndex,
    fps,
    duration: videoDuration,
    videoDuration,
    isRunning,
    isFinished,
    progress: videoDuration > 0 ? Math.min(1, currentTime / videoDuration) : 0,
    start,
    forceStop,
    reset,
    finish,
  };
}

export default usePracticeClock;
