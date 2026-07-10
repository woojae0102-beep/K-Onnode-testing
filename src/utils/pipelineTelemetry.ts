// @ts-nocheck
/**
 * Pipeline Telemetry — Coverage 실패, Worker 오류, Queue Overflow, MediaPipe 오류,
 * 메모리·GPU 리소스 등을 자동 수집하고 (선택) 원격 업로드한다.
 */
import { featureFlagManager } from '../config/featureFlagManager';
import { pipelineEventBus } from './pipelineEventBus';
import { getGpuResourceSnapshot } from './gpuResourceMonitor';
import { readHeapBytes } from './memoryProfiler';

export type TelemetryCategory =
  | 'coverage_failure'
  | 'worker_error'
  | 'worker_recovery'
  | 'queue_overflow'
  | 'mediapipe_error'
  | 'memory_report'
  | 'gpu_resource_report'
  | 'benchmark_result'
  | 'pipeline_error'
  | 'info';

export type TelemetryEvent = {
  id: string;
  category: TelemetryCategory;
  message: string;
  subsystem: string;
  severity: 'info' | 'warn' | 'error';
  atMs: number;
  sessionId: string;
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = 'k-onnode:telemetry:v1';
const MAX_BUFFER = 500;
const UPLOAD_BATCH_SIZE = 50;
const UPLOAD_INTERVAL_MS = 30_000;

let sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let buffer: TelemetryEvent[] = [];
let uploadTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let unsubscribers: Array<() => void> = [];

function isEnabled(): boolean {
  return featureFlagManager.get('telemetryEnabled');
}

function genId(): string {
  return `tel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadPersistedBuffer(): TelemetryEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_BUFFER) : [];
  } catch {
    return [];
  }
}

function persistBuffer(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX_BUFFER)));
  } catch {
    // quota
  }
}

function getUploadEndpoint(): string | null {
  const env = import.meta.env.VITE_TELEMETRY_ENDPOINT;
  return typeof env === 'string' && env.length > 0 ? env : null;
}

async function flushUpload(): Promise<void> {
  if (!featureFlagManager.get('telemetryUploadEnabled')) return;
  const endpoint = getUploadEndpoint();
  if (!endpoint || buffer.length === 0) return;

  const batch = buffer.slice(0, UPLOAD_BATCH_SIZE);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        appVersion: import.meta.env.VITE_APP_VERSION || '5.0.0',
        events: batch,
      }),
      keepalive: true,
    });
    if (res.ok) {
      buffer = buffer.slice(batch.length);
      persistBuffer();
    }
  } catch (err) {
    console.warn('[Telemetry] 업로드 실패', err);
  }
}

export function recordTelemetry(
  category: TelemetryCategory,
  message: string,
  options: {
    subsystem?: string;
    severity?: TelemetryEvent['severity'];
    meta?: Record<string, unknown>;
  } = {},
): TelemetryEvent | null {
  if (!isEnabled()) return null;

  const event: TelemetryEvent = {
    id: genId(),
    category,
    message,
    subsystem: options.subsystem || 'pipeline',
    severity: options.severity || 'info',
    atMs: Date.now(),
    sessionId,
    meta: options.meta,
  };

  buffer.push(event);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
  persistBuffer();

  const logFn = event.severity === 'error' ? console.error
    : event.severity === 'warn' ? console.warn
      : console.info;
  logFn(`[Telemetry:${category}]`, message, options.meta || '');

  return event;
}

export function recordCoverageFailure(meta: Record<string, unknown>): void {
  recordTelemetry('coverage_failure', 'Coverage 85% 미달 또는 조기 종료', {
    subsystem: 'motion-extraction',
    severity: 'warn',
    meta,
  });
}

export function recordWorkerError(workerName: string, error: string | Error, meta?: Record<string, unknown>): void {
  recordTelemetry('worker_error', `${workerName}: ${error instanceof Error ? error.message : error}`, {
    subsystem: workerName,
    severity: 'error',
    meta: { ...meta, stack: error instanceof Error ? error.stack : undefined },
  });
}

export function recordWorkerRecovery(workerName: string, attempt: number, meta?: Record<string, unknown>): void {
  recordTelemetry('worker_recovery', `${workerName} 재시작 (attempt ${attempt})`, {
    subsystem: workerName,
    severity: 'warn',
    meta: { attempt, ...meta },
  });
}

export function recordQueueOverflow(stageName: string, meta: Record<string, unknown>): void {
  recordTelemetry('queue_overflow', `Queue overflow: ${stageName}`, {
    subsystem: stageName,
    severity: 'warn',
    meta,
  });
}

export function recordMediaPipeError(message: string, meta?: Record<string, unknown>): void {
  recordTelemetry('mediapipe_error', message, {
    subsystem: 'mediapipe',
    severity: 'error',
    meta,
  });
}

export function recordMemoryReport(subsystem: string, meta?: Record<string, unknown>): void {
  recordTelemetry('memory_report', `Heap report: ${subsystem}`, {
    subsystem,
    severity: 'info',
    meta: {
      usedJSHeapBytes: readHeapBytes(),
      gpu: getGpuResourceSnapshot(),
      ...meta,
    },
  });
}

export function getTelemetryBuffer(): TelemetryEvent[] {
  return buffer.slice();
}

export function clearTelemetryBuffer(): void {
  buffer = [];
  persistBuffer();
}

export function exportTelemetryJson(): string {
  return JSON.stringify({ sessionId, events: buffer }, null, 2);
}

export function downloadTelemetryJson(filename?: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([exportTelemetryJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `k-onnode-telemetry-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function wirePipelineEventBus(): void {
  unsubscribers.push(
    pipelineEventBus.on('motion-extraction-error', (p) => {
      recordTelemetry('pipeline_error', p.message, {
        subsystem: 'motion-extraction',
        severity: 'error',
        meta: { groupId: p.groupId, songId: p.songId },
      });
    }),
  );
  unsubscribers.push(
    pipelineEventBus.on('motion-extraction-complete', (p) => {
      recordTelemetry('info', 'Motion extraction complete', {
        subsystem: 'motion-extraction',
        severity: 'info',
        meta: p,
      });
    }),
  );
  unsubscribers.push(
    pipelineEventBus.on('pipeline-memory-report', (p) => {
      recordMemoryReport(p.subsystem, p);
    }),
  );
}

/** 앱 시작 시 1회 — 이벤트 버스 구독 + 주기 업로드 */
export function initPipelineTelemetry(): void {
  if (initialized) return;
  initialized = true;
  if (!isEnabled()) return;

  buffer = loadPersistedBuffer();
  wirePipelineEventBus();

  if (featureFlagManager.get('telemetryUploadEnabled') && getUploadEndpoint()) {
    uploadTimer = setInterval(() => {
      void flushUpload();
    }, UPLOAD_INTERVAL_MS);
  }

  if (typeof window !== 'undefined') {
    (window as any).__K_ONNODE_TELEMETRY__ = {
      record: recordTelemetry,
      getBuffer: getTelemetryBuffer,
      clear: clearTelemetryBuffer,
      exportJson: exportTelemetryJson,
      download: downloadTelemetryJson,
      flushUpload,
    };
  }

  console.info('[Telemetry] 초기화 완료', { sessionId, buffered: buffer.length });
}

export function disposePipelineTelemetry(): void {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
  if (uploadTimer) {
    clearInterval(uploadTimer);
    uploadTimer = null;
  }
}
