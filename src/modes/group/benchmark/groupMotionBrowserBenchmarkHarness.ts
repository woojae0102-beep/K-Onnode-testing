// @ts-nocheck
/**
 * Group Motion Browser Benchmark Harness (PHASE 17).
 * Read-only observation of existing runtime metrics — does not modify runtime architecture.
 */
import { getProductionMotionRuntimeMetrics, resetProductionMotionRuntimeCacheForTests } from '../runtime/productionMotionRuntimeCache';
import { computeFrameTimeStats, createFrameTimeMeter, type FrameTimeStats } from './groupMotionBenchmarkStats';
import { createSyntheticAvatarRuntimeSlot, type SyntheticAvatarRuntimeSlot } from './groupMotionSyntheticRuntime';
import { snapshotRendererInfo, tryCreateHeadlessRendererProbe, type RendererInfoSnapshot } from './groupMotionBrowserRendererProbe';
import { runGroupMotionCacheBenchmark, type CacheBenchmarkReport } from './groupMotionCacheBenchmark';

export type GroupMotionBenchmarkSample = {
  avatarCount: number;
  frameStats: FrameTimeStats;
  animationMixerUpdateTimeMs: number | null;
  retargetTimeMs: number | null;
  motionResolveTimeMs: number | null;
  cpuUpdateTimeMs: number | null;
  chromeHeapBytes: number | null;
  chromeHeapMb: number | null;
  rendererInfo: RendererInfoSnapshot;
  cacheHitRatio: number | null;
  drawCalls: number | null;
  triangles: number | null;
  programs: number | null;
  textures: number | null;
  environment: 'node' | 'browser';
};

export type GroupMotionBrowserBenchmarkReport = {
  generatedAt: string;
  environment: 'node' | 'browser';
  samples: GroupMotionBenchmarkSample[];
  cacheBenchmark: CacheBenchmarkReport;
  notes: string[];
};

const STRESS_AVATAR_COUNTS = [1, 4, 8, 12, 16, 24, 32, 48, 64] as const;
const TICK_FRAMES = 60;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function readHeapBytes(): number | null {
  const perf = typeof performance !== 'undefined' ? performance : null;
  const mem = perf ? (perf as { memory?: { usedJSHeapSize?: number } }).memory : null;
  return mem && Number.isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize! : null;
}

function bytesToMb(bytes: number | null): number | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  return bytes / (1024 * 1024);
}

function aggregateCacheHitRatio(): number | null {
  const m = getProductionMotionRuntimeMetrics();
  const hits =
    m.cachedGltfHits
    + m.cachedMotionClipHits
    + m.cachedRetargetHits
    + m.cachedBoneMappingHits
    + m.cachedSkeletonRuntimeHits;
  const misses =
    m.cachedGltfMisses
    + m.cachedMotionClipMisses
    + m.cachedRetargetMisses
    + m.cachedBoneMappingMisses
    + m.cachedSkeletonRuntimeMisses;
  const total = hits + misses;
  return total > 0 ? hits / total : null;
}

export function benchmarkAvatarCount(
  avatarCount: number,
  renderer?: import('three').WebGLRenderer | null,
): GroupMotionBenchmarkSample {
  resetProductionMotionRuntimeCacheForTests();
  const environment: 'node' | 'browser' = typeof document !== 'undefined' ? 'browser' : 'node';

  const slots: SyntheticAvatarRuntimeSlot[] = [];
  let motionResolveSum = 0;
  let retargetSum = 0;

  for (let i = 0; i < avatarCount; i += 1) {
    const slot = createSyntheticAvatarRuntimeSlot(
      `stress-${avatarCount}-${i}`,
      `https://bench/stress-${avatarCount}-motion.glb`,
      `https://bench/stress-${avatarCount}-avatar-${i}.glb`,
    );
    motionResolveSum += slot.motionResolveMs;
    retargetSum += slot.retargetMs;
    slots.push(slot);
  }

  const frameMeter = createFrameTimeMeter();
  const cpuFrameTimes: number[] = [];
  let mixerUpdateSum = 0;

  for (let f = 0; f < TICK_FRAMES; f += 1) {
    const t0 = now();
    for (const slot of slots) {
      const mu0 = now();
      slot.action.paused = false;
      slot.action.time += 1 / 60;
      slot.mixer.update(1 / 60);
      mixerUpdateSum += now() - mu0;
    }
    const frameMs = now() - t0;
    cpuFrameTimes.push(frameMs);
    frameMeter.recordFrameDurationMs(frameMs);
  }

  const rendererInfo = renderer
    ? snapshotRendererInfo(renderer)
    : tryCreateHeadlessRendererProbe();

  const heap = readHeapBytes();
  const frameStats = computeFrameTimeStats(cpuFrameTimes);

  slots.forEach((s) => s.dispose());

  return {
    avatarCount,
    frameStats,
    animationMixerUpdateTimeMs: slots.length ? mixerUpdateSum / (TICK_FRAMES * slots.length) : null,
    retargetTimeMs: avatarCount ? retargetSum / avatarCount : null,
    motionResolveTimeMs: avatarCount ? motionResolveSum / avatarCount : null,
    cpuUpdateTimeMs: cpuFrameTimes.length
      ? cpuFrameTimes.reduce((a, b) => a + b, 0) / cpuFrameTimes.length
      : null,
    chromeHeapBytes: heap,
    chromeHeapMb: bytesToMb(heap),
    rendererInfo,
    cacheHitRatio: aggregateCacheHitRatio(),
    drawCalls: rendererInfo.drawCalls,
    triangles: rendererInfo.triangles,
    programs: rendererInfo.programs,
    textures: rendererInfo.textures,
    environment,
  };
}

export function runGroupMotionStressBenchmark(
  avatarCounts: readonly number[] = STRESS_AVATAR_COUNTS,
): GroupMotionBrowserBenchmarkReport {
  const environment: 'node' | 'browser' = typeof document !== 'undefined' ? 'browser' : 'node';
  const samples = avatarCounts.map((n) => benchmarkAvatarCount(n));
  const cacheBenchmark = runGroupMotionCacheBenchmark();

  const notes = [
    'CPU frame tick measures synthetic mixer.update loop (60 ticks) — not React Three Fiber render loop.',
    environment === 'node'
      ? 'Chrome heap and real browser FPS require browser execution (public/group-motion-benchmark.html).'
      : 'Browser environment — heap available when performance.memory exists.',
    'Renderer.info from probe render when WebGL context available.',
  ];

  return {
    generatedAt: new Date().toISOString(),
    environment,
    samples,
    cacheBenchmark,
    notes,
  };
}

export async function runBrowserRafBenchmark(options: {
  avatarCount?: number;
  frameTarget?: number;
  onFrame?: (slots: SyntheticAvatarRuntimeSlot[]) => void;
} = {}): Promise<GroupMotionBenchmarkSample> {
  const avatarCount = options.avatarCount ?? 4;
  const frameTarget = options.frameTarget ?? 120;
  if (typeof requestAnimationFrame === 'undefined') {
    return benchmarkAvatarCount(avatarCount);
  }

  resetProductionMotionRuntimeCacheForTests();
  const slots: SyntheticAvatarRuntimeSlot[] = [];
  for (let i = 0; i < avatarCount; i += 1) {
    slots.push(createSyntheticAvatarRuntimeSlot(
      `raf-${i}`,
      'https://bench/raf-motion.glb',
      'https://bench/raf-avatar.glb',
    ));
  }

  const frameMeter = createFrameTimeMeter();
  let mixerUpdateSum = 0;
  let frames = 0;

  await new Promise<void>((resolve) => {
    const loop = (ts: number) => {
      frameMeter.tick(ts);
      const mu0 = now();
      for (const slot of slots) {
        slot.action.paused = false;
        slot.mixer.update(1 / 60);
      }
      mixerUpdateSum += now() - mu0;
      options.onFrame?.(slots);
      frames += 1;
      if (frames >= frameTarget) {
        resolve();
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  const sample: GroupMotionBenchmarkSample = {
    avatarCount,
    frameStats: frameMeter.getStats(),
    animationMixerUpdateTimeMs: slots.length ? mixerUpdateSum / (frames * slots.length) : null,
    retargetTimeMs: null,
    motionResolveTimeMs: null,
    cpuUpdateTimeMs: null,
    chromeHeapBytes: readHeapBytes(),
    chromeHeapMb: bytesToMb(readHeapBytes()),
    rendererInfo: tryCreateHeadlessRendererProbe(),
    cacheHitRatio: aggregateCacheHitRatio(),
    drawCalls: null,
    triangles: null,
    programs: null,
    textures: null,
    environment: 'browser',
  };

  slots.forEach((s) => s.dispose());
  return sample;
}

export { STRESS_AVATAR_COUNTS };
export default runGroupMotionStressBenchmark;
