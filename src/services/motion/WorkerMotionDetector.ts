// @ts-nocheck
/**
 * WorkerMotionDetector — MediaPipe detect()를 Worker에서 실행하는 래퍼.
 * Capability Probe 실패 시 메인 스레드 MultiLandmarkerDetector로 폴백한다.
 */
import { createMultiLandmarkerDetector } from './MultiLandmarkerDetector';
import type { MultiLandmarkerDetectResult, MultiLandmarkerDetector } from './MultiLandmarkerDetector';
import { pipelineRegistry } from '../../utils/pipelineEventBus';
import { isMotionWorkerEnabled, isForceMainThreadMediaPipe } from '../../config/pipelineConfig';
import { createManagedWorker, type ManagedWorkerHandle } from '../../utils/workerRecovery';
import { recordMediaPipeError } from '../../utils/pipelineTelemetry';

const PROBE_TIMEOUT_MS = 3000;
let cachedWorkerCapable: boolean | null = null;

export type MotionDetectorLike = MultiLandmarkerDetector & {
  isWorkerBacked?: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function probeWorkerMotionDetection(config: {
  groupMemberCount: number;
  modelVariant?: string;
  runningMode?: 'IMAGE' | 'VIDEO';
  lenient?: boolean;
}): Promise<boolean> {
  if (typeof Worker === 'undefined') return false;
  if (typeof OffscreenCanvas === 'undefined') return false;

  return new Promise((resolve) => {
    let worker: Worker | null = null;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      worker?.terminate();
      resolve(ok);
    };

    try {
      worker = new Worker(new URL('../../workers/motionDetectionWorker.ts', import.meta.url), {
        type: 'module',
        name: 'motion-detection-probe',
      });
    } catch {
      finish(false);
      return;
    }

    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);

    worker.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === 'PROBE_OK') {
        clearTimeout(timer);
        finish(true);
      } else if (msg.type === 'PROBE_FAIL') {
        clearTimeout(timer);
        finish(false);
      }
    };
    worker.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    worker.postMessage({ type: 'PROBE', config });
  });
}

/** 앱 시작 시 1회 호출 권장 — 결과를 캐시해 이후 createMotionDetector에서 재사용 */
export async function probeMotionDetectionWorkerSupport(config: {
  groupMemberCount?: number;
  modelVariant?: string;
} = {}): Promise<boolean> {
  if (cachedWorkerCapable != null) return cachedWorkerCapable;
  cachedWorkerCapable = await probeWorkerMotionDetection({
    groupMemberCount: config.groupMemberCount ?? 5,
    modelVariant: config.modelVariant ?? 'lite',
    runningMode: 'VIDEO',
  });
  console.info('[WorkerMotionDetector] Capability Probe', { workerCapable: cachedWorkerCapable });
  return cachedWorkerCapable;
}

class WorkerBackedMotionDetector implements MotionDetectorLike {
  isWorkerBacked = true;
  delegate: 'GPU' | 'CPU' = 'CPU';
  runningMode: 'IMAGE' | 'VIDEO' = 'VIDEO';
  modelVariant: string = 'lite';

  private managed: ManagedWorkerHandle;
  private pending = new Map<number, {
    resolve: (r: MultiLandmarkerDetectResult) => void;
    reject: (e: Error) => void;
  }>();
  private nextRequestId = 0;
  private unregister: () => void;
  private onMessageBound: (event: MessageEvent) => void;

  constructor(managed: ManagedWorkerHandle, initInfo: { delegate?: string; runningMode?: string; modelVariant?: string }) {
    this.managed = managed;
    this.delegate = initInfo.delegate === 'GPU' ? 'GPU' : 'CPU';
    this.runningMode = (initInfo.runningMode as 'IMAGE' | 'VIDEO') || 'VIDEO';
    this.modelVariant = initInfo.modelVariant || 'lite';
    this.onMessageBound = (event) => this.onMessage(event);
    this.managed.addEventListener('message', this.onMessageBound);
    this.unregister = pipelineRegistry.register({
      name: 'motionDetectionWorker',
      subsystem: 'motion-extraction',
      kind: 'worker',
      meta: { delegate: this.delegate },
    });
  }

  private onMessage(event: MessageEvent) {
    const msg = event.data || {};
    if (msg.type === 'DETECT_RESULT' || msg.type === 'DETECT_ERROR') {
      const pending = this.pending.get(msg.requestId);
      if (!pending) return;
      this.pending.delete(msg.requestId);
      if (msg.type === 'DETECT_ERROR') {
        recordMediaPipeError(msg.error || 'Worker detect failed', { requestId: msg.requestId });
        pending.reject(new Error(msg.error || 'Worker detect failed'));
      } else {
        pending.resolve(msg.results as MultiLandmarkerDetectResult);
      }
    }
  }

  private async sourceToBitmap(source: unknown): Promise<ImageBitmap> {
    if (source instanceof ImageBitmap) return source;
    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
      return source.transferToImageBitmap();
    }
    if (source instanceof HTMLCanvasElement) {
      return createImageBitmap(source);
    }
    if (source instanceof HTMLVideoElement) {
      const c = document.createElement('canvas');
      c.width = source.videoWidth || 640;
      c.height = source.videoHeight || 360;
      const ctx = c.getContext('2d');
      if (ctx) ctx.drawImage(source, 0, 0, c.width, c.height);
      return createImageBitmap(c);
    }
    throw new Error('Unsupported detect source for Worker detector');
  }

  async detect(source: unknown): Promise<MultiLandmarkerDetectResult> {
    return this.detectForVideo(source, 0);
  }

  async detectForVideo(source: unknown, timestampMs: number): Promise<MultiLandmarkerDetectResult> {
    const bitmap = await this.sourceToBitmap(source);
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.managed.postMessage(
        { type: 'DETECT_FRAME', requestId, bitmap, timestampMs },
        [bitmap],
      );
    });
  }

  close() {
    this.managed.postMessage({ type: 'CLOSE' });
    this.managed.removeEventListener('message', this.onMessageBound);
    this.managed.terminate();
    this.unregister();
    this.pending.forEach(({ reject }) => reject(new Error('Detector closed')));
    this.pending.clear();
  }

  applyRecovery(initInfo: { delegate?: string; runningMode?: string; modelVariant?: string }) {
    this.delegate = initInfo.delegate === 'GPU' ? 'GPU' : 'CPU';
    this.runningMode = (initInfo.runningMode as 'IMAGE' | 'VIDEO') || this.runningMode;
    this.modelVariant = initInfo.modelVariant || this.modelVariant;
    this.pending.forEach(({ reject }) => reject(new Error('Worker recovered — request retry needed')));
    this.pending.clear();
  }
}

async function initMotionWorker(
  worker: Worker,
  groupMemberCount: number,
  options: { lenient?: boolean; runningMode?: 'IMAGE' | 'VIDEO'; modelVariant?: string },
): Promise<{ delegate?: string; runningMode?: string; modelVariant?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Worker init timeout')), AI_INIT_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg.type === 'INIT_DONE') {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        resolve(msg);
      } else if (msg.type === 'INIT_ERROR') {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        reject(new Error(msg.error || 'Worker init failed'));
      }
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', (err) => {
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      reject(err);
    });
    worker.postMessage({
      type: 'INIT',
      config: {
        groupMemberCount,
        modelVariant: options.modelVariant,
        runningMode: options.runningMode ?? 'VIDEO',
        lenient: options.lenient,
      },
    });
  });
}

async function createWorkerBackedDetector(
  groupMemberCount: number,
  onStatus?: (msg: string) => void,
  options: { lenient?: boolean; runningMode?: 'IMAGE' | 'VIDEO'; modelVariant?: string } = {},
): Promise<WorkerBackedMotionDetector> {
  onStatus?.('MediaPipe Worker 초기화 중...');
  const workerUrl = new URL('../../workers/motionDetectionWorker.ts', import.meta.url);
  let detector: WorkerBackedMotionDetector | null = null;

  const managed = createManagedWorker({
    name: 'motion-detection',
    workerUrl,
    subsystem: 'motion-extraction',
    maxRestarts: 3,
    onWorkerCreated: async (worker, attempt) => {
      const initInfo = await initMotionWorker(worker, groupMemberCount, options);
      if (!detector) {
        detector = new WorkerBackedMotionDetector(managed, initInfo);
      } else {
        detector.applyRecovery(initInfo);
      }
      onStatus?.(`MediaPipe Worker 준비 완료 (${initInfo.delegate ?? 'CPU'})${attempt > 0 ? ` [복구 #${attempt}]` : ''}`);
    },
    onFatal: (err) => {
      recordMediaPipeError(err.message, { phase: 'worker-fatal' });
    },
  });

  // 첫 spawn 완료 대기
  let waited = 0;
  while (!detector && waited < AI_INIT_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 50));
    waited += 50;
  }
  if (!detector) throw new Error('Motion detection worker init timeout');
  return detector;
}

const AI_INIT_TIMEOUT_MS = 60000;

/**
 * Worker 지원 시 Worker-backed detector, 미지원 시 메인 스레드 detector를 반환한다.
 */
export async function createMotionDetector(
  groupMemberCount: number,
  onStatus?: (msg: string) => void,
  options: { lenient?: boolean; runningMode?: 'IMAGE' | 'VIDEO'; modelVariant?: string; forceMainThread?: boolean } = {},
): Promise<MotionDetectorLike> {
  const forceMainThread = options.forceMainThread ?? isForceMainThreadMediaPipe();
  const useWorker = !forceMainThread
    && isMotionWorkerEnabled()
    && await probeMotionDetectionWorkerSupport({
      groupMemberCount,
      modelVariant: options.modelVariant,
    });

  if (useWorker) {
    try {
      return await createWorkerBackedDetector(groupMemberCount, onStatus, options);
    } catch (err) {
      console.warn('[WorkerMotionDetector] Worker 생성 실패 — 메인 스레드 폴백', err);
      cachedWorkerCapable = false;
    }
  }

  const detector = await createMultiLandmarkerDetector(groupMemberCount, onStatus, options);
  pipelineRegistry.register({
    name: 'mainThreadMotionDetector',
    subsystem: 'motion-extraction',
    kind: 'detector',
    meta: { delegate: detector.delegate },
  });
  return { ...detector, isWorkerBacked: false };
}
