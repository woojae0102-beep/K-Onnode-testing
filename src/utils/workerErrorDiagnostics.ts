// @ts-nocheck
/**
 * Worker Error Diagnostics — ErrorEvent/message/stack 전체 출력,
 * Promise reject 체인, sampleVideoFramesPlayback() 전파 Call Graph 추적.
 */

export type WorkerErrorDetail = {
  workerName: string;
  phase: string;
  atMs: number;
  message: string;
  name?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  raw?: unknown;
};

export type PropagationHop = {
  phase: string;
  atMs: number;
  detail?: string;
  stack?: string;
  propagatedToSampler?: boolean;
};

export type PromiseRejectionRecord = {
  label: string;
  atMs: number;
  message: string;
  stack?: string;
};

export type RvfcBreakCause =
  | 'Worker Exception propagated'
  | 'scheduleVideoFrame not re-registered'
  | 'requestVideoFrameCallback never fired'
  | 'video decoder stopped'
  | 'AbortController triggered';

const MAX_ERRORS = 40;
const MAX_HOPS = 80;
const MAX_REJECTIONS = 40;

const workerErrors: WorkerErrorDetail[] = [];
const propagationHops: PropagationHop[] = [];
const promiseRejections: PromiseRejectionRecord[] = [];
let samplerFinalized = false;
let samplerAborted = false;
let lastWorkerErrorBeforeStall: WorkerErrorDetail | null = null;

export function formatErrorEvent(ev: ErrorEvent | Event): Partial<WorkerErrorDetail> {
  const e = ev as ErrorEvent;
  const inner = e.error;
  const filename = typeof e.filename === 'string' ? e.filename : undefined;
  const lineno = typeof e.lineno === 'number' ? e.lineno : undefined;
  const colno = typeof e.colno === 'number' ? e.colno : undefined;
  const message = (inner && typeof inner.message === 'string' && inner.message)
    || (typeof e.message === 'string' && e.message)
    || (filename ? `Script error at ${filename}:${lineno ?? '?'}:${colno ?? '?'}` : '(Worker ErrorEvent — message unavailable)');
  return {
    message,
    name: inner?.name,
    filename,
    lineno,
    colno,
    stack: inner?.stack,
  };
}

/** Worker ErrorEvent는 cross-realm이라 instanceof Event/ErrorEvent가 실패할 수 있음 — duck-type 사용 */
export function parseWorkerErrorSource(source: unknown): Partial<WorkerErrorDetail> {
  if (source instanceof Error) {
    return { message: source.message, name: source.name, stack: source.stack };
  }
  if (typeof source === 'string') {
    return { message: source };
  }
  if (source && typeof source === 'object') {
    const e = source as Record<string, unknown>;
    // ErrorEvent duck-type (instanceof 불가 환경 대응)
    if ('filename' in e || 'lineno' in e || 'colno' in e || 'error' in e || e.type === 'error') {
      return formatErrorEvent(source as ErrorEvent);
    }
    // Worker postMessage ERROR payload
    const errMsg = (typeof e.error === 'string' && e.error)
      || (typeof e.message === 'string' && e.message)
      || (typeof e.reason === 'string' && e.reason);
    if (errMsg) {
      return {
        message: errMsg,
        name: typeof e.name === 'string' ? e.name : undefined,
        filename: typeof e.filename === 'string' ? e.filename : undefined,
        lineno: typeof e.lineno === 'number' ? e.lineno : undefined,
        colno: typeof e.colno === 'number' ? e.colno : undefined,
        stack: typeof e.stack === 'string' ? e.stack : undefined,
      };
    }
    // Event 객체를 JSON.stringify 하면 {"isTrusted":true} 만 나옴 — 금지
    if (typeof e.type === 'string') {
      return { message: `Event type=${e.type} (cross-realm — 필드 직접 읽기 실패)` };
    }
  }
  return { message: String(source) };
}

export function formatUnknownError(err: unknown): Partial<WorkerErrorDetail> {
  return parseWorkerErrorSource(err);
}

/** Worker onerror / onmessageerror / ERROR 메시지 — 전체 필드 콘솔 출력 */
export function logWorkerErrorDetail(
  workerName: string,
  phase: string,
  source: ErrorEvent | Event | unknown,
  extra?: Record<string, unknown>,
): WorkerErrorDetail {
  const base = parseWorkerErrorSource(source);

  const detail: WorkerErrorDetail = {
    workerName,
    phase,
    atMs: performance.now(),
    message: base.message || '(no message)',
    name: base.name,
    filename: base.filename,
    lineno: base.lineno,
    colno: base.colno,
    stack: base.stack || new Error(`[${workerName}] ${phase}`).stack,
    raw: extra,
  };

  workerErrors.push(detail);
  if (workerErrors.length > MAX_ERRORS) workerErrors.shift();
  lastWorkerErrorBeforeStall = detail;

  console.group(`[WorkerError] ${workerName} — ${phase}`);
  console.error('message:', detail.message);
  if (detail.name) console.error('name:', detail.name);
  if (detail.filename) console.error('filename:', detail.filename);
  if (detail.lineno != null) console.error('lineno:', detail.lineno, 'colno:', detail.colno);
  if (detail.stack) console.error('stack:\n', detail.stack);
  if (extra) console.error('extra:', extra);
  // cross-realm ErrorEvent raw 필드 — instanceof 실패 시에도 filename/lineno 확보
  if (source && typeof source === 'object') {
    const raw = source as Record<string, unknown>;
    console.error('raw ErrorEvent:', {
      type: raw.type,
      message: raw.message,
      filename: raw.filename,
      lineno: raw.lineno,
      colno: raw.colno,
      errorMessage: (raw.error as Error | undefined)?.message,
      errorStack: (raw.error as Error | undefined)?.stack,
    });
  }
  console.error('capture stack:', new Error(`[capture] ${phase}`).stack);
  console.groupEnd();

  recordPropagationHop(`workerError:${workerName}:${phase}`, detail.message);

  if (typeof window !== 'undefined') {
    (window as any).__K_ONNODE_WORKER_ERRORS__ = workerErrors.slice();
  }

  return detail;
}

export function logWorkerLifecycle(
  workerName: string,
  phase: 'terminate' | 'restart' | 'spawn' | 'recovery-start' | 'recovery-done' | 'onFatal',
  extra?: Record<string, unknown>,
): void {
  const stack = new Error(`[${workerName}] ${phase}`).stack;
  console.group(`[WorkerLifecycle] ${workerName} — ${phase}`);
  if (extra) console.info(extra);
  console.info('stack:\n', stack);
  console.groupEnd();
  recordPropagationHop(`workerLifecycle:${workerName}:${phase}`, JSON.stringify(extra || {}));
}

export function recordPropagationHop(phase: string, detail?: string, opts?: { propagatedToSampler?: boolean }): void {
  propagationHops.push({
    phase,
    atMs: performance.now(),
    detail,
    stack: new Error(`[propagation] ${phase}`).stack,
    propagatedToSampler: opts?.propagatedToSampler,
  });
  if (propagationHops.length > MAX_HOPS) propagationHops.shift();
}

export function recordPromiseRejection(label: string, err: unknown): void {
  const fmt = formatUnknownError(err);
  const rec: PromiseRejectionRecord = {
    label,
    atMs: performance.now(),
    message: fmt.message || String(err),
    stack: fmt.stack || new Error(`[reject] ${label}`).stack,
  };
  promiseRejections.push(rec);
  if (promiseRejections.length > MAX_REJECTIONS) promiseRejections.shift();

  console.group(`[PromiseReject] ${label}`);
  console.error('message:', rec.message);
  if (rec.stack) console.error('stack:\n', rec.stack);
  console.groupEnd();

  recordPropagationHop(`promiseReject:${label}`, rec.message, { propagatedToSampler: label.includes('sampler') });
}

export function markSamplerAborted(): void {
  samplerAborted = true;
  recordPropagationHop('videoFrameSampler.abort', 'abortRef.current=true');
}

export function markSamplerFinalized(reason?: string): void {
  samplerFinalized = true;
  recordPropagationHop('videoFrameSampler.finalize', reason || 'done', { propagatedToSampler: true });
}

export function resetPropagationSession(): void {
  workerErrors.length = 0;
  propagationHops.length = 0;
  promiseRejections.length = 0;
  samplerFinalized = false;
  samplerAborted = false;
  lastWorkerErrorBeforeStall = null;
}

export function getRecentWorkerErrors(withinMs = 30_000): WorkerErrorDetail[] {
  const cutoff = performance.now() - withinMs;
  return workerErrors.filter((e) => e.atMs >= cutoff);
}

export function didWorkerErrorPropagateToSampler(withinMs = 30_000): boolean {
  const recentError = getRecentWorkerErrors(withinMs);
  if (!recentError.length) return false;
  const errorAt = recentError[recentError.length - 1].atMs;
  return promiseRejections.some((r) => r.atMs >= errorAt && r.label.includes('sampler'))
    || propagationHops.some((h) => h.atMs >= errorAt && h.phase.includes('videoFrameSampler.finalize'))
    || samplerFinalized;
}

export function dumpPropagationCallGraph(): void {
  console.group('[WorkerPropagation] Call Graph — Worker Error → sampleVideoFramesPlayback');
  console.table(propagationHops.map((h) => ({
    phase: h.phase,
    agoMs: Math.round(performance.now() - h.atMs),
    detail: (h.detail || '').slice(0, 120),
    toSampler: h.propagatedToSampler ?? false,
  })));
  if (promiseRejections.length) {
    console.group('Promise Rejections');
    console.table(promiseRejections.map((r) => ({
      label: r.label,
      agoMs: Math.round(performance.now() - r.atMs),
      message: r.message.slice(0, 100),
    })));
    promiseRejections.forEach((r) => {
      if (r.stack) console.error(`[${r.label}] stack:\n`, r.stack);
    });
    console.groupEnd();
  }
  if (workerErrors.length) {
    console.group('Worker Errors (full)');
    workerErrors.forEach((e) => {
      console.error({
        worker: e.workerName,
        phase: e.phase,
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        stack: e.stack,
      });
    });
    console.groupEnd();
  }
  console.info('samplerFinalized:', samplerFinalized, 'samplerAborted:', samplerAborted);
  console.info('propagatedToSampler:', didWorkerErrorPropagateToSampler());
  console.groupEnd();
}

export type RvfcScheduleState = {
  lastScheduleSuccessAtMs: number | null;
  lastScheduleHandleId: number | null;
  lastCallbackAtMs: number | null;
  lastCallbackMediaTime: number | null;
  scheduleCallCount: number;
  callbackCallCount: number;
};

let rvfcScheduleState: RvfcScheduleState = {
  lastScheduleSuccessAtMs: null,
  lastScheduleHandleId: null,
  lastCallbackAtMs: null,
  lastCallbackMediaTime: null,
  scheduleCallCount: 0,
  callbackCallCount: 0,
};

export function recordRvfcScheduleSuccess(handleId: number | null): void {
  rvfcScheduleState.scheduleCallCount += 1;
  rvfcScheduleState.lastScheduleSuccessAtMs = performance.now();
  rvfcScheduleState.lastScheduleHandleId = handleId;
}

export function recordRvfcCallback(mediaTime?: number): void {
  rvfcScheduleState.callbackCallCount += 1;
  rvfcScheduleState.lastCallbackAtMs = performance.now();
  if (Number.isFinite(mediaTime)) rvfcScheduleState.lastCallbackMediaTime = mediaTime as number;
}

export function getRvfcScheduleState(): RvfcScheduleState {
  return { ...rvfcScheduleState };
}

export function resetRvfcScheduleState(): void {
  rvfcScheduleState = {
    lastScheduleSuccessAtMs: null,
    lastScheduleHandleId: null,
    lastCallbackAtMs: null,
    lastCallbackMediaTime: null,
    scheduleCallCount: 0,
    callbackCallCount: 0,
  };
}

/**
 * RVFC 끊김 원인 강제 분류 — UNKNOWN 금지.
 */
export function classifyRvfcBreak(opts: {
  videoPaused: boolean;
  videoEnded: boolean;
  videoWaitingRecent: boolean;
  videoStalledRecent: boolean;
  currentTimeStalledMs: number;
  aborted: boolean;
  onFrameErrors: number;
  scheduleCallCount: number;
  onFrameCallCount: number;
  handleRegistered: boolean;
  stallReason: string;
}): { cause: RvfcBreakCause; evidence: string[] } {
  const evidence: string[] = [];
  const now = performance.now();
  const rvfc = getRvfcScheduleState();
  const recentWorkerErrors = getRecentWorkerErrors(20_000);

  if (opts.aborted || samplerAborted) {
    evidence.push('abortRef.current=true 또는 sampler aborted 플래그');
    return { cause: 'AbortController triggered', evidence };
  }

  if (didWorkerErrorPropagateToSampler(20_000)) {
    const we = recentWorkerErrors[recentWorkerErrors.length - 1];
    evidence.push(`Worker error: ${we?.message} (${we?.phase})`);
    evidence.push('Promise reject 또는 videoFrameSampler.finalize() 전파 확인됨');
    promiseRejections.filter((r) => r.atMs >= (we?.atMs ?? 0)).forEach((r) => {
      evidence.push(`Promise reject: ${r.label} — ${r.message}`);
    });
    return { cause: 'Worker Exception propagated', evidence };
  }

  if (opts.videoPaused || opts.videoEnded || opts.videoWaitingRecent || opts.videoStalledRecent
    || opts.currentTimeStalledMs > 3000) {
    if (opts.videoPaused) evidence.push('video.paused=true');
    if (opts.videoEnded) evidence.push('video.ended=true');
    if (opts.videoWaitingRecent) evidence.push('최근 waiting 이벤트');
    if (opts.videoStalledRecent) evidence.push('최근 stalled 이벤트');
    if (opts.currentTimeStalledMs > 3000) evidence.push(`currentTime ${Math.round(opts.currentTimeStalledMs)}ms 무변화`);
    return { cause: 'video decoder stopped', evidence };
  }

  const msSinceSchedule = rvfc.lastScheduleSuccessAtMs != null ? now - rvfc.lastScheduleSuccessAtMs : null;
  const msSinceCallback = rvfc.lastCallbackAtMs != null ? now - rvfc.lastCallbackAtMs : null;

  if (opts.onFrameErrors > 0) {
    evidence.push(`onFrame() 예외 ${opts.onFrameErrors}회 — finally에서 schedule 누락 가능`);
    return { cause: 'scheduleVideoFrame not re-registered', evidence };
  }

  const scheduleAhead = opts.scheduleCallCount > opts.onFrameCallCount;
  if (scheduleAhead && msSinceSchedule != null && msSinceCallback != null
    && msSinceSchedule < msSinceCallback + 500) {
    evidence.push(`schedule(${opts.scheduleCallCount}) > callback(${opts.onFrameCallCount})`);
    evidence.push(`마지막 schedule ${Math.round(msSinceSchedule)}ms 전, callback ${Math.round(msSinceCallback)}ms 전`);
    evidence.push('onFrame()는 실행됐으나 다음 scheduleVideoFrame 미호출');
    return { cause: 'scheduleVideoFrame not re-registered', evidence };
  }

  if (recentWorkerErrors.length) {
    const we = recentWorkerErrors[recentWorkerErrors.length - 1];
    evidence.push(`motion-post-process Worker error: "${we.message}" (${Math.round(now - we.atMs)}ms 전)`);
    evidence.push(`filename=${we.filename ?? 'n/a'} lineno=${we.lineno ?? 'n/a'}`);
    evidence.push('Worker error 후 main thread finalize/reject 전파 없음');
    evidence.push('video 상태 정상 — RVFC callback만 중단 (브라우저/Worker crash 연동)');
    if (msSinceSchedule != null) evidence.push(`마지막 RVFC schedule 성공: ${Math.round(msSinceSchedule)}ms 전 (handle=${rvfc.lastScheduleHandleId})`);
    if (msSinceCallback != null) evidence.push(`마지막 RVFC callback: ${Math.round(msSinceCallback)}ms 전`);
    return { cause: 'requestVideoFrameCallback never fired', evidence };
  }

  evidence.push(opts.stallReason);
  if (msSinceSchedule != null) evidence.push(`마지막 schedule ${Math.round(msSinceSchedule)}ms 전`);
  if (msSinceCallback != null) evidence.push(`마지막 callback ${Math.round(msSinceCallback)}ms 전`);
  evidence.push('Worker error 기록 없음 — RVFC 등록 후 callback 미도착');
  return { cause: 'requestVideoFrameCallback never fired', evidence };
}
