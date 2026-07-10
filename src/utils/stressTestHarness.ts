// @ts-nocheck
/**
 * Motion Extraction Stress Test Harness — 30분+ 영상에서 메모리 누수·큐 상한을 검증한다.
 * 실제 실행은 브라우저+GPU 환경에서 사용자가 수행하고, 콘솔 리포트를 확인한다.
 */
import {
  bytesToMb,
  computeHeapTrendSlopeBytesPerSec,
  createHeapTrendTracker,
  type MemorySample,
} from './memoryProfiler';
import type { PipelineStageStats } from './asyncPipelineQueue';

export type StressTestSample = {
  atMs: number;
  frameCount: number;
  heapMb: number | null;
  stageStats: PipelineStageStats[];
};

export type StressTestReport = {
  durationMs: number;
  frameCount: number;
  peakHeapMb: number | null;
  gcFrequency: number;
  heapSlopeBytesPerSec: number;
  leakSuspected: boolean;
  leakReason: string | null;
  stageMaxQueues: Record<string, number>;
  samples: StressTestSample[];
};

const HEAP_LEAK_SLOPE_THRESHOLD_BYTES_PER_SEC = 50_000; // ~50KB/s 지속 증가 시 의심
const SAMPLE_INTERVAL_MS = 5000;

export function createStressTestHarness() {
  const heapTracker = createHeapTrendTracker();
  const samples: StressTestSample[] = [];
  let startedAt = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let lastFrameCount = 0;
  let lastStageStats: PipelineStageStats[] = [];

  const recordSample = () => {
    const heapStats = heapTracker.getStats();
    samples.push({
      atMs: performance.now() - startedAt,
      frameCount: lastFrameCount,
      heapMb: bytesToMb(heapStats.latestBytes),
      stageStats: lastStageStats.slice(),
    });
  };

  const start = () => {
    startedAt = performance.now();
    heapTracker.start(SAMPLE_INTERVAL_MS);
    intervalHandle = setInterval(recordSample, SAMPLE_INTERVAL_MS);
    recordSample();
  };

  const updateProgress = (frameCount: number, stageStats: PipelineStageStats[] = []) => {
    lastFrameCount = frameCount;
    lastStageStats = stageStats;
  };

  const stop = (): StressTestReport => {
    if (intervalHandle != null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    heapTracker.stop();
    recordSample();

    const heapStats = heapTracker.getStats();
    const heapSamples: MemorySample[] = heapStats.samples;
    const slope = computeHeapTrendSlopeBytesPerSec(heapSamples);
    const durationMs = performance.now() - startedAt;

    const stageMaxQueues: Record<string, number> = {};
    samples.forEach((s) => {
      s.stageStats.forEach((st) => {
        stageMaxQueues[st.name] = Math.max(stageMaxQueues[st.name] ?? 0, st.maxQueueLengthObserved);
      });
    });

    let leakSuspected = false;
    let leakReason: string | null = null;
    if (slope > HEAP_LEAK_SLOPE_THRESHOLD_BYTES_PER_SEC && durationMs > 120_000) {
      leakSuspected = true;
      leakReason = `heap 기울기 ${Math.round(slope)} bytes/s — 프레임 증가 외 지속 상승(휴리스틱)`;
    }

    const report: StressTestReport = {
      durationMs,
      frameCount: lastFrameCount,
      peakHeapMb: bytesToMb(heapStats.peakBytes),
      gcFrequency: heapStats.gcEventCount,
      heapSlopeBytesPerSec: slope,
      leakSuspected,
      leakReason,
      stageMaxQueues,
      samples: samples.slice(),
    };

    console.table({
      'Stress Test Report': {
        'Duration (min)': (durationMs / 60000).toFixed(1),
        Frames: report.frameCount,
        'Peak Heap': report.peakHeapMb != null ? `${report.peakHeapMb.toFixed(1)}MB` : 'n/a',
        'GC Freq (heuristic)': report.gcFrequency,
        'Heap Slope': `${Math.round(slope)} bytes/s`,
        'Leak Suspected': leakSuspected ? 'YES' : 'no',
        Reason: leakReason || '—',
      },
    });
    console.table(report.stageMaxQueues);

    return report;
  };

  return { start, updateProgress, stop, heapTracker };
}

/** URL 쿼리 ?stressTest=1 또는 DEV 모드에서 Stress Test UI 노출 여부 */
export function isStressTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env?.DEV) return new URLSearchParams(window.location.search).get('stressTest') === '1';
  return false;
}
