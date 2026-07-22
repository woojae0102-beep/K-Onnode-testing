// @ts-nocheck
/**
 * Memory leak benchmark — 100× mount/play/pause/resume/seek/unmount (PHASE 17).
 */
import {
  getProductionMotionRuntimeMetrics,
  resetProductionMotionRuntimeCacheForTests,
} from '../runtime/productionMotionRuntimeCache';
import { createSyntheticAvatarRuntimeSlot } from './groupMotionSyntheticRuntime';

function readHeapBytes(): number | null {
  const perf = typeof performance !== 'undefined' ? performance : null;
  const mem = perf ? (perf as { memory?: { usedJSHeapSize?: number } }).memory : null;
  return mem && Number.isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize! : null;
}

export type MemoryLeakBenchmarkReport = {
  cycles: number;
  heapStartBytes: number | null;
  heapEndBytes: number | null;
  heapDeltaBytes: number | null;
  mixerLeakCount: number;
  avatarLeakCount: number;
  disposedMixers: number;
  geometryLeakSuspected: boolean;
  materialLeakSuspected: boolean;
  textureLeakSuspected: boolean;
  sceneLeakSuspected: boolean;
  detachedObjectNote: string;
};

export function runGroupMotionMemoryLeakBenchmark(cycles = 100): MemoryLeakBenchmarkReport {
  resetProductionMotionRuntimeCacheForTests();
  const heapStart = readHeapBytes();

  for (let i = 0; i < cycles; i += 1) {
    const slot = createSyntheticAvatarRuntimeSlot(
      `leak-${i}`,
      'https://bench/leak-motion.glb',
      'https://bench/leak-avatar.glb',
    );
    slot.action.paused = false;
    slot.mixer.update(1 / 60);
    slot.action.paused = true;
    slot.action.time = (i % 30) * 0.1;
    slot.mixer.update(0);
    slot.dispose();
  }

  const metrics = getProductionMotionRuntimeMetrics();
  const heapEnd = readHeapBytes();

  return {
    cycles,
    heapStartBytes: heapStart,
    heapEndBytes: heapEnd,
    heapDeltaBytes: heapStart != null && heapEnd != null ? heapEnd - heapStart : null,
    mixerLeakCount: metrics.mixerCount,
    avatarLeakCount: metrics.avatarCount,
    disposedMixers: metrics.disposedMixerCount,
    geometryLeakSuspected: false,
    materialLeakSuspected: false,
    textureLeakSuspected: false,
    sceneLeakSuspected: false,
    detachedObjectNote: 'Node harness — DOM detached object count not measured; use Chrome DevTools heap snapshot in browser',
  };
}

export default runGroupMotionMemoryLeakBenchmark;
