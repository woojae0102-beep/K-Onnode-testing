// @ts-nocheck
/**
 * RVFC Stall RCA 전용 진단 로그 — 런타임 동작 변경 없음.
 */

import {
  classifyRvfcBreak,
  didWorkerErrorPropagateToSampler,
  getRecentWorkerErrors,
  type RvfcBreakCause,
} from './workerErrorDiagnostics';

export type RvfcDiagTimelineEntry = {
  label: string;
  atMs: number;
  relativeMs: number;
  detail?: string;
};

export type RvfcRcaVideoEvent = {
  event: string;
  atMs: number;
  currentTime?: number;
};

export type RvfcRcaDumpInput = {
  producerDone: boolean;
  settled: boolean;
  shouldReschedule: boolean;
  aborted: boolean;
  scheduleCalls: number;
  callbackCalls: number;
  lastOnFrameCurrentTime: number | null;
  lastOnFrameMediaTime?: number | null;
  videoCurrentTime: number;
  videoReadyState: number;
  videoPaused: boolean;
  videoEnded: boolean;
  visibilityState: string;
  videoEvents: RvfcRcaVideoEvent[];
  classifyOpts: Parameters<typeof classifyRvfcBreak>[0];
  forced?: { cause: RvfcBreakCause; evidence: string[] };
  stallTimeoutMs?: number;
  droppedVideoFrames?: number | null;
  totalVideoFrames?: number | null;
  samplerDroppedFrames?: number;
};

let sessionPlayStartAtMs: number | null = null;
const timeline: RvfcDiagTimelineEntry[] = [];
const MAX_TIMELINE = 64;

export function resetRvfcDiagSession(): void {
  sessionPlayStartAtMs = null;
  timeline.length = 0;
}

export function markRvfcPlayStart(): void {
  sessionPlayStartAtMs = performance.now();
  recordRvfcDiagEvent('play');
}

export function recordRvfcDiagEvent(label: string, detail?: Record<string, unknown>): void {
  const atMs = performance.now();
  const relativeMs = sessionPlayStartAtMs != null ? Math.round(atMs - sessionPlayStartAtMs) : 0;
  const entry: RvfcDiagTimelineEntry = {
    label,
    atMs,
    relativeMs,
    detail: detail ? JSON.stringify(detail) : undefined,
  };
  timeline.push(entry);
  if (timeline.length > MAX_TIMELINE) timeline.shift();
}

export function logRvfcCallbackLost(scheduleCalls: number, callbackCalls: number, extra?: Record<string, unknown>): void {
  if (scheduleCalls <= callbackCalls) return;
  const gap = scheduleCalls - callbackCalls;
  console.warn('[RVFC-Diag] RVFC callback lost', {
    scheduleCalls,
    callbackCalls,
    orphanCallbacks: gap,
    message: 'requestVideoFrameCallback 등록 후 callback 미도착 (Chrome 미호출 또는 handle orphan)',
    ...extra,
  });
  recordRvfcDiagEvent('callback never fired', { scheduleCalls, callbackCalls, gap });
}

function formatLastEventAgo(events: RvfcRcaVideoEvent[], name: string, now: number): string {
  const matches = events.filter((e) => e.event === name);
  if (!matches.length) return '(none)';
  const last = matches[matches.length - 1];
  const agoMs = Math.round(now - last.atMs);
  const t = Number.isFinite(last.currentTime) ? `${last.currentTime.toFixed(3)}s` : 'n/a';
  return `${agoMs}ms ago @ ${t}`;
}

/** video.currentTime ≈ lastOnFrameCurrentTime — 디코더/timeline 완전 정지 */
function isVideoTimelineFrozen(currentTime: number, lastOnFrameCurrentTime: number | null): boolean {
  if (lastOnFrameCurrentTime == null) return false;
  return Math.abs(currentTime - lastOnFrameCurrentTime) < 0.05;
}

/** video는 재생 중인데 RVFC가 본 mediaTime이 뒤처짐 — Chrome RVFC 끊김 전형 패턴 */
function computeRvfcMediaDriftSec(currentTime: number, lastOnFrameCurrentTime: number | null): number | null {
  if (lastOnFrameCurrentTime == null) return null;
  return Math.max(0, currentTime - lastOnFrameCurrentTime);
}

function isRvfcMediaDesync(
  currentTime: number,
  lastOnFrameCurrentTime: number | null,
  videoPaused: boolean,
  thresholdSec = 0.5,
): boolean {
  if (videoPaused || lastOnFrameCurrentTime == null) return false;
  const drift = computeRvfcMediaDriftSec(currentTime, lastOnFrameCurrentTime);
  return drift != null && drift > thresholdSec;
}

export function buildRcaTelemetryMeta(input: RvfcRcaDumpInput & {
  rvfcCallbackIdleMs: number;
  videoCurrentTimeIdleMs: number;
  scheduleCallsGlobal?: number;
  callbackCallsGlobal?: number;
}): Record<string, unknown> {
  const gap = input.scheduleCalls - input.callbackCalls;
  const drift = computeRvfcMediaDriftSec(input.videoCurrentTime, input.lastOnFrameCurrentTime);
  return {
    producerDone: input.producerDone,
    scheduleCalls: input.scheduleCalls,
    callbackCalls: input.callbackCalls,
    gap,
    scheduleCallsGlobal: input.scheduleCallsGlobal ?? input.scheduleCalls,
    callbackCallsGlobal: input.callbackCallsGlobal ?? input.callbackCalls,
    lastOnFrameCurrentTime: input.lastOnFrameCurrentTime,
    videoCurrentTime: input.videoCurrentTime,
    rvfcMediaDriftSec: drift != null ? Number(drift.toFixed(3)) : null,
    rvfcCallbackIdleMs: Math.round(input.rvfcCallbackIdleMs),
    videoCurrentTimeIdleMs: Math.round(input.videoCurrentTimeIdleMs),
    videoTimelineFrozen: isVideoTimelineFrozen(input.videoCurrentTime, input.lastOnFrameCurrentTime),
    rvfcMediaDesync: isRvfcMediaDesync(input.videoCurrentTime, input.lastOnFrameCurrentTime, input.videoPaused),
    classifyCause: input.forced?.cause ?? input.classifyOpts.stallReason,
    stallTimeoutMs: input.stallTimeoutMs,
    watchdogOverrunMs: input.rvfcCallbackIdleMs != null && input.stallTimeoutMs
      ? Math.max(0, Math.round(input.rvfcCallbackIdleMs - input.stallTimeoutMs))
      : null,
  };
}

function judgeProducerTermination(input: RvfcRcaDumpInput): string | null {
  if (!input.producerDone) return null;
  if (input.aborted) return '① producerDone=true → Abort/외부 신호에 의한 Producer 중단';
  if (input.videoEnded) return '① producerDone=true → Producer가 정상 종료함 (video.ended)';
  return '① producerDone=true → Producer 종료 (endTime 도달 또는 finalize 경로 — 상세는 stall reason 참고)';
}

function resolveMostProbableRootCause(
  input: RvfcRcaDumpInput,
  flags: {
    rvfcNeverFired: boolean;
    timelineFrozen: boolean;
    decoderWaiting: boolean;
    workerPropagated: boolean;
    producerTerminated: boolean;
  },
  forced: { cause: RvfcBreakCause; evidence: string[] },
): string {
  if (forced?.cause) return forced.cause;
  if (input.aborted) return 'AbortController triggered';
  if (flags.workerPropagated) return 'Worker Exception propagated';
  if (flags.producerTerminated && input.videoEnded) return 'Producer 정상 종료 (RVFC chain 의도적 중단)';
  if (flags.rvfcNeverFired) return 'requestVideoFrameCallback never fired';
  if (flags.decoderWaiting || flags.timelineFrozen) return 'video decoder stopped';
  return 'unknown (classifyRvfcBreak fallback)';
}

/**
 * Stall 시 핵심 RCA 상태를 console.table 한 번 + 자동 판정 + SUMMARY 블록으로 출력한다.
 */
export function dumpRvfcRcaTableAndSummary(input: RvfcRcaDumpInput & {
  rvfcCallbackIdleMs?: number;
  videoCurrentTimeIdleMs?: number;
  scheduleCallsGlobal?: number;
  callbackCallsGlobal?: number;
}): void {
  const now = performance.now();
  const scheduleCalls = input.scheduleCalls;
  const callbackCalls = input.callbackCalls;
  const gap = scheduleCalls - callbackCalls;
  const forced = input.forced ?? classifyRvfcBreak(input.classifyOpts);
  const workerErrors = getRecentWorkerErrors(20_000);
  const workerPropagated = didWorkerErrorPropagateToSampler(20_000);
  const rvfcCallbackIdleMs = input.rvfcCallbackIdleMs
    ?? Math.round(input.classifyOpts.rvfcCallbackIdleMs);
  const videoCurrentTimeIdleMs = input.videoCurrentTimeIdleMs
    ?? Math.round(input.classifyOpts.videoCurrentTimeIdleMs);
  const timelineFrozen = isVideoTimelineFrozen(input.videoCurrentTime, input.lastOnFrameCurrentTime);
  const rvfcMediaDriftSec = computeRvfcMediaDriftSec(input.videoCurrentTime, input.lastOnFrameCurrentTime);
  const rvfcMediaDesync = isRvfcMediaDesync(
    input.videoCurrentTime,
    input.lastOnFrameCurrentTime,
    input.videoPaused,
  );
  const videoPlayingWithoutRvfc = rvfcMediaDesync && !input.videoPaused && !input.videoEnded;
  const rvfcNeverFired = !input.producerDone && gap > 0;
  const decoderWaiting = input.classifyOpts.videoWaitingRecent || input.classifyOpts.videoStalledRecent;
  const stallTimeoutMs = input.stallTimeoutMs ?? 8000;
  const watchdogOverrunMs = Math.max(0, rvfcCallbackIdleMs - stallTimeoutMs);
  const watchdogDelayed = watchdogOverrunMs > 1500;
  const workerErrorMsBeforeStall = workerErrors.length
    ? Math.round(now - workerErrors[workerErrors.length - 1].atMs)
    : null;
  const workerPrecedesStall = workerErrors.length > 0
    && workerErrorMsBeforeStall != null
    && workerErrorMsBeforeStall > rvfcCallbackIdleMs;
  const dropRatePct = input.totalVideoFrames && input.droppedVideoFrames != null
    ? Math.round((input.droppedVideoFrames / input.totalVideoFrames) * 1000) / 10
    : null;
  const counterMismatch = input.scheduleCallsGlobal != null
    && (input.scheduleCallsGlobal !== scheduleCalls || input.callbackCallsGlobal !== callbackCalls);

  const lastWaiting = formatLastEventAgo(input.videoEvents, 'waiting', now);
  const lastStalled = formatLastEventAgo(input.videoEvents, 'stalled', now);
  const lastPause = formatLastEventAgo(input.videoEvents, 'pause', now);
  const lastCanplay = formatLastEventAgo(input.videoEvents, 'canplay', now);

  console.table([{
    producerDone: input.producerDone,
    settled: input.settled,
    shouldReschedule: input.shouldReschedule,
    aborted: input.aborted,
    scheduleCalls,
    callbackCalls,
    gap,
    scheduleCalls_global: input.scheduleCallsGlobal ?? scheduleCalls,
    callbackCalls_global: input.callbackCallsGlobal ?? callbackCalls,
    counterMismatch,
    lastOnFrameCurrentTime: input.lastOnFrameCurrentTime != null
      ? input.lastOnFrameCurrentTime.toFixed(3) : 'n/a',
    lastOnFrameMediaTime: input.lastOnFrameMediaTime != null
      ? input.lastOnFrameMediaTime.toFixed(3) : 'n/a',
    'video.currentTime_live': input.videoCurrentTime.toFixed(3),
    rvfcMediaDriftSec: rvfcMediaDriftSec != null ? rvfcMediaDriftSec.toFixed(3) : 'n/a',
    rvfcCallbackIdleMs,
    stallTimeoutMs,
    watchdogOverrunMs: Math.round(watchdogOverrunMs),
    watchdogDelayed,
    videoCurrentTimeIdleMs,
    'video.readyState': input.videoReadyState,
    'video.paused': input.videoPaused,
    'video.ended': input.videoEnded,
    'document.visibilityState': input.visibilityState,
    lastWaitingEvent: lastWaiting,
    lastStalledEvent: lastStalled,
    lastPauseEvent: lastPause,
    lastCanplayEvent: lastCanplay,
    'classify.videoPaused': input.classifyOpts.videoPaused,
    'classify.videoEnded': input.classifyOpts.videoEnded,
    'classify.videoWaitingRecent': input.classifyOpts.videoWaitingRecent,
    'classify.videoStalledRecent': input.classifyOpts.videoStalledRecent,
    'classify.rvfcCallbackIdleMs': Math.round(input.classifyOpts.rvfcCallbackIdleMs),
    'classify.videoCurrentTimeIdleMs': Math.round(input.classifyOpts.videoCurrentTimeIdleMs),
    'classify.aborted': input.classifyOpts.aborted,
    'classify.onFrameErrors': input.classifyOpts.onFrameErrors,
    'classify.scheduleCallCount': input.classifyOpts.scheduleCallCount,
    'classify.onFrameCallCount': input.classifyOpts.onFrameCallCount,
    'classify.handleRegistered': input.classifyOpts.handleRegistered,
    'classify.stallReason': input.classifyOpts.stallReason.slice(0, 120),
    'classify.cause': forced.cause,
    workerErrorCount: workerErrors.length,
    workerPropagatedToSampler: workerPropagated,
    videoTimelineFrozen: timelineFrozen,
    rvfcMediaDesync,
    videoPlayingWithoutRvfc,
    droppedVideoFrames: input.droppedVideoFrames ?? 'n/a',
    totalVideoFrames: input.totalVideoFrames ?? 'n/a',
    browserDropRatePct: dropRatePct != null ? `${dropRatePct}%` : 'n/a',
    samplerDroppedFrames: input.samplerDroppedFrames ?? 0,
    workerErrorMsBeforeStall,
    workerPrecedesStall,
  }]);

  const producerJudgment = judgeProducerTermination(input);
  if (producerJudgment) console.info(producerJudgment);

  if (rvfcNeverFired) {
    console.info('② producerDone=false && scheduleCalls > callbackCalls → requestVideoFrameCallback이 브라우저에서 호출되지 않은 것으로 판단');
  }

  if (timelineFrozen) {
    console.info('③ video.currentTime ≈ lastOnFrameCurrentTime → Video Timeline(디코더) 자체가 멈춘 것으로 판단');
  } else if (videoPlayingWithoutRvfc) {
    console.info(
      `③' video는 재생 중(currentTime=${input.videoCurrentTime.toFixed(2)}s)이나 `
      + `RVFC 마지막 관측=${input.lastOnFrameCurrentTime?.toFixed(2) ?? 'n/a'}s `
      + `(drift=${rvfcMediaDriftSec?.toFixed(2) ?? 'n/a'}s) → Timeline은 진행, RVFC만 끊김`,
    );
  }

  if (decoderWaiting) {
    console.info('④ waiting/stalled 이벤트 존재 → Decoder Stall 가능성');
  }

  if (watchdogDelayed) {
    console.info(
      `⑥ Watchdog 지연 감지 — 설정 ${stallTimeoutMs}ms, 실제 idle ${rvfcCallbackIdleMs}ms `
      + `(+${Math.round(watchdogOverrunMs)}ms) → 메인 스레드 블로킹(MediaPipe 등)으로 setInterval 체크가 늦었을 가능성`,
    );
  }

  if (dropRatePct != null && dropRatePct >= 10) {
    console.info(`⑦ 브라우저 droppedVideoFrames ${dropRatePct}% — 디코더/GPU 부하가 RVFC 끊김과 동반되었을 가능성`);
  }

  if (workerErrors.length) {
    const lastWe = workerErrors[workerErrors.length - 1];
    const msBeforeStall = Math.round(now - lastWe.atMs);
    console.info(
      `⑤ Worker Error 존재 (${workerErrors.length}건, ${msBeforeStall}ms 전, "${lastWe.message}") → `
      + `Sampler까지 전파: ${workerPropagated ? '예' : '아니오'}`,
    );
    if (!workerPropagated && msBeforeStall < rvfcCallbackIdleMs) {
      console.info('⑤\' Worker Error가 RVFC 끊김보다 먼저 발생 — 상관 가능성 있으나 인과 미확정 (전파 없음)');
    }
  }

  if (counterMismatch) {
    console.warn('[RVFC-Diag] schedule/callback 카운터 불일치 — global vs local', {
      local: { scheduleCalls, callbackCalls },
      global: { scheduleCalls: input.scheduleCallsGlobal, callbackCalls: input.callbackCallsGlobal },
    });
  }

  const mostProbable = resolveMostProbableRootCause(input, {
    rvfcNeverFired,
    timelineFrozen,
    decoderWaiting,
    workerPropagated,
    producerTerminated: input.producerDone,
  }, forced);

  console.info('');
  console.info('==========================');
  console.info('RVFC RCA SUMMARY');
  console.info('==========================');
  console.info('');
  console.info(`Producer terminated : ${input.producerDone}`);
  console.info(`RVFC registered : ${scheduleCalls}`);
  console.info(`RVFC callbacks : ${callbackCalls}`);
  console.info(`Gap : ${gap}`);
  console.info('');
  console.info(`Video Timeline Frozen : ${timelineFrozen}`);
  console.info(`RVFC-Media Desync : ${rvfcMediaDesync}`);
  if (rvfcMediaDriftSec != null) {
    console.info(`RVFC-Media Drift (sec) : ${rvfcMediaDriftSec.toFixed(3)}`);
  }
  console.info(`Video Playing Without RVFC : ${videoPlayingWithoutRvfc}`);
  if (watchdogDelayed) {
    console.info(`Watchdog Overrun (ms) : ${Math.round(watchdogOverrunMs)}`);
  }
  console.info('');
  console.info(`Decoder Waiting : ${decoderWaiting}`);
  console.info('');
  console.info(`Worker Propagated : ${workerPropagated}`);
  if (workerErrors.length) {
    console.info(`Worker Error Detected : true (${workerErrors.length}건, ${workerErrorMsBeforeStall}ms 전)`);
    console.info(`Worker Precedes RVFC Stall : ${workerPrecedesStall ? 'true (RVFC 끊김보다 먼저)' : 'false'}`);
  } else {
    console.info('Worker Error Detected : false');
  }
  console.info('');
  console.info('Most Probable Root Cause :');
  console.info(mostProbable);
  console.info('');
  console.info('==========================');
}

export function dumpRvfcStallTimeline(): void {
  const playStart = sessionPlayStartAtMs;
  console.group('[RVFC-Diag] Stall Timeline (play 기준 상대 ms)');
  console.table(timeline.map((e) => ({
    relativeMs: e.relativeMs,
    label: e.label,
    detail: e.detail ?? '',
    wallAtMs: Math.round(e.atMs),
  })));
  if (playStart == null) {
    console.info('(play 시작 시각 미기록)');
  }
  console.groupEnd();
}

export function getRvfcDiagTimeline(): RvfcDiagTimelineEntry[] {
  return timeline.slice();
}
