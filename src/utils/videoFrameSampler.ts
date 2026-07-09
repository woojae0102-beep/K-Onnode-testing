// @ts-nocheck
import { scheduleVideoFrame, cancelVideoFrame } from './cameraFrameLoop';
import { waitForVideoEvent } from './choreoVideoUtils';

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
};

const DEFAULT_MAX_QUEUE_LENGTH = 60;
const DEFAULT_STALL_TIMEOUT_MS = 8000;
const DEFAULT_PROCESSING_STALL_MS = 4000;

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

  type QueueItem = { sampleTime: number; mediaTime: number; canvas: HTMLCanvasElement | OffscreenCanvas };
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
  let lastMediaTime = 0;
  let lastProcessedFrame = -1;
  let lastProcessingDelay = 0;
  let processingStartedAt = 0;
  let watchdogHandle: ReturnType<typeof setInterval> | null = null;

  let resolveRef: (() => void) | null = null;
  let rejectRef: ((err: unknown) => void) | null = null;

  const emitReport = () => {
    const coverage = endTime > 0 ? Math.min(1, lastMediaTime / endTime) : 0;
    const report: SamplerReport = {
      videoDuration: endTime,
      lastMediaTime,
      lastProcessedFrame,
      coverage,
      queueLength: queue.length,
      processingDelay: lastProcessingDelay,
      droppedFrames,
      rvfcCallbacks: rvfcCallbackCount,
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

  /** Consumer — Processing Queue에서 MediaPipe → Tracking → Skeleton → Worker를 순차 처리 */
  const pumpQueue = async () => {
    if (consumerRunning || settled) return;
    consumerRunning = true;
    try {
      while (queue.length && !settled) {
        if (aborted) {
          queue.length = 0;
          break;
        }
        const item = queue.shift();
        processingStartedAt = performance.now();
        try {
          await onSample({ time: item.sampleTime, video, mediaTime: item.mediaTime, source: item.canvas });
        } catch (err) {
          releaseCanvas(item.canvas);
          finalize(err);
          return;
        }
        lastProcessingDelay = performance.now() - processingStartedAt;
        processingStartedAt = 0;
        lastProcessedFrame += 1;
        lastMediaTime = Math.max(lastMediaTime, item.mediaTime);
        releaseCanvas(item.canvas);
        onProgress?.(Math.min(99, Math.round((item.sampleTime / endTime) * 100)));

        if (abortRef?.current) {
          aborted = true;
          queue.length = 0;
          break;
        }
      }
    } finally {
      consumerRunning = false;
      tryFinalizeIfDrained();
    }
  };

  /** Producer 측 캡처 — 큐가 가득 차면 이번 프레임은 드롭(Backpressure), RVFC는 계속 진행 */
  const enqueueCapture = (sampleTime: number, mediaTime: number) => {
    if (queue.length >= maxQueueLength) {
      droppedFrames += 1;
      onQueueOverflow?.({ queueLength: queue.length, droppedSampleTime: sampleTime, droppedFrames });
      return;
    }
    const canvas = acquireCanvas();
    const ctx = canvas.getContext?.('2d');
    if (ctx) {
      if (canvas.width !== vw) canvas.width = vw;
      if (canvas.height !== vh) canvas.height = vh;
      ctx.drawImage(video, 0, 0, vw, vh);
    }
    queue.push({ sampleTime, mediaTime, canvas });
  };

  await new Promise<void>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;

    const watchdogIntervalMs = Math.min(1000, Math.max(250, Math.min(stallTimeoutMs, processingStallTimeoutMs) / 4));
    watchdogHandle = setInterval(() => {
      if (settled) return;

      // [요구사항 4-a] RVFC 수신 자체가 멈춘 경우 — 디코더 정지, Coverage 확보 불가로 확정 → 즉시 종료.
      const rvfcIdleMs = performance.now() - lastRvfcAt;
      if (rvfcIdleMs > stallTimeoutMs) {
        const reason =
          `RVFC Stall 감지: ${(rvfcIdleMs / 1000).toFixed(1)}s 동안 새 비디오 프레임 없음 `
          + `(nextSampleTime=${nextSampleTime.toFixed(2)}s / endTime=${endTime.toFixed(2)}s) `
          + '— Coverage 확보가 불가능하다고 판단, 즉시 종료합니다.';
        onStall?.({ idleMs: rvfcIdleMs, nextSampleTime, endTime, reason, kind: 'rvfc_idle' });
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
      rvfcCallbackCount += 1;
      const frameArrivedAt = performance.now();
      onDecode?.(frameArrivedAt - lastRvfcAt);
      lastRvfcAt = frameArrivedAt;

      if (settled) return;

      if (abortRef?.current) {
        aborted = true;
        producerDone = true;
        tryFinalizeIfDrained();
        return;
      }

      // [요구사항 5] currentTime 대신 metadata.mediaTime을 Timeline/Coverage 기준으로 사용.
      // (디코더가 실제로 디코드한 프레임 시각이므로 currentTime보다 정확하다)
      const metadataTime = metadata?.mediaTime;
      const currentTime = Number(video.currentTime) || 0;
      const mediaTime = Number.isFinite(metadataTime) ? metadataTime : currentTime;
      const reachedDuration = mediaTime >= endTime - 0.05;

      // Producer: 캡처만 수행 — 절대 await onSample() 하지 않는다.
      while (nextSampleTime <= endTime && mediaTime + 1e-3 >= nextSampleTime) {
        const sampleTime = nextSampleTime;
        nextSampleTime += sampleInterval;
        enqueueCapture(sampleTime, mediaTime);
      }

      const videoEnded = video.ended || reachedDuration;
      if (videoEnded) {
        // 영상이 끝났으므로 새 프레임을 더 받을 수 없다 — 남은 그리드는 마지막 프레임으로 flush.
        while (nextSampleTime <= endTime + 1e-3) {
          const sampleTime = Math.min(nextSampleTime, endTime);
          nextSampleTime += sampleInterval;
          enqueueCapture(sampleTime, mediaTime);
        }
        producerDone = true;
      } else {
        // 요구사항 1 — Queue push 직후 즉시 다음 RVFC를 예약한다 (MediaPipe 완료 대기 없음).
        handle = scheduleVideoFrame(video, onFrame);
      }

      if (queue.length && !consumerRunning) {
        void pumpQueue();
      }
      tryFinalizeIfDrained();
    };

    video.play().then(() => {
      handle = scheduleVideoFrame(video, onFrame);
    }).catch((err) => {
      producerDone = true;
      finalize(err);
    });
  });
}
