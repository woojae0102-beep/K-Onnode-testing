// @ts-nocheck
/**
 * Pipeline Benchmark — 30초 / 1분 / 3분 / 5분 구간 성능 지표를 수집하고
 * JSON/CSV로 저장·이전 결과와 비교한다.
 */
import {
  bytesToMb,
  computeHeapTrendSlopeBytesPerSec,
  createHeapTrendTracker,
} from './memoryProfiler';
import { getGpuResourceSnapshot } from './gpuResourceMonitor';
import { featureFlagManager } from '../config/featureFlagManager';
import { recordTelemetry } from './pipelineTelemetry';
import type { PipelineStageStats } from './asyncPipelineQueue';
import type { StressTestReport } from './stressTestHarness';

export const BENCHMARK_PRESETS = [
  { id: '30s', label: '30초', durationMs: 30_000 },
  { id: '1m', label: '1분', durationMs: 60_000 },
  { id: '3m', label: '3분', durationMs: 180_000 },
  { id: '5m', label: '5분', durationMs: 300_000 },
] as const;

export type BenchmarkPresetId = typeof BENCHMARK_PRESETS[number]['id'];

export type BenchmarkSample = {
  atMs: number;
  frameCount: number;
  heapMb: number | null;
  stageStats: PipelineStageStats[];
  gpuLive: {
    imageBitmap: number;
    videoFrame: number;
    canvas: number;
    webgl: number;
  };
};

export type BenchmarkReport = {
  presetId: BenchmarkPresetId;
  presetLabel: string;
  durationMs: number;
  frameCount: number;
  peakHeapMb: number | null;
  gcFrequency: number;
  heapSlopeBytesPerSec: number;
  stageMaxQueues: Record<string, number>;
  totalDroppedFrames: number;
  avgFps: number | null;
  gpuSnapshot: ReturnType<typeof getGpuResourceSnapshot>;
  samples: BenchmarkSample[];
  completedAt: string;
  comparison?: BenchmarkComparison | null;
};

export type BenchmarkComparison = {
  previousCompletedAt: string;
  frameCountDelta: number;
  frameCountDeltaPct: number | null;
  peakHeapDeltaMb: number | null;
  heapSlopeDelta: number;
  droppedFramesDelta: number;
  verdict: 'improved' | 'regressed' | 'neutral';
  notes: string[];
};

const STORAGE_KEY = 'k-onnode:benchmark-history:v1';

function loadHistory(): Record<string, BenchmarkReport[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveHistory(history: Record<string, BenchmarkReport[]>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // quota
  }
}

function compareWithPrevious(current: BenchmarkReport, previous: BenchmarkReport | null): BenchmarkComparison | null {
  if (!previous) return null;
  const frameCountDelta = current.frameCount - previous.frameCount;
  const frameCountDeltaPct = previous.frameCount > 0
    ? (frameCountDelta / previous.frameCount) * 100
    : null;
  const peakHeapDeltaMb = current.peakHeapMb != null && previous.peakHeapMb != null
    ? current.peakHeapMb - previous.peakHeapMb
    : null;
  const heapSlopeDelta = current.heapSlopeBytesPerSec - previous.heapSlopeBytesPerSec;
  const droppedFramesDelta = current.totalDroppedFrames - previous.totalDroppedFrames;

  const notes: string[] = [];
  let score = 0;
  if (frameCountDelta > 0) { score += 1; notes.push(`프레임 +${frameCountDelta}`); }
  else if (frameCountDelta < 0) { score -= 1; notes.push(`프레임 ${frameCountDelta}`); }
  if (peakHeapDeltaMb != null && peakHeapDeltaMb < -5) { score += 1; notes.push(`Peak heap ${peakHeapDeltaMb.toFixed(1)}MB`); }
  else if (peakHeapDeltaMb != null && peakHeapDeltaMb > 5) { score -= 1; notes.push(`Peak heap +${peakHeapDeltaMb.toFixed(1)}MB`); }
  if (droppedFramesDelta < 0) { score += 1; notes.push(`드롭 ${droppedFramesDelta}`); }
  else if (droppedFramesDelta > 0) { score -= 1; notes.push(`드롭 +${droppedFramesDelta}`); }
  if (heapSlopeDelta < -10_000) { score += 1; }
  else if (heapSlopeDelta > 10_000) { score -= 1; notes.push(`heap slope +${Math.round(heapSlopeDelta)} B/s`); }

  const verdict = score > 0 ? 'improved' : score < 0 ? 'regressed' : 'neutral';
  return {
    previousCompletedAt: previous.completedAt,
    frameCountDelta,
    frameCountDeltaPct,
    peakHeapDeltaMb,
    heapSlopeDelta,
    droppedFramesDelta,
    verdict,
    notes,
  };
}

export function isBenchmarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get('benchmark')) return true;
  return featureFlagManager.get('benchmarkModeEnabled');
}

export function getBenchmarkPresetFromQuery(): BenchmarkPresetId {
  if (typeof window === 'undefined') return '30s';
  const raw = new URLSearchParams(window.location.search).get('benchmark');
  const found = BENCHMARK_PRESETS.find((p) => p.id === raw);
  return found?.id || '30s';
}

export function createPipelineBenchmark(presetId: BenchmarkPresetId = '30s') {
  const preset = BENCHMARK_PRESETS.find((p) => p.id === presetId) || BENCHMARK_PRESETS[0];
  const heapTracker = createHeapTrendTracker();
  const samples: BenchmarkSample[] = [];
  let startedAt = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let lastFrameCount = 0;
  let lastStageStats: PipelineStageStats[] = [];
  let totalDropped = 0;

  const recordSample = () => {
    const heapStats = heapTracker.getStats();
    const gpu = getGpuResourceSnapshot();
    samples.push({
      atMs: performance.now() - startedAt,
      frameCount: lastFrameCount,
      heapMb: bytesToMb(heapStats.latestBytes),
      stageStats: lastStageStats.slice(),
      gpuLive: {
        imageBitmap: gpu.imageBitmapLive,
        videoFrame: gpu.videoFrameLive,
        canvas: gpu.canvasLive,
        webgl: gpu.webglContextLive,
      },
    });
  };

  const start = () => {
    startedAt = performance.now();
    heapTracker.start(2000);
    intervalHandle = setInterval(recordSample, 2000);
    recordSample();
    console.info(`[Benchmark] 시작 — ${preset.label} (${preset.durationMs / 1000}s 목표)`);
  };

  const updateProgress = (frameCount: number, stageStats: PipelineStageStats[] = []) => {
    lastFrameCount = frameCount;
    lastStageStats = stageStats;
    stageStats.forEach((s) => {
      totalDropped = Math.max(totalDropped, s.droppedCount);
    });
  };

  const stop = (): BenchmarkReport => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    heapTracker.stop();
    recordSample();

    const heapStats = heapTracker.getStats();
    const slope = computeHeapTrendSlopeBytesPerSec(heapStats.samples);
    const durationMs = performance.now() - startedAt;

    const stageMaxQueues: Record<string, number> = {};
    let maxDropped = 0;
    samples.forEach((s) => {
      s.stageStats.forEach((st) => {
        stageMaxQueues[st.name] = Math.max(stageMaxQueues[st.name] ?? 0, st.maxQueueLengthObserved);
        maxDropped = Math.max(maxDropped, st.droppedCount);
      });
    });

    const avgFps = durationMs > 0 ? (lastFrameCount / durationMs) * 1000 : null;

    const history = loadHistory();
    const prevList = history[preset.id] || [];
    const previous = prevList.length ? prevList[prevList.length - 1] : null;

    const report: BenchmarkReport = {
      presetId: preset.id,
      presetLabel: preset.label,
      durationMs,
      frameCount: lastFrameCount,
      peakHeapMb: bytesToMb(heapStats.peakBytes),
      gcFrequency: heapStats.gcEventCount,
      heapSlopeBytesPerSec: slope,
      stageMaxQueues,
      totalDroppedFrames: Math.max(totalDropped, totalDropped),
      avgFps,
      gpuSnapshot: getGpuResourceSnapshot(),
      samples: samples.slice(),
      completedAt: new Date().toISOString(),
      comparison: null,
    };
    report.comparison = compareWithPrevious(report, previous);

    history[preset.id] = [...prevList.slice(-9), report];
    saveHistory(history);

    recordTelemetry('benchmark_result', `Benchmark ${preset.label} 완료`, {
      subsystem: 'benchmark',
      severity: 'info',
      meta: {
        presetId: preset.id,
        frameCount: report.frameCount,
        peakHeapMb: report.peakHeapMb,
        verdict: report.comparison?.verdict,
      },
    });

    console.table({
      [`Benchmark ${preset.label}`]: {
        Frames: report.frameCount,
        'Avg FPS': avgFps?.toFixed(1) ?? 'n/a',
        'Peak Heap': report.peakHeapMb != null ? `${report.peakHeapMb.toFixed(1)}MB` : 'n/a',
        'Heap Slope': `${Math.round(slope)} B/s`,
        'Dropped': report.totalDroppedFrames,
        Verdict: report.comparison?.verdict ?? 'no baseline',
      },
    });
    if (report.comparison?.notes?.length) {
      console.info('[Benchmark] vs previous:', report.comparison.notes.join(', '));
    }

    return report;
  };

  const getTargetDurationMs = () => preset.durationMs;

  return { start, updateProgress, stop, getTargetDurationMs, preset };
}

export function benchmarkReportToCsv(report: BenchmarkReport): string {
  const header = 'atMs,frameCount,heapMb,imageBitmapLive,videoFrameLive,canvasLive,webglLive';
  const rows = report.samples.map((s) => [
    s.atMs.toFixed(0),
    s.frameCount,
    s.heapMb?.toFixed(2) ?? '',
    s.gpuLive.imageBitmap,
    s.gpuLive.videoFrame,
    s.gpuLive.canvas,
    s.gpuLive.webgl,
  ].join(','));
  return [header, ...rows].join('\n');
}

export function downloadBenchmarkReport(report: BenchmarkReport, format: 'json' | 'csv' = 'json'): void {
  if (typeof document === 'undefined') return;
  const isJson = format === 'json';
  const content = isJson ? JSON.stringify(report, null, 2) : benchmarkReportToCsv(report);
  const blob = new Blob([content], { type: isJson ? 'application/json' : 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `k-onnode-benchmark-${report.presetId}-${Date.now()}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getBenchmarkHistory(presetId?: BenchmarkPresetId): BenchmarkReport[] {
  const history = loadHistory();
  if (presetId) return history[presetId] || [];
  return Object.values(history).flat();
}

/** StressTestReport → BenchmarkReport 호환 변환 */
export function stressReportToBenchmark(
  stress: StressTestReport,
  presetId: BenchmarkPresetId = '5m',
): BenchmarkReport {
  const preset = BENCHMARK_PRESETS.find((p) => p.id === presetId) || BENCHMARK_PRESETS[3];
  return {
    presetId: preset.id,
    presetLabel: preset.label,
    durationMs: stress.durationMs,
    frameCount: stress.frameCount,
    peakHeapMb: stress.peakHeapMb,
    gcFrequency: stress.gcFrequency,
    heapSlopeBytesPerSec: stress.heapSlopeBytesPerSec,
    stageMaxQueues: stress.stageMaxQueues,
    totalDroppedFrames: 0,
    avgFps: stress.durationMs > 0 ? (stress.frameCount / stress.durationMs) * 1000 : null,
    gpuSnapshot: getGpuResourceSnapshot(),
    samples: stress.samples.map((s) => ({
      atMs: s.atMs,
      frameCount: s.frameCount,
      heapMb: s.heapMb,
      stageStats: s.stageStats,
      gpuLive: { imageBitmap: 0, videoFrame: 0, canvas: 0, webgl: 0 },
    })),
    completedAt: new Date().toISOString(),
    comparison: null,
  };
}

if (typeof window !== 'undefined') {
  (window as any).__K_ONNODE_BENCHMARK__ = {
    presets: BENCHMARK_PRESETS,
    getHistory: getBenchmarkHistory,
    download: downloadBenchmarkReport,
  };
}
