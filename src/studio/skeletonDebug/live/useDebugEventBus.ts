// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  disableDebugEventBus,
  enableDebugEventBus,
  getFrameDebugSnapshot,
  getLiveDebugState,
  resetDebugEventBus,
  subscribeDebugEventBus,
} from './debugEventBus';
import type { FrameDebugSnapshot, LiveDebugState } from './debugEventTypes';

const LIVE_FLUSH_MS = 100;

export function useDebugEventBus() {
  const [liveState, setLiveState] = useState<LiveDebugState>(() => getLiveDebugState());
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    pendingRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLiveState({ ...getLiveDebugState(), confidenceByTrack: new Map(getLiveDebugState().confidenceByTrack) });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    timerRef.current = setTimeout(flush, LIVE_FLUSH_MS);
  }, [flush]);

  const startLiveBus = useCallback(() => {
    resetDebugEventBus();
    enableDebugEventBus(true);
    flush();
  }, [flush]);

  const stopLiveBus = useCallback(() => {
    disableDebugEventBus();
    flush();
  }, [flush]);

  useEffect(() => {
    const unsub = subscribeDebugEventBus(() => scheduleFlush());
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleFlush]);

  const getSnapshotForFrame = useCallback(
    (frameIndex: number): FrameDebugSnapshot | null => getFrameDebugSnapshot(frameIndex),
    [liveState.currentFrameIndex],
  );

  return {
    liveState,
    isLive: liveState.isLive && liveState.enabled,
    startLiveBus,
    stopLiveBus,
    getSnapshotForFrame,
    flush,
  };
}

export default useDebugEventBus;
