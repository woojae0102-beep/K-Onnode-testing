// @ts-nocheck
/**
 * Async Pipeline Queue — 독립 Stage 큐 팩토리.
 *
 * 각 Stage는 자체 backlog / Adaptive Backpressure / queueDelayMs 계측을 가지며,
 * handler 완료 후 next Stage로 push만 하고 자신은 다음 아이템을 계속 소비한다.
 * 한 Stage의 지연이 다른 Stage의 enqueue를 막지 않는다(각자 maxQueueLength 상한).
 */

export type PipelineStageItem<T> = {
  payload: T;
  enqueuedAt: number;
};

export type PipelineStageStats = {
  name: string;
  queueLength: number;
  maxQueueLengthObserved: number;
  effectiveMaxQueueLength: number;
  droppedCount: number;
  processedCount: number;
  avgProcessingDelayMs: number;
  lastQueueDelayMs: number;
};

export type CreatePipelineStageOptions<TIn, TOut> = {
  name: string;
  /** ceiling — Adaptive Backpressure가 이 값 이하로만 조절 */
  maxQueueLength?: number;
  /** floor — Adaptive Backpressure 최소 상한 */
  minQueueLength?: number;
  /** 목표 프레임 예산(ms) — Adaptive Backpressure 기준. 미지정 시 100ms */
  targetFrameBudgetMs?: number;
  handler: (item: TIn, meta: { queueDelayMs: number; queueLength: number }) => Promise<TOut> | TOut;
  onDrop?: (info: { queueLength: number; droppedCount: number; effectiveMaxQueueLength: number }) => void;
  onStats?: (stats: PipelineStageStats) => void;
};

const DEFAULT_MAX_QUEUE = 60;
const DEFAULT_MIN_QUEUE = 10;
const ADAPTIVE_CHECK_INTERVAL = 15;

export function createPipelineStage<TIn, TOut>({
  name,
  maxQueueLength = DEFAULT_MAX_QUEUE,
  minQueueLength = DEFAULT_MIN_QUEUE,
  targetFrameBudgetMs = 100,
  handler,
  onDrop,
  onStats,
}: CreatePipelineStageOptions<TIn, TOut>) {
  const queue: PipelineStageItem<TIn>[] = [];
  let consumerRunning = false;
  let settled = false;
  let droppedCount = 0;
  let processedCount = 0;
  let maxQueueLengthObserved = 0;
  let effectiveMaxQueueLength = maxQueueLength;
  let avgProcessingDelayMs = 0;
  let lastQueueDelayMs = 0;
  let adaptiveCheckCounter = 0;

  let nextStage: { push: (item: TOut) => void } | null = null;

  const adjustAdaptiveQueueLength = () => {
    adaptiveCheckCounter += 1;
    if (adaptiveCheckCounter % ADAPTIVE_CHECK_INTERVAL !== 0) return;
    const prev = effectiveMaxQueueLength;
    if (avgProcessingDelayMs > targetFrameBudgetMs * 1.5) {
      effectiveMaxQueueLength = Math.max(minQueueLength, Math.round(effectiveMaxQueueLength * 0.85));
    } else if (avgProcessingDelayMs < targetFrameBudgetMs * 0.6) {
      effectiveMaxQueueLength = Math.min(maxQueueLength, effectiveMaxQueueLength + 4);
    }
    if (effectiveMaxQueueLength !== prev) {
      console.info(`[PipelineStage:${name}] Adaptive Backpressure`, {
        from: prev,
        to: effectiveMaxQueueLength,
        avgProcessingDelayMs: Math.round(avgProcessingDelayMs),
      });
    }
  };

  const emitStats = () => {
    onStats?.({
      name,
      queueLength: queue.length,
      maxQueueLengthObserved,
      effectiveMaxQueueLength,
      droppedCount,
      processedCount,
      avgProcessingDelayMs,
      lastQueueDelayMs,
    });
  };

  const pump = async () => {
    if (consumerRunning || settled) return;
    consumerRunning = true;
    try {
      while (queue.length && !settled) {
        const item = queue.shift();
        const startedAt = performance.now();
        const queueDelayMs = Math.max(0, startedAt - item.enqueuedAt);
        lastQueueDelayMs = queueDelayMs;
        try {
          const result = await handler(item.payload, {
            queueDelayMs,
            queueLength: queue.length,
          });
          const processingMs = performance.now() - startedAt;
          avgProcessingDelayMs = avgProcessingDelayMs > 0
            ? avgProcessingDelayMs * 0.9 + processingMs * 0.1
            : processingMs;
          adjustAdaptiveQueueLength();
          processedCount += 1;
          if (result != null && nextStage) {
            nextStage.push(result);
          }
          emitStats();
        } catch (err) {
          consumerRunning = false;
          throw err;
        }
      }
    } finally {
      consumerRunning = false;
    }
  };

  const push = (payload: TIn) => {
    if (settled) return false;
    if (queue.length >= effectiveMaxQueueLength) {
      droppedCount += 1;
      onDrop?.({ queueLength: queue.length, droppedCount, effectiveMaxQueueLength });
      emitStats();
      return false;
    }
    queue.push({ payload, enqueuedAt: performance.now() });
    maxQueueLengthObserved = Math.max(maxQueueLengthObserved, queue.length);
    if (!consumerRunning) void pump();
    return true;
  };

  const pipeTo = <TNext>(stage: { push: (item: TNext) => void }) => {
    nextStage = stage;
    return stage;
  };

  const drain = async () => {
    while (queue.length || consumerRunning) {
      if (!consumerRunning && queue.length) await pump();
      else await new Promise((r) => setTimeout(r, 4));
    }
  };

  const close = () => {
    settled = true;
    queue.length = 0;
  };

  const getStats = (): PipelineStageStats => ({
    name,
    queueLength: queue.length,
    maxQueueLengthObserved,
    effectiveMaxQueueLength,
    droppedCount,
    processedCount,
    avgProcessingDelayMs,
    lastQueueDelayMs,
  });

  return { name, push, pipeTo, drain, close, getStats, pump };
}

export type PipelineChain = {
  stages: Array<ReturnType<typeof createPipelineStage>>;
  close: () => void;
  drain: () => Promise<void>;
  getAllStats: () => PipelineStageStats[];
};
