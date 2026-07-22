// @ts-nocheck
/**
 * Frame time / FPS statistics (PHASE 17 — benchmark only, no runtime changes).
 */
export type FrameTimeStats = {
  sampleCount: number;
  averageFps: number | null;
  minFps: number | null;
  maxFps: number | null;
  averageFrameTimeMs: number | null;
  percentile95FrameTimeMs: number | null;
  worstFrameTimeMs: number | null;
};

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function computeFrameTimeStats(frameTimesMs: number[]): FrameTimeStats {
  if (!frameTimesMs.length) {
    return {
      sampleCount: 0,
      averageFps: null,
      minFps: null,
      maxFps: null,
      averageFrameTimeMs: null,
      percentile95FrameTimeMs: null,
      worstFrameTimeMs: null,
    };
  }
  const sum = frameTimesMs.reduce((a, b) => a + b, 0);
  const avg = sum / frameTimesMs.length;
  const worst = Math.max(...frameTimesMs);
  const p95 = percentile(frameTimesMs, 95);
  const fpsFrom = (ms: number) => (ms > 0 ? 1000 / ms : null);
  return {
    sampleCount: frameTimesMs.length,
    averageFps: fpsFrom(avg),
    minFps: fpsFrom(worst),
    maxFps: fpsFrom(Math.min(...frameTimesMs)),
    averageFrameTimeMs: avg,
    percentile95FrameTimeMs: p95,
    worstFrameTimeMs: worst,
  };
}

export function createFrameTimeMeter() {
  const samples: number[] = [];
  let lastTs = 0;

  return {
    tick(now: number = typeof performance !== 'undefined' ? performance.now() : Date.now()) {
      if (lastTs > 0) samples.push(now - lastTs);
      lastTs = now;
    },
    recordFrameDurationMs(ms: number) {
      if (Number.isFinite(ms) && ms >= 0) samples.push(ms);
    },
    reset() {
      samples.length = 0;
      lastTs = 0;
    },
    getSamples(): number[] {
      return [...samples];
    },
    getStats(): FrameTimeStats {
      return computeFrameTimeStats(samples);
    },
  };
}

export default computeFrameTimeStats;
