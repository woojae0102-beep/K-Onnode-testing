// @ts-nocheck
/**
 * Worker Health Monitor — 모든 Managed Worker에 5초 ping / 10초 hung 판정.
 */
import { isWorkerRecoveryEnabled } from './workerRecovery';
import { recordWorkerError, recordWorkerRecovery } from './pipelineTelemetry';

export type WorkerHealthEntry = {
  name: string;
  subsystem: string;
  postMessage: (msg: unknown) => boolean;
  restart?: () => void | Promise<void>;
  managed: boolean;
};

export type WorkerHealthStatus = {
  name: string;
  lastPongAtMs: number | null;
  lastPingAtMs: number | null;
  hung: boolean;
  missedPongs: number;
  restartCount: number;
  managed: boolean;
};

const PING_INTERVAL_MS = 5000;
const HUNG_THRESHOLD_MS = 10000;

let pingTimer: ReturnType<typeof setInterval> | null = null;
const workers = new Map<string, WorkerHealthEntry>();
const statusByName = new Map<string, WorkerHealthStatus>();
let onHungCallback: ((name: string, status: WorkerHealthStatus) => void) | null = null;

export function setWorkerHungCallback(fn: ((name: string, status: WorkerHealthStatus) => void) | null): void {
  onHungCallback = fn;
}

export function registerWorkerHealth(entry: WorkerHealthEntry): () => void {
  workers.set(entry.name, entry);
  statusByName.set(entry.name, {
    name: entry.name,
    lastPongAtMs: null,
    lastPingAtMs: null,
    hung: false,
    missedPongs: 0,
    restartCount: 0,
    managed: entry.managed,
  });
  ensurePingLoop();
  return () => {
    workers.delete(entry.name);
    statusByName.delete(entry.name);
    if (!workers.size && pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };
}

export function recordWorkerPong(name: string, atMs = performance.now()): void {
  const st = statusByName.get(name);
  if (!st) return;
  st.lastPongAtMs = atMs;
  st.hung = false;
  st.missedPongs = 0;
}

export function getWorkerHealthStatuses(): WorkerHealthStatus[] {
  return Array.from(statusByName.values());
}

export function getHungWorkers(): WorkerHealthStatus[] {
  return getWorkerHealthStatuses().filter((s) => s.hung);
}

function ensurePingLoop() {
  if (pingTimer) return;
  pingTimer = setInterval(() => {
    const now = performance.now();
    workers.forEach((entry, name) => {
      const st = statusByName.get(name);
      if (!st) return;
      const pingId = `${name}-${now}`;
      st.lastPingAtMs = now;
      try {
        entry.postMessage({ type: 'PING', pingId, atMs: now });
      } catch (err) {
        recordWorkerError(name, err as Error, { phase: 'ping' });
      }
      if (st.lastPongAtMs != null && now - st.lastPongAtMs > HUNG_THRESHOLD_MS) {
        if (!st.hung) {
          st.hung = true;
          st.missedPongs += 1;
          console.error(`[WorkerHealth] ${name} HUNG — pong 없음 ${Math.round(now - st.lastPongAtMs)}ms`);
          onHungCallback?.(name, st);
          if (entry.restart && isWorkerRecoveryEnabled()) {
            st.restartCount += 1;
            recordWorkerRecovery(name, st.restartCount, { reason: 'health-check-hung' });
            void entry.restart();
          }
        }
      }
    });
  }, PING_INTERVAL_MS);
}

/** Worker onmessage에서 PONG 수신 시 호출 */
export function handleWorkerMessageForHealth(name: string, msg: { type?: string }): boolean {
  if (msg?.type === 'PONG') {
    recordWorkerPong(name);
    return true;
  }
  return false;
}
