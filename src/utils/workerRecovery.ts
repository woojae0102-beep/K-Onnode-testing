// @ts-nocheck
/**
 * Managed Worker — Worker crash/오류 시 자동 재생성.
 * INIT 콜백으로 Worker 상태를 복구하고, pending 메시지 큐를 이어받는다.
 */
import { featureFlagManager } from '../config/featureFlagManager';
import { recordWorkerError, recordWorkerRecovery } from './pipelineTelemetry';
import { pipelineRegistry } from './pipelineEventBus';

export type ManagedWorkerOptions = {
  name: string;
  workerUrl: URL;
  subsystem?: string;
  maxRestarts?: number;
  restartDelayMs?: number;
  /** Worker 생성 직후 1회 — INIT 등 */
  onWorkerCreated?: (worker: Worker, attempt: number) => void | Promise<void>;
  /** Worker 종료 시 */
  onWorkerTerminated?: (reason: string) => void;
  /** 복구 불가 시 */
  onFatal?: (err: Error) => void;
};

export type ManagedWorkerHandle = {
  getWorker: () => Worker | null;
  postMessage: (message: unknown, transfer?: unknown[]) => boolean;
  terminate: () => void;
  getRestartCount: () => number;
  isAlive: () => boolean;
  /** Worker message/error 리스너 — 재생성 시에도 유지 */
  addEventListener: (type: 'message' | 'error', listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: 'message' | 'error', listener: (event: MessageEvent) => void) => void;
};

export function isWorkerRecoveryEnabled(): boolean {
  return featureFlagManager.get('workerRecoveryEnabled');
}

export function createManagedWorker(options: ManagedWorkerOptions): ManagedWorkerHandle {
  const {
    name,
    workerUrl,
    subsystem = 'worker',
    maxRestarts = 3,
    restartDelayMs = 500,
    onWorkerCreated,
    onWorkerTerminated,
    onFatal,
  } = options;

  let worker: Worker | null = null;
  let restartCount = 0;
  let terminated = false;
  let recovering = false;
  const pendingQueue: Array<{ message: unknown; transfer?: unknown[] }> = [];
  const messageListeners = new Set<(event: MessageEvent) => void>();
  const errorListeners = new Set<(event: ErrorEvent) => void>();
  let unregisterRegistry: (() => void) | null = null;

  const attachListeners = (w: Worker) => {
    messageListeners.forEach((fn) => w.addEventListener('message', fn));
    errorListeners.forEach((fn) => w.addEventListener('error', fn));
  };

  const detachListeners = (w: Worker) => {
    messageListeners.forEach((fn) => w.removeEventListener('message', fn));
    errorListeners.forEach((fn) => w.removeEventListener('error', fn));
  };

  const spawn = async (attempt: number): Promise<Worker | null> => {
    if (terminated) return null;
    try {
      const w = new Worker(workerUrl, { type: 'module', name });
      attachListeners(w);
      w.addEventListener('error', (ev) => {
        recordWorkerError(name, (ev as ErrorEvent).message || 'Worker error');
        if (isWorkerRecoveryEnabled()) void scheduleRecovery('error');
      });
      if (onWorkerCreated) await onWorkerCreated(w, attempt);
      unregisterRegistry?.();
      unregisterRegistry = pipelineRegistry.register({
        name,
        subsystem,
        kind: 'worker',
        meta: { attempt, managed: true },
      });
      return w;
    } catch (err) {
      recordWorkerError(name, err as Error);
      return null;
    }
  };

  const scheduleRecovery = async (reason: string) => {
    if (terminated || recovering) return;
    if (!isWorkerRecoveryEnabled()) {
      onFatal?.(new Error(`${name} crashed (${reason}) — recovery disabled`));
      return;
    }
    if (restartCount >= maxRestarts) {
      onFatal?.(new Error(`${name} crashed (${reason}) — max restarts exceeded`));
      return;
    }
    recovering = true;
    restartCount += 1;
    recordWorkerRecovery(name, restartCount, { reason });

    if (worker) {
      detachListeners(worker);
      worker.terminate();
      worker = null;
    }

    await new Promise((r) => setTimeout(r, restartDelayMs * restartCount));
    const w = await spawn(restartCount);
    worker = w;
    recovering = false;

    if (!w) {
      onFatal?.(new Error(`${name} recovery spawn failed`));
      return;
    }

    while (pendingQueue.length) {
      const item = pendingQueue.shift();
      try {
        w.postMessage(item.message, item.transfer || []);
      } catch (err) {
        recordWorkerError(name, err as Error, { phase: 'replay-pending' });
        break;
      }
    }
  };

  const init = async () => {
    worker = await spawn(0);
    if (!worker && isWorkerRecoveryEnabled()) {
      await scheduleRecovery('init-failed');
    }
  };
  void init();

  return {
    getWorker: () => worker,
    postMessage(message: unknown, transfer?: unknown[]) {
      if (terminated) return false;
      if (!worker || recovering) {
        pendingQueue.push({ message, transfer });
        return true;
      }
      try {
        worker.postMessage(message, transfer || []);
        return true;
      } catch (err) {
        recordWorkerError(name, err as Error);
        pendingQueue.push({ message, transfer });
        if (isWorkerRecoveryEnabled()) void scheduleRecovery('postMessage-failed');
        return false;
      }
    },
    terminate() {
      terminated = true;
      onWorkerTerminated?.('manual');
      if (worker) {
        detachListeners(worker);
        worker.terminate();
        worker = null;
      }
      pendingQueue.length = 0;
      unregisterRegistry?.();
      unregisterRegistry = null;
    },
    getRestartCount: () => restartCount,
    isAlive: () => !!worker && !terminated && !recovering,
    addEventListener(type, listener) {
      if (type === 'message') messageListeners.add(listener);
      else errorListeners.add(listener);
      if (worker) worker.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      if (type === 'message') messageListeners.delete(listener);
      else errorListeners.delete(listener);
      if (worker) worker.removeEventListener(type, listener);
    },
  };
}
