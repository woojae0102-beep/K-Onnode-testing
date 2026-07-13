// @ts-nocheck
import { scheduleVideoFrame, cancelVideoFrame } from './cameraFrameLoop';
import { getRvfcScheduleState } from './workerErrorDiagnostics';
import { waitForVideoEvent } from './choreoVideoUtils';
import { createRvfcStallDiagnostics, setRvfcDecodePath, setRvfcExternalDiagnosticsProvider } from './rvfcStallDiagnostics';
import { pipelineDiagnostics } from './pipelineDiagnostics';
import {
  markSamplerAborted,
  markSamplerFinalized,
  recordPromiseRejection,
  recordPropagationHop,
  resetPropagationSession,
} from './workerErrorDiagnostics';
import { markRvfcPlayStart, recordRvfcDiagEvent, resetRvfcDiagSession } from './rvfcDiagnosticLog';

export type VideoFrameSample = {
  time: number;
  video: HTMLVideoElement;
  /** RVFC metadata.mediaTime 기준 — 디코더 실제 타임라인 (Coverage 계산의 기준값) */
  mediaTime: number;
  /**
   * 캡처 시점에 고정된 프레임 스냅샷(Canvas/OffscreenCanvas).
   * RVFC 콜백에서 즉시 drawImage로 떠 둔 픽셀이므로, Processing Queue에서
   * 늦게 처리하더라도 video가 계속 재생되어 프레임이 바뀌는 문제가 없다.
   * MediaPipe detect 등에는 이 source를 사용해야 한다 (video 직접 사용 금지).
   */
  source: HTMLCanvasElement | OffscreenCanvas;
  /** 이 프레임이 캡처된 뒤 Processing Queue에서 대기한 시간(ms) — Queue Delay */
  queueDelayMs: number;
  /** 이 프레임을 꺼낸 시점에 Queue에 남아있던 나머지 프레임 수 (backlog) */
  queueLength: number;
  /** RVFC 콜백이 실제로 도착하는 속도(EMA, fps) — Processing 속도와 무관하게 Producer 단독 측정값 */
  rvfcFps: number;
};

export type StallInfo = {
  idleMs: number;
  nextSampleTime: number;
  endTime: number;
  reason: string;
  /** rvfc_idle: 디코더가 새 프레임을 안 줌 (치명적, 종료) / processing_delay: Queue 소비 지연 (경고 로그만) */
  kind: 'rvfc_idle' | 'processing_delay';
};

export type QueueOverflowInfo = {
  queueLength: number;
  droppedSampleTime: number;
  droppedFrames: number;
  /** Adaptive Backpressure가 현재 적용 중인 실질 Queue 상한 (maxQueueLength 이하) */
  effectiveMaxQueueLength: number;
};

export type SamplerReport = {
  videoDuration: number;
  lastMediaTime: number;
  lastProcessedFrame: number;
  coverage: number;
  queueLength: number;
  processingDelay: number;
  droppedFrames: number;
  rvfcCallbacks: number;
  rvfcFps: number;
  /** 전체 실행 중 관측된 Queue 최대 길이 — Backpressure 심각도 지표 */
  maxQueueLengthObserved: number;
  /** 종료 시점의 Adaptive Backpressure 실질 Queue 상한 */
  effectiveMaxQueueLength: number;
  /** 샘플 그리드 기준 Coverage (lastProcessedFrame / 기대 프레임 수) */
  timelineCoverage?: number;
  nextSampleTime?: number;
};

export type SampleVideoFramesOptions = {
  video: HTMLVideoElement;
  sampleFps: number;
  maxDuration?: number;
  /** Processing Queue 소비자 — MediaPipe/Tracking/Skeleton/Worker를 여기서 순차 처리한다 */
  onSample: (sample: VideoFrameSample) => void | Promise<void>;
  abortRef?: { current: boolean };
  onProgress?: (pct: number) => void;
  onDecode?: (decodeWaitMs: number) => void;
  /** RVFC가 이 시간(ms) 이상 새 프레임을 전달하지 않으면 치명적 Stall로 판단, 즉시 종료 */
  stallTimeoutMs?: number;
  /** Queue 소비(단일 프레임 처리)가 이 시간(ms) 이상 걸리면 경고 로그만 출력 (종료하지 않음) */
  processingStallTimeoutMs?: number;
  onStall?: (info: StallInfo) => void;
  /** Processing Queue 최대 길이 — 초과 시 Frame Drop */
  maxQueueLength?: number;
  onQueueOverflow?: (info: QueueOverflowInfo) => void;
  /** 종료 시 최종 리포트를 프로그램적으로도 받고 싶을 때 (console.table과 별개로 호출됨) */
  onReport?: (report: SamplerReport) => void;
  /** Motion Extraction 파이프라인/Worker 큐 등 외부 진단값 — Stall 덤프에 포함 */
  getExternalDiagnostics?: () => Record<string, unknown>;
};

const DEFAULT_MAX_QUEUE_LENGTH = 60;
const DEFAULT_STALL_TIMEOUT_MS = 8000;
/** RVFC 1회당 동기 drawImage 상한 — 이후 미처리 구간은 microtask로 catch-up */
const MAX_CAPTURES_SYNC_PER_RVFC = 16;
/** RVFC 1회당 catch-up 상한(동기+비동기 합) */
const MAX_CATCHUP_PER_RVFC = 120;
/** schedule>callback gap 감지 후 heal까지 대기(ms) */
const RVFC_GAP_HEAL_DELAY_MS = 400;
/** gap heal 최소 RVFC idle(ms) */
const RVFC_GAP_HEAL_MIN_IDLE_MS = 800;
/** gap heal 재시도 쿨다운(ms) */
const RVFC_GAP_HEAL_COOLDOWN_MS = 600;
const MAX_RVFC_HEAL_ATTEMPTS = 16;
const DEFAULT_PROCESSING_STALL_MS = 4000;

/** MediaPipe 등 장시간 sync 작업 사이 메인 스레드에 제어권 반환 */
const yieldMainThread = () => new Promise<void>((resolve) => {
  if (typeof globalThis.scheduler !== 'undefined' && typeof globalThis.scheduler.yield === 'function') {
    globalThis.scheduler.yield().then(resolve).catch(() => setTimeout(resolve, 0));
    return;
  }
  setTimeout(resolve, 0);
});
/** Adaptive Backpressure — 이 값 이하로는 절대 줄이지 않는다 (최소 버퍼 보장) */
const MIN_ADAPTIVE_QUEUE_LENGTH = 10;
/** 이만큼의 프레임을 처리할 때마다 Adaptive Backpressure 재평가 */
const ADAPTIVE_CHECK_INTERVAL_FRAMES = 15;

function supportsRvfc(video: HTMLVideoElement): boolean {
  return typeof video.requestVideoFrameCallback === 'function';
}

function createSnapshotCanvas(width: number, height: number) {
  const w = Math.max(1, width || 16);
  const h = Math.max(1, height || 16);
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(w, h);
    } catch {
      // 일부 환경에서 OffscreenCanvas 생성이 실패하면 일반 canvas로 폴백.
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * requestVideoFrameCallback 기반 Producer/Consumer 구조.
 *
 * [문제] 기존 구조는 RVFC 콜백 내부에서 `await onSample()`(MediaPipe 분석)을 직접
 * 수행했다. MediaPipe detect가 수십ms 걸리는 동안 다음 RVFC를 예약하지 못해
 * Frame Drop · Coverage 감소 · 브라우저 응답 없음 · Worker 병목이 발생했다.
 *
 * [해결] RVFC 콜백(Producer)은 오직 "현재 프레임을 캔버스에 캡처 → Queue에 push →
 * 즉시 다음 RVFC 예약"만 수행한다. 무거운 처리(onSample = MediaPipe/Tracking/
 * Skeleton/Worker)는 별도의 Processing Queue 소비 루프(Consumer)가 큐에서 순차적으로
 * 꺼내 처리하며, RVFC 스케줄링과 완전히 분리되어 있다.
 */
export async function sampleVideoFramesPlayback({
  video,
  sampleFps,
  maxDuration,
  onSample,
  abortRef,
  onProgress,
  onDecode,
  stallTimeoutMs = DEFAULT_STALL_TIMEOUT_MS,
  processingStallTimeoutMs = DEFAULT_PROCESSING_STALL_MS,
  maxQueueLength = DEFAULT_MAX_QUEUE_LENGTH,
  onStall,
  onQueueOverflow,
  onReport,
  getExternalDiagnostics,
}: SampleVideoFramesOptions): Promise<void> {
  if (!video) throw new Error('비디오 요소가 없습니다.');

  const sampleInterval = 1 / Math.max(1, sampleFps);
  const rawDuration = Number(video.duration) || 0;
  const endTime = maxDuration ?? rawDuration;

  if (!Number.isFinite(endTime) || endTime <= 0) {
    throw new Error('영상 길이를 확인할 수 없습니다.');
  }

  if (!supportsRvfc(video)) {
    throw new Error('requestVideoFrameCallback 미지원 브라우저입니다. Chrome/Edge 최신 버전을 사용해 주세요.');
  }

  video.muted = true;
  video.playsInline = true;
  video.playbackRate = 1;

  await waitForVideoEvent(video, 'canplay', 30000);
  if (video.currentTime > 0.05) {
    video.currentTime = 0;
  }

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;

  // 캔버스 풀 — 매 프레임 새 canvas를 만들지 않고 재사용해 GC 압박·메모리 폭증을 막는다.
  const poolSize = maxQueueLength + 4;
  const freeCanvases: Array<HTMLCanvasElement | OffscreenCanvas> = Array.from(
    { length: poolSize },
    () => createSnapshotCanvas(vw, vh),
  );
  const acquireCanvas = () => freeCanvases.pop() || createSnapshotCanvas(vw, vh);
  const releaseCanvas = (canvas: HTMLCanvasElement | OffscreenCanvas) => {
    if (canvas) freeCanvases.push(canvas);
  };

  type QueueItem = {
    sampleTime: number;
    mediaTime: number;
    canvas: HTMLCanvasElement | OffscreenCanvas;
    captureTime: number;
  };
  const queue: QueueItem[] = [];

  let nextSampleTime = 0;
  let handle = null;
  let settled = false;
  let producerDone = false;
  let consumerRunning = false;
  let aborted = false;

  let rvfcCallbackCount = 0;
  let droppedFrames = 0;
  let lastRvfcAt = performance.now();
  let lastRvfcIntervalAt = performance.now();
  let rvfcFps = 0;
  let lastMediaTime = 0;
  let lastProcessedFrame = -1;
  let lastProcessingDelay = 0;
  let processingStartedAt = 0;
  let maxQueueLengthObserved = 0;
  let watchdogHandle: ReturnType<typeof setInterval> | null = null;
  let rvfcGapDetectedAt: number | null = null;
  let rvfcHealAttempts = 0;
  let lastRvfcHealAt = 0;
  let scheduleNextRvfc: () => void = () => {};
  let forceRescheduleRvfc: (reason: string) => void = () => {};
  let detachTimeupdateHeal: (() => void) | null = null;
  let lastShouldReschedule = true;

  // Adaptive Backpressure — 메모리 사용량과 처리 지연을 근거로 Queue 실질 상한을
  // maxQueueLength(ceiling)와 MIN_ADAPTIVE_QUEUE_LENGTH(floor) 사이에서 자동 조절한다.
  let effectiveMaxQueueLength = maxQueueLength;
  let avgProcessingDelayMs = 0;
  let adaptiveCheckCounter = 0;
  const targetFrameBudgetMs = 1000 / Math.max(1, sampleFps);

  const getDiagCtx = () => ({
    nextSampleTime,
    endTime,
    producerDone,
    settled,
    aborted,
    samplerQueueLength: queue.length,
    rvfcCallbackCount,
    rvfcFps,
    lastRvfcIdleMs: performance.now() - lastRvfcAt,
    droppedFrames,
    shouldReschedule: lastShouldReschedule,
    stallTimeoutMs,
    rvfcHealAttempts,
  });

  const diagnostics = createRvfcStallDiagnostics(video);
  resetPropagationSession();
  resetRvfcDiagSession();
  if (getExternalDiagnostics) {
    setRvfcExternalDiagnosticsProvider(getExternalDiagnostics);
  }
  setRvfcDecodePath('rvfc');
  pipelineDiagnostics.startSession({
    video,
    decodePath: 'rvfc',
    metricsProvider: () => {
      const ext = getExternalDiagnostics?.() ?? {};
      return {
        samplerQueue: queue.length,
        rvfcFps,
        pipelineQueues: ext.pipelineStages
          ? Object.fromEntries(
            Object.entries(ext.pipelineStages as Record<string, { queueLength: number }>)
              .map(([k, v]) => [k, v.queueLength]),
          )
          : {},
        mediaPipeDelayMs: ext.lastMediaPipeDelayMs ?? 0,
        workerDelayMs: ext.lastWorkerDelayMs ?? 0,
        coverage: ext.coverage ?? 0,
        trackCount: ext.trackCount ?? 0,
        workerQueueLength: ext.workerQueueLength ?? 0,
        memoryMb: ext.memoryMb ?? null,
      };
    },
    stageStatsProvider: () => {
      const ext = getExternalDiagnostics?.() ?? {};
      const stages = ext.pipelineStages as Record<string, { queueLength: number; processedCount: number; droppedCount: number }> | undefined;
      if (!stages) return [];
      return Object.entries(stages).map(([name, s]) => ({
        name,
        queueLength: s.queueLength,
        processedCount: s.processedCount,
        droppedCount: s.droppedCount,
      }));
    },
  });
  diagnostics.startPeriodicLog(getDiagCtx);

  const adjustAdaptiveQueueLength = () => {
    adaptiveCheckCounter += 1;
    if (adaptiveCheckCounter % ADAPTIVE_CHECK_INTERVAL_FRAMES !== 0) return;
    const prev = effectiveMaxQueueLength;
    if (avgProcessingDelayMs > targetFrameBudgetMs * 1.5) {
      // Consumer가 목표 프레임 예산의 1.5배 이상 걸림 — Queue를 줄여 최신 프레임 우선 처리
      // 및 메모리 사용량 억제(오래된 캡처가 쌓이지 않도록 backlog 상한을 낮춘다).
      effectiveMaxQueueLength = Math.max(MIN_ADAPTIVE_QUEUE_LENGTH, Math.round(effectiveMaxQueueLength * 0.85));
    } else if (avgProcessingDelayMs < targetFrameBudgetMs * 0.6) {
      // Consumer에 여유가 있음 — 순간적 지연 스파이크에 대비해 버퍼 여유를 서서히 늘린다.
      effectiveMaxQueueLength = Math.min(maxQueueLength, effectiveMaxQueueLength + 4);
    }
    if (effectiveMaxQueueLength !== prev) {
      console.info('[VideoFrameSampler] Adaptive Backpressure 조정', {
        from: prev,
        to: effectiveMaxQueueLength,
        avgProcessingDelayMs: Math.round(avgProcessingDelayMs),
        targetFrameBudgetMs: Math.round(targetFrameBudgetMs),
      });
    }
  };

  let resolveRef: (() => void) | null = null;
  let rejectRef: ((err: unknown) => void) | null = null;

  const emitReport = () => {
    const expectedFrames = Math.max(1, Math.round(endTime * sampleFps));
    const timelineCoverage = Math.min(1, (lastProcessedFrame + 1) / expectedFrames);
    const report: SamplerReport = {
      videoDuration: endTime,
      lastMediaTime,
      lastProcessedFrame,
      coverage: timelineCoverage,
      timelineCoverage,
      nextSampleTime,
      queueLength: queue.length,
      processingDelay: lastProcessingDelay,
      droppedFrames,
      rvfcCallbacks: rvfcCallbackCount,
      rvfcFps,
      maxQueueLengthObserved,
      effectiveMaxQueueLength,
    };
    console.table({ 'Video Frame Sampler': report });
    onReport?.(report);
  };

  const stopWatchdog = () => {
    if (watchdogHandle != null) {
      clearInterval(watchdogHandle);
      watchdogHandle = null;
    }
  };

  const finalize = (err?: unknown) => {
    if (settled) return;
    settled = true;
    stopWatchdog();
    detachTimeupdateHeal?.();
    detachTimeupdateHeal = null;
    diagnostics.detach();
    setRvfcExternalDiagnosticsProvider(null);
    pipelineDiagnostics.endSession();
    if (err) {
      recordPromiseRejection('videoFrameSampler.finalize', err);
      markSamplerFinalized(err instanceof Error ? err.message : String(err));
    } else {
      markSamplerFinalized('normal');
    }
    recordPropagationHop('videoFrameSampler.finalize', err ? String(err) : 'ok', { propagatedToSampler: true });
    video.pause();
    cancelVideoFrame(handle);
    handle = null;
    // 남은 큐 아이템은 더 이상 처리하지 않으므로 캔버스를 회수해 참조를 끊는다.
    queue.length = 0;
    emitReport();
    if (err) rejectRef?.(err);
    else resolveRef?.();
  };

  const tryFinalizeIfDrained = () => {
    if (settled) return;
    if ((producerDone || aborted) && queue.length === 0 && !consumerRunning) {
      finalize();
    }
  };

  /** Consumer — 프레임 1개씩 처리 후 yield. while 루프 전체 점유 시 Watchdog/RVFC heal starvation 방지 */
  const pumpQueue = async () => {
    if (consumerRunning || settled || !queue.length) return;
    consumerRunning = true;
    let item: QueueItem | undefined;
    try {
      if (aborted) {
        queue.length = 0;
        return;
      }
      item = queue.shift();
      if (!item) return;
      pipelineDiagnostics.markTimeline(item.sampleTime, 'queue-exit');
      processingStartedAt = performance.now();
      const queueDelayMs = Math.max(0, processingStartedAt - item.captureTime);
      try {
        await onSample({
          time: item.sampleTime,
          video,
          mediaTime: item.mediaTime,
          source: item.canvas,
          queueDelayMs,
          queueLength: queue.length,
          rvfcFps,
        });
      } catch (err) {
        releaseCanvas(item.canvas);
        recordPromiseRejection('videoFrameSampler.pumpQueue.onSample', err);
        recordPropagationHop('videoFrameSampler.pumpQueue→finalize', (err as Error)?.message, { propagatedToSampler: true });
        finalize(err);
        return;
      }
      lastProcessingDelay = performance.now() - processingStartedAt;
      avgProcessingDelayMs = avgProcessingDelayMs > 0
        ? avgProcessingDelayMs * 0.9 + lastProcessingDelay * 0.1
        : lastProcessingDelay;
      adjustAdaptiveQueueLength();
      processingStartedAt = 0;
      lastProcessedFrame += 1;
      lastMediaTime = Math.max(lastMediaTime, item.mediaTime);
      releaseCanvas(item.canvas);
      onProgress?.(Math.min(99, Math.round((item.sampleTime / endTime) * 100)));

      if (abortRef?.current) {
        aborted = true;
        markSamplerAborted();
        queue.length = 0;
      }
    } finally {
      consumerRunning = false;
      if (item) {
        if (queue.length && !settled && !aborted) {
          await yieldMainThread();
          void pumpQueue();
        }
        tryFinalizeIfDrained();
      }
    }
  };

  /**
   * Producer 측 캡처 — 큐가 (Adaptive) 상한을 넘으면 이번 프레임은 드롭(Backpressure),
   * RVFC는 계속 진행한다. 상한 자체는 처리 지연에 따라 adjustAdaptiveQueueLength()가
   * maxQueueLength(ceiling)~MIN_ADAPTIVE_QUEUE_LENGTH(floor) 사이에서 조절한다.
   */
  const enqueueCapture = (sampleTime: number, mediaTime: number) => {
    if (queue.length >= effectiveMaxQueueLength) {
      droppedFrames += 1;
      onQueueOverflow?.({
        queueLength: queue.length,
        droppedSampleTime: sampleTime,
        droppedFrames,
        effectiveMaxQueueLength,
      });
      return;
    }
    const canvas = acquireCanvas();
    const ctx = canvas.getContext?.('2d');
    if (ctx) {
      if (canvas.width !== vw) canvas.width = vw;
      if (canvas.height !== vh) canvas.height = vh;
      ctx.drawImage(video, 0, 0, vw, vh);
    }
    queue.push({ sampleTime, mediaTime, canvas, captureTime: performance.now() });
    pipelineDiagnostics.markTimeline(sampleTime, 'capture');
    pipelineDiagnostics.markTimeline(sampleTime, 'queue-enter');
    maxQueueLengthObserved = Math.max(maxQueueLengthObserved, queue.length);
  };

  const getTimelineCoverage = () => {
    const expectedFrames = Math.max(1, Math.round(endTime * sampleFps));
    return Math.min(1, (lastProcessedFrame + 1) / expectedFrames);
  };

  const enqueueCatchUp = (mediaTime: number, maxCount: number) => {
    let n = 0;
    while (
      n < maxCount
      && nextSampleTime <= endTime
      && mediaTime + 1e-3 >= nextSampleTime
      && queue.length < effectiveMaxQueueLength
    ) {
      const sampleTime = nextSampleTime;
      nextSampleTime += sampleInterval;
      enqueueCapture(sampleTime, mediaTime);
      n += 1;
    }
    return n;
  };

  const scheduleDeferredCatchUp = (mediaTime: number, totalBudget: number) => {
    let used = 0;
    const run = () => {
      if (settled || producerDone || aborted || used >= totalBudget) return;
      const batch = enqueueCatchUp(
        mediaTime,
        Math.min(24, totalBudget - used),
      );
      used += batch;
      if (queue.length && !consumerRunning) void pumpQueue();
      if (
        used < totalBudget
        && nextSampleTime <= endTime
        && mediaTime + 1e-3 >= nextSampleTime
        && queue.length < effectiveMaxQueueLength
      ) {
        queueMicrotask(run);
      }
    };
    queueMicrotask(run);
  };

  const flushSamplesThroughEnd = (mediaTime: number) => {
    while (nextSampleTime <= endTime + 1e-3 && queue.length < effectiveMaxQueueLength) {
      const sampleTime = Math.min(nextSampleTime, endTime);
      nextSampleTime += sampleInterval;
      enqueueCapture(sampleTime, mediaTime);
    }
  };

  const tryGracefulVideoEnd = () => {
    if (settled || producerDone || aborted) return false;
    const atEnd = video.ended || Number(video.currentTime) >= endTime - 0.05;
    if (!atEnd) return false;
    const mt = Math.min(Number(video.currentTime) || endTime, endTime);
    flushSamplesThroughEnd(mt);
    producerDone = true;
    lastShouldReschedule = false;
    cancelVideoFrame(handle);
    handle = null;
    if (queue.length && !consumerRunning) void pumpQueue();
    tryFinalizeIfDrained();
    return true;
  };

  await new Promise<void>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;

    forceRescheduleRvfc = (reason: string) => {
      if (settled || producerDone || aborted) return;
      const now = performance.now();
      if (now - lastRvfcHealAt < RVFC_GAP_HEAL_COOLDOWN_MS) return;
      lastRvfcHealAt = now;
      cancelVideoFrame(handle);
      handle = null;
      rvfcHealAttempts += 1;
      recordRvfcDiagEvent('RVFC gap heal', { reason, attempt: rvfcHealAttempts });
      console.warn('[VideoFrameSampler] RVFC gap heal — orphan cancel & reschedule', {
        reason,
        attempt: rvfcHealAttempts,
        scheduleCalls: getRvfcScheduleState().scheduleCallCount,
        callbackCalls: getRvfcScheduleState().callbackCallCount,
      });
      handle = scheduleVideoFrame(video, onFrame);
      diagnostics.recordSchedule(handle);
      rvfcGapDetectedAt = null;
    };

    scheduleNextRvfc = () => {
      cancelVideoFrame(handle);
      if (settled || producerDone || aborted) return;
      handle = scheduleVideoFrame(video, onFrame);
      diagnostics.recordSchedule(handle);
    };

    const tryRvfcGapHeal = (rvfcIdleMs: number, scheduleAhead: boolean) => {
      if (settled || producerDone || aborted || video.paused || video.ended) return false;
      const shouldHeal = scheduleAhead
        || rvfcIdleMs > RVFC_GAP_HEAL_MIN_IDLE_MS;
      if (!shouldHeal) {
        rvfcGapDetectedAt = null;
        return false;
      }
      if (rvfcGapDetectedAt == null) rvfcGapDetectedAt = performance.now();
      const gapMs = performance.now() - rvfcGapDetectedAt;
      if (gapMs < RVFC_GAP_HEAL_DELAY_MS) return false;
      if (rvfcHealAttempts >= MAX_RVFC_HEAL_ATTEMPTS) return false;
      const healReason = scheduleAhead
        ? `schedule(${getRvfcScheduleState().scheduleCallCount})>callback(${getRvfcScheduleState().callbackCallCount})`
        : `rvfcIdle=${Math.round(rvfcIdleMs)}ms`;
      forceRescheduleRvfc(healReason);
      return true;
    };

    const onTimeupdateHeal = () => {
      if (settled || producerDone || aborted || video.ended) return;
      const rvfcState = getRvfcScheduleState();
      if (rvfcState.scheduleCallCount <= rvfcState.callbackCallCount) return;
      const rvfcIdleMs = performance.now() - lastRvfcAt;
      if (rvfcIdleMs < RVFC_GAP_HEAL_MIN_IDLE_MS) return;
      forceRescheduleRvfc('timeupdate-schedule-ahead');
    };
    video.addEventListener('timeupdate', onTimeupdateHeal);
    detachTimeupdateHeal = () => video.removeEventListener('timeupdate', onTimeupdateHeal);

    const watchdogIntervalMs = Math.min(1000, Math.max(250, Math.min(stallTimeoutMs, processingStallTimeoutMs) / 4));
    watchdogHandle = setInterval(() => {
      if (settled) return;

      const rvfcIdleMs = performance.now() - lastRvfcAt;
      const rvfcState = getRvfcScheduleState();
      const scheduleAhead = rvfcState.scheduleCallCount > rvfcState.callbackCallCount;

      if (tryGracefulVideoEnd()) return;

      const healed = tryRvfcGapHeal(rvfcIdleMs, scheduleAhead);

      if (rvfcIdleMs > stallTimeoutMs) {
        const timelineCov = getTimelineCoverage();
        if (video.ended || timelineCov >= 0.85) {
          console.info('[VideoFrameSampler] RVFC idle after video end / sufficient timeline coverage — 정상 종료', {
            timelineCoverage: timelineCov,
            nextSampleTime,
            lastProcessedFrame,
            rvfcIdleMs: Math.round(rvfcIdleMs),
          });
          producerDone = true;
          detachTimeupdateHeal?.();
          finalize();
          return;
        }
        if (!healed && scheduleAhead && rvfcHealAttempts < MAX_RVFC_HEAL_ATTEMPTS) {
          forceRescheduleRvfc('last-chance-before-stall');
          return;
        }
        const reason =
          `RVFC Stall 감지: ${(rvfcIdleMs / 1000).toFixed(1)}s 동안 새 비디오 프레임 없음 `
          + `(nextSampleTime=${nextSampleTime.toFixed(2)}s / endTime=${endTime.toFixed(2)}s) `
          + '— Coverage 확보가 불가능하다고 판단, 즉시 종료합니다.';
        diagnostics.dumpStall(reason, { ...getDiagCtx(), lastRvfcIdleMs: rvfcIdleMs });
        onStall?.({ idleMs: rvfcIdleMs, nextSampleTime, endTime, reason, kind: 'rvfc_idle' });
        detachTimeupdateHeal?.();
        finalize(new Error(reason));
        return;
      }

      // [요구사항 4-b] Queue 소비(단일 프레임 처리)가 오래 걸리는 경우 — 로그만 출력, 종료하지 않음.
      if (processingStartedAt > 0) {
        const processingIdleMs = performance.now() - processingStartedAt;
        if (processingIdleMs > processingStallTimeoutMs) {
          const reason =
            `Processing Delay 초과: ${(processingIdleMs / 1000).toFixed(1)}s 동안 프레임 처리 중 `
            + `(queueLength=${queue.length}, maxQueueLength=${maxQueueLength})`;
          console.warn('[VideoFrameSampler]', reason);
          onStall?.({ idleMs: processingIdleMs, nextSampleTime, endTime, reason, kind: 'processing_delay' });
        }
      }
    }, watchdogIntervalMs);

    const onFrame = (_now: number, metadata?: { mediaTime?: number }) => {
      let shouldReschedule = true;
      try {
        rvfcCallbackCount += 1;
        rvfcGapDetectedAt = null;
        const frameArrivedAt = performance.now();
        onDecode?.(frameArrivedAt - lastRvfcAt);
        lastRvfcAt = frameArrivedAt;

        // Producer 단독 RVFC 도착 속도 — Processing(Consumer) 지연과 무관한 측정값.
        const rvfcIntervalMs = frameArrivedAt - lastRvfcIntervalAt;
        lastRvfcIntervalAt = frameArrivedAt;
        if (rvfcIntervalMs > 0) {
          const instantFps = 1000 / rvfcIntervalMs;
          rvfcFps = rvfcFps > 0 ? rvfcFps * 0.85 + instantFps * 0.15 : instantFps;
        }

        if (settled) return;

        if (abortRef?.current) {
          aborted = true;
          producerDone = true;
          markSamplerAborted();
          shouldReschedule = false;
          tryFinalizeIfDrained();
          return;
        }

        const metadataTime = metadata?.mediaTime;
        const currentTime = Number(video.currentTime) || 0;
        const mediaTime = Number.isFinite(metadataTime) ? metadataTime : currentTime;
        diagnostics.recordOnFrame(mediaTime);

        const reachedDuration = mediaTime >= endTime - 0.05;

        const pendingSamples = nextSampleTime <= endTime && mediaTime + 1e-3 >= nextSampleTime
          ? Math.ceil((mediaTime - nextSampleTime + sampleInterval) / sampleInterval)
          : 0;

        if (pendingSamples > 0) {
          const catchUpBudget = Math.min(MAX_CATCHUP_PER_RVFC, pendingSamples);
          const syncCount = enqueueCatchUp(mediaTime, Math.min(MAX_CAPTURES_SYNC_PER_RVFC, catchUpBudget));
          if (syncCount < catchUpBudget) {
            scheduleDeferredCatchUp(mediaTime, catchUpBudget - syncCount);
          }
        }

        const videoEnded = video.ended || reachedDuration;
        if (videoEnded) {
          flushSamplesThroughEnd(mediaTime);
          producerDone = true;
          shouldReschedule = false;
        }
      } catch (err) {
        diagnostics.recordOnFrameError(err);
        // 예외가 나도 Producer 체인은 유지 — scheduleVideoFrame이 끊기면 RVFC는 영원히 안 온다.
      } finally {
        lastShouldReschedule = shouldReschedule;
        // RVFC 재등록을 Consumer(MediaPipe)보다 먼저 — 동기 pumpQueue가 callback 등록을 밀어내는 것 방지.
        if (!settled && shouldReschedule && !producerDone && !aborted) {
          scheduleNextRvfc();
        }
        if (queue.length && !consumerRunning) {
          queueMicrotask(() => {
            void pumpQueue();
          });
        }
        tryFinalizeIfDrained();
      }
    };

    video.play().then(() => {
      markRvfcPlayStart();
      scheduleNextRvfc();
    }).catch((err) => {
      diagnostics.dumpStall(`video.play() 실패: ${err?.message || err}`, getDiagCtx());
      producerDone = true;
      finalize(err);
    });
  });
}
