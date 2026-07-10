// @ts-nocheck
/**
 * Memory Profiler — Motion Extraction / Renderer / Worker 전반의 메모리 사용량을 추정한다.
 *
 * 주의(정확도 한계):
 * - `performance.memory`는 표준이 아니며 Chrome/Edge 계열에서만 값이 존재한다.
 *   그 외 브라우저에서는 항상 null을 반환하므로 UI/리포트에서 "n/a (Chrome only)"로 표기해야 한다.
 * - GC Frequency는 브라우저에 표준 GC 이벤트 API가 없어(2026년 기준 미표준),
 *   heap 샘플링에서 급격한 하락을 감지하는 휴리스틱으로 근사한다. 정확한 GC 카운트가 아니다.
 * - Frame Buffer / DanceDatabase 메모리는 실제 오브젝트 크기를 매 프레임 측정하지 않고
 *   (그 자체가 CPU 비용이 크므로) 대표 프레임 1개의 크기 × 프레임 수로 근사한다.
 */

import { getGpuResourceSnapshot } from './gpuResourceMonitor';

/** heap이 이전 샘플의 이 비율보다 낮게 떨어지면 GC 발생으로 간주(휴리스틱, 정확한 GC 카운트 아님) */
const GC_DROP_RATIO = 0.9;
const DEFAULT_HEAP_SAMPLE_INTERVAL_MS = 500;
/** 장시간(30분+) 실행에도 샘플 배열 자체가 무한정 누적되지 않도록 상한을 둔다 */
const MAX_RETAINED_SAMPLES = 4000;

export type MemorySample = {
  atMs: number;
  mainHeapBytes: number | null;
};

export type WorkerMemoryReport = {
  type: 'memory-report';
  workerName: string;
  usedJSHeapBytes: number | null;
  reportedAtMs: number;
};

/** 현재 컨텍스트(메인 스레드 또는 Worker 내부)의 JS heap 사용량(byte). Chrome 계열만 값 존재. */
export function readHeapBytes(): number | null {
  const perf = typeof performance !== 'undefined' ? performance : null;
  const mem = perf ? (perf as any).memory : null;
  return mem && Number.isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize : null;
}

export function bytesToMb(bytes: number | null | undefined): number | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  return bytes / (1024 * 1024);
}

export function formatMb(bytes: number | null | undefined): string {
  const mb = bytesToMb(bytes);
  return mb == null ? 'n/a (Chrome only)' : `${mb.toFixed(1)}MB`;
}

/** Canvas Pool 메모리 — RGBA 4byte/px 기준 정확 계산 (근사가 아님) */
export function estimateCanvasPoolMemoryBytes(width: number, height: number, poolSize: number): number {
  return Math.max(0, width) * Math.max(0, height) * 4 * Math.max(0, poolSize);
}

/**
 * 임의 오브젝트(스켈레톤 프레임 등)의 대략적인 메모리 사용량(byte)을 재귀적으로 추정한다.
 * JSON.stringify 같은 방식은 매 프레임 호출하면 CPU 비용이 커서 금지되어 있으므로,
 * 이 함수는 "대표 프레임 1개"에 대해 1회만 호출하고 그 결과(bytesPerFrame)를 재사용해야 한다.
 * pose/hand/face 등 필드 이름이 버전에 따라 달라져도 구조를 순회하며 근사하므로 안전하다.
 */
export function estimateObjectApproxBytes(value: unknown, depth = 0, maxDepth = 6): number {
  if (value == null) return 0;
  if (depth > maxDepth) return 8;
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return 8;
  if (t === 'string') return value.length * 2 + 8;
  if (t === 'function') return 0;
  if (Array.isArray(value)) {
    let sum = 24;
    for (let i = 0; i < value.length; i += 1) {
      sum += estimateObjectApproxBytes(value[i], depth + 1, maxDepth);
    }
    return sum;
  }
  if (t === 'object') {
    let sum = 24;
    for (const key of Object.keys(value as Record<string, unknown>)) {
      sum += key.length * 2 + estimateObjectApproxBytes((value as Record<string, unknown>)[key], depth + 1, maxDepth);
    }
    return sum;
  }
  return 8;
}

/**
 * Skeleton Frame 1개의 대략적인 메모리 사용량(byte) 추정.
 * `members`(최종 SkeletonFrameData) / `detectedPeople`(추출 중 엔진 내부 표현) 둘 다 지원한다.
 */
export function estimateBytesPerSkeletonFrame(sampleFrame: any): number {
  if (!sampleFrame) return 0;
  return estimateObjectApproxBytes(sampleFrame);
}

/** Frame Buffer(추출 중 frames[] 배열) 메모리 — O(1), 매 프레임 JSON.stringify 등 무거운 측정 금지 */
export function estimateFrameBufferMemoryBytes(frameCount: number, bytesPerFrame: number): number {
  return Math.max(0, frameCount) * Math.max(0, bytesPerFrame);
}

/** DanceDatabase 저장 시점 메모리 — skeletonFrames 크기 + Timeline/Audit 오버헤드(15% 근사) */
export function estimateDanceDatabaseMemoryBytes(danceDatabase: any): number {
  if (!danceDatabase?.skeletonFrames?.length) return 0;
  const bytesPerFrame = estimateBytesPerSkeletonFrame(danceDatabase.skeletonFrames[0]);
  return danceDatabase.skeletonFrames.length * bytesPerFrame * 1.15;
}

/**
 * 메인 스레드 heap을 주기적으로 샘플링해 Peak Heap과 GC 발생(휴리스틱)을 추적한다.
 * Stress Test(30분+)에서도 샘플 배열이 무한정 자라지 않도록 상한을 둔다.
 */
export function createHeapTrendTracker() {
  const samples: MemorySample[] = [];
  let peakBytes = 0;
  let gcEventCount = 0;
  let prevBytes: number | null = null;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const sampleOnce = () => {
    const heap = readHeapBytes();
    if (heap == null) return null;
    if (prevBytes != null && heap < prevBytes * GC_DROP_RATIO) {
      gcEventCount += 1;
    }
    prevBytes = heap;
    peakBytes = Math.max(peakBytes, heap);
    samples.push({ atMs: performance.now(), mainHeapBytes: heap });
    if (samples.length > MAX_RETAINED_SAMPLES) samples.shift();
    return heap;
  };

  const start = (intervalMs = DEFAULT_HEAP_SAMPLE_INTERVAL_MS) => {
    if (intervalHandle != null) return;
    sampleOnce();
    intervalHandle = setInterval(sampleOnce, intervalMs);
  };

  const stop = () => {
    if (intervalHandle != null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };

  const getStats = () => ({
    peakBytes,
    gcEventCount,
    latestBytes: prevBytes,
    samples: samples.slice(),
  });

  return { start, stop, sampleOnce, getStats };
}

/**
 * 시계열 heap 샘플의 선형회귀 기울기(byte/sec) — Stress Test에서 "메모리 누수 의심" 판정에 사용.
 * 프레임 수 증가에 따른 예상 선형 증가는 별도로 감안해야 하며, 이 함수는 순수 heap 추이만 계산한다.
 */
export function computeHeapTrendSlopeBytesPerSec(samples: MemorySample[]): number {
  const valid = (samples || []).filter((s) => Number.isFinite(s.mainHeapBytes));
  if (valid.length < 3) return 0;

  const t0 = valid[0].atMs;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  valid.forEach((s) => {
    const x = (s.atMs - t0) / 1000;
    const y = s.mainHeapBytes as number;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });
  const n = valid.length;
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-6) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Worker 내부에서 호출 — 주기적으로 자신의 heap 사용량을 메인 스레드로 보고한다. */
export function startWorkerMemoryReporter(
  workerName: string,
  postFn: (msg: WorkerMemoryReport) => void,
  intervalMs = 2000,
) {
  const tick = () => {
    postFn({
      type: 'memory-report',
      workerName,
      usedJSHeapBytes: readHeapBytes(),
      reportedAtMs: Date.now(),
    });
  };
  tick();
  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}

/** 메인 스레드에서 여러 Worker의 memory-report 메시지를 집계한다. */
export function createWorkerMemoryAggregator() {
  const byWorker = new Map<string, WorkerMemoryReport>();

  const ingest = (report: WorkerMemoryReport | null | undefined) => {
    if (!report || report.type !== 'memory-report') return;
    byWorker.set(report.workerName, report);
  };

  const totalBytes = () => {
    let sum = 0;
    let any = false;
    byWorker.forEach((r) => {
      if (Number.isFinite(r.usedJSHeapBytes)) {
        sum += r.usedJSHeapBytes as number;
        any = true;
      }
    });
    return any ? sum : null;
  };

  const snapshot = () => Array.from(byWorker.values());

  return { ingest, totalBytes, snapshot };
}

/** Heap + GPU 리소스 통합 스냅샷 — Debug Overlay / Telemetry용 */
export function createFullMemorySnapshot(workerAggregator?: ReturnType<typeof createWorkerMemoryAggregator>) {
  const heap = readHeapBytes();
  const gpu = getGpuResourceSnapshot();
  return {
    mainHeapBytes: heap,
    workerTotalBytes: workerAggregator?.totalBytes() ?? null,
    workerReports: workerAggregator?.snapshot() ?? [],
    gpu,
    sampledAtMs: Date.now(),
  };
}
