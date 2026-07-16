// @ts-nocheck
/**
 * RVFC Stall Diagnostics — sampleVideoFramesPlayback() Producer 체인이
 * 어디서 끊겼는지(video pause / RVFC 미재등록 / WebCodecs / Queue 등) 추적한다.
 *
 * 사용:
 *   ?rvfcDebug=1  — 5초마다 스냅샷 콘솔 출력 (DEV)
 *   Stall 발생 시 — 전체 덤프 자동 출력 + Telemetry 기록
 *   window.__K_ONNODE_RVFC_DIAG__ — 최신 스냅샷 조회
 */
import { recordTelemetry } from './pipelineTelemetry';
import { pipelineDiagnostics } from './pipelineDiagnostics';
import {
  classifyRvfcBreak,
  dumpPropagationCallGraph,
  getRvfcScheduleState,
  recordCallback,
  recordSchedule,
  resetPropagationSession,
  resetRvfcScheduleState,
} from './workerErrorDiagnostics';
import {
  buildRcaTelemetryMeta,
  dumpRvfcRcaTableAndSummary,
  dumpRvfcStallTimeline,
  logRvfcCallbackLost,
  markRvfcPlayStart,
  recordRvfcDiagEvent,
  resetRvfcDiagSession,
} from './rvfcDiagnosticLog';
import type { FrameLoopHandle } from './cameraFrameLoop';

export type VideoEventName =
  | 'pause' | 'waiting' | 'stalled' | 'playing' | 'ended' | 'error'
  | 'seeking' | 'seeked' | 'canplay' | 'canplaythrough' | 'loadeddata' | 'loadstart'
  | 'suspend' | 'emptied' | 'abort' | 'timeupdate';

export type VideoEventRecord = {
  event: VideoEventName;
  atMs: number;
  currentTime: number;
  readyState: number;
  networkState: number;
  paused: boolean;
  ended: boolean;
  detail?: string;
};

export type RvfcDiagnosticsSnapshot = {
  atMs: number;
  /** 1. video.currentTime */
  currentTime: number;
  /** 2. video.readyState */
  readyState: number;
  /** 3. video.networkState */
  networkState: number;
  /** 4. video.paused */
  paused: boolean;
  /** 5. video.ended */
  ended: boolean;
  /** 6. document.visibilityState */
  visibilityState: string;
  /** 7. scheduleVideoFrame() 호출 횟수 */
  scheduleCallCount: number;
  /** 8. onFrame() 호출 횟수 */
  onFrameCallCount: number;
  /** 9. 마지막 onFrame 시점 currentTime */
  lastOnFrameCurrentTime: number | null;
  lastOnFrameMediaTime: number | null;
  lastOnFrameAtMs: number | null;
  /** 10. video 이벤트 로그 (최근) */
  videoEvents: VideoEventRecord[];
  /** 11. WebCodecs 사용 여부 */
  decodePath: 'rvfc' | 'webcodecs' | 'webcodecs-fallback-rvfc' | 'unknown';
  /** 12–13. 외부(파이프라인/Worker) 큐 — MotionExtractionEngine에서 주입 */
  external: Record<string, unknown>;
  /** 14. RVFC handle 정상 등록 여부 */
  handleRegistered: boolean;
  /** 15. 마지막 handle ID */
  lastHandleId: number | null;
  lastHandleType: 'rvfc' | 'raf' | null;
  /** Producer 상태 */
  nextSampleTime: number;
  endTime: number;
  producerDone: boolean;
  settled: boolean;
  aborted: boolean;
  shouldReschedule?: boolean;
  samplerQueueLength: number;
  rvfcCallbackCount: number;
  rvfcFps: number;
  lastRvfcIdleMs: number;
  droppedFrames: number;
  onFrameErrors: number;
  lastOnFrameError: string | null;
};

const MAX_EVENT_LOG = 80;
let globalDecodePath: RvfcDiagnosticsSnapshot['decodePath'] = 'unknown';
let externalDiagnosticsProvider: (() => Record<string, unknown>) | null = null;

export function setRvfcDecodePath(path: RvfcDiagnosticsSnapshot['decodePath']): void {
  globalDecodePath = path;
}

export function getRvfcDecodePath(): RvfcDiagnosticsSnapshot['decodePath'] {
  return globalDecodePath;
}

export function setRvfcExternalDiagnosticsProvider(fn: (() => Record<string, unknown>) | null): void {
  externalDiagnosticsProvider = fn;
}

export function isRvfcDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env?.DEV) return false;
  return new URLSearchParams(window.location.search).get('rvfcDebug') === '1';
}

const READY_STATE_LABELS = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
const NETWORK_STATE_LABELS = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'];

export function formatReadyState(n: number): string {
  return READY_STATE_LABELS[n] ?? `unknown(${n})`;
}

export function formatNetworkState(n: number): string {
  return NETWORK_STATE_LABELS[n] ?? `unknown(${n})`;
}

export function createRvfcStallDiagnostics(video: HTMLVideoElement) {
  const videoEvents: VideoEventRecord[] = [];
  let scheduleCallCount = 0;
  let onFrameCallCount = 0;
  let lastOnFrameCurrentTime: number | null = null;
  let lastOnFrameMediaTime: number | null = null;
  let lastOnFrameAtMs: number | null = null;
  let lastHandleId: number | null = null;
  let lastHandleType: 'rvfc' | 'raf' | null = null;
  let handleRegistered = false;
  let onFrameErrors = 0;
  let lastOnFrameError: string | null = null;
  let periodicHandle: ReturnType<typeof setInterval> | null = null;
  const listeners: Array<{ event: string; fn: (ev: Event) => void }> = [];

  const readVideoState = () => ({
    currentTime: Number(video.currentTime) || 0,
    readyState: video.readyState,
    networkState: video.networkState,
    paused: video.paused,
    ended: video.ended,
  });

  const recordVideoEvent = (event: VideoEventName, detail?: string) => {
    const state = readVideoState();
    const rec: VideoEventRecord = {
      event,
      atMs: performance.now(),
      currentTime: state.currentTime,
      readyState: state.readyState,
      networkState: state.networkState,
      paused: state.paused,
      ended: state.ended,
      detail,
    };
    videoEvents.push(rec);
    if (videoEvents.length > MAX_EVENT_LOG) videoEvents.shift();
    pipelineDiagnostics.recordVideoEvent(event, state.currentTime);

    const msg = `[RVFC-Diag] video.${event} — t=${state.currentTime.toFixed(2)}s `
      + `ready=${formatReadyState(state.readyState)} `
      + `net=${formatNetworkState(state.networkState)} `
      + `paused=${state.paused}`;
    if (event === 'pause' || event === 'waiting' || event === 'stalled' || event === 'error') {
      console.warn(msg, detail || '');
    } else if (event !== 'timeupdate') {
      console.info(msg);
    }
  };

  const attach = () => {
    const names: VideoEventName[] = [
      'pause', 'waiting', 'stalled', 'playing', 'ended', 'error',
      'seeking', 'seeked', 'canplay', 'canplaythrough', 'loadeddata', 'loadstart',
      'suspend', 'emptied', 'abort',
    ];
    names.forEach((name) => {
      const fn = (ev: Event) => {
        const detail = name === 'error'
          ? (video.error?.message || (ev as ErrorEvent).message || 'unknown')
          : undefined;
        recordVideoEvent(name, detail);
      };
      video.addEventListener(name, fn);
      listeners.push({ event: name, fn });
    });

    // timeupdate — Stall RCA용. play 시작 스냅샷(0s)만 있으면 timeline 정지로 오해하기 쉬움.
    let lastTimeupdateLogAt = 0;
    const onTimeupdate = () => {
      const t = performance.now();
      if (t - lastTimeupdateLogAt < 2000) return;
      lastTimeupdateLogAt = t;
      recordVideoEvent('timeupdate' as VideoEventName);
    };
    video.addEventListener('timeupdate', onTimeupdate);
    listeners.push({ event: 'timeupdate', fn: onTimeupdate });
  };

  const detach = () => {
    listeners.forEach(({ event, fn }) => video.removeEventListener(event, fn));
    listeners.length = 0;
    if (periodicHandle) {
      clearInterval(periodicHandle);
      periodicHandle = null;
    }
  };

  const recordScheduleLocal = (handle: FrameLoopHandle | null) => {
    scheduleCallCount += 1;
    if (handle) {
      lastHandleId = handle.id;
      lastHandleType = handle.type;
      handleRegistered = handle.type === 'rvfc' && Number.isFinite(handle.id);
      if (handleRegistered) recordSchedule(handle.id);
    } else {
      handleRegistered = false;
    }
    recordRvfcDiagEvent('scheduleNextRvfc()', {
      handleId: lastHandleId,
      scheduleCalls: scheduleCallCount,
      callbackCalls: onFrameCallCount,
    });
  };

  const recordOnFrame = (mediaTime?: number) => {
    onFrameCallCount += 1;
    lastOnFrameAtMs = performance.now();
    lastOnFrameCurrentTime = Number(video.currentTime) || 0;
    lastOnFrameMediaTime = Number.isFinite(mediaTime) ? mediaTime : lastOnFrameCurrentTime;
    recordCallback(lastOnFrameMediaTime ?? undefined);
    recordRvfcDiagEvent('last RVFC callback', {
      mediaTime: lastOnFrameMediaTime,
      currentTime: lastOnFrameCurrentTime,
      callbackCalls: onFrameCallCount,
    });
  };

  const recordOnFrameError = (err: unknown) => {
    onFrameErrors += 1;
    lastOnFrameError = err instanceof Error ? err.message : String(err);
    console.error('[RVFC-Diag] onFrame 예외 — scheduleVideoFrame 체인 끊김 위험', err);
  };

  const buildSnapshot = (ctx: {
    nextSampleTime: number;
    endTime: number;
    producerDone: boolean;
    settled: boolean;
    aborted: boolean;
    shouldReschedule?: boolean;
    stallTimeoutMs?: number;
    samplerQueueLength: number;
    rvfcCallbackCount: number;
    rvfcFps: number;
    lastRvfcIdleMs: number;
    droppedFrames: number;
  }): RvfcDiagnosticsSnapshot => {
    const state = readVideoState();
    return {
      atMs: performance.now(),
      ...ctx,
      ...state,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
      scheduleCallCount,
      onFrameCallCount,
      lastOnFrameCurrentTime,
      lastOnFrameMediaTime,
      lastOnFrameAtMs,
      videoEvents: videoEvents.slice(-20),
      decodePath: globalDecodePath,
      external: externalDiagnosticsProvider?.() ?? {},
      handleRegistered,
      lastHandleId,
      lastHandleType,
      onFrameErrors,
      lastOnFrameError,
    };
  };

  const logSnapshot = (label: string, snap: RvfcDiagnosticsSnapshot) => {
    console.group(`[RVFC-Diag] ${label}`);
    console.table({
      Video: {
        currentTime: `${snap.currentTime.toFixed(2)}s`,
        readyState: formatReadyState(snap.readyState),
        networkState: formatNetworkState(snap.networkState),
        paused: snap.paused,
        ended: snap.ended,
        visibility: snap.visibilityState,
      },
      Producer: {
        nextSampleTime: `${snap.nextSampleTime.toFixed(2)}s`,
        endTime: `${snap.endTime.toFixed(2)}s`,
        producerDone: snap.producerDone,
        scheduleCalls: snap.scheduleCallCount,
        onFrameCalls: snap.onFrameCallCount,
        rvfcCallbacks: snap.rvfcCallbackCount,
        rvfcFps: snap.rvfcFps.toFixed(1),
        lastRvfcIdleMs: Math.round(snap.lastRvfcIdleMs),
        handleRegistered: snap.handleRegistered,
        lastHandleId: snap.lastHandleId,
        lastHandleType: snap.lastHandleType,
        onFrameErrors: snap.onFrameErrors,
      },
      Queues: {
        samplerQueue: snap.samplerQueueLength,
        droppedFrames: snap.droppedFrames,
        decodePath: snap.decodePath,
        ...snap.external,
      },
    });
    if (snap.videoEvents.length) {
      console.table(snap.videoEvents.map((e) => ({
        event: e.event,
        t: `${e.currentTime.toFixed(2)}s`,
        ready: formatReadyState(e.readyState),
        paused: e.paused,
        agoMs: Math.round(snap.atMs - e.atMs),
      })));
    }
    console.groupEnd();
  };

  const dumpStall = (reason: string, ctx: Parameters<typeof buildSnapshot>[0]) => {
    const snap = buildSnapshot(ctx);
    const rvfcState = getRvfcScheduleState();
    const now = performance.now();
    const liveVideo = readVideoState();
    const scheduleCalls = Math.max(snap.scheduleCallCount, rvfcState.scheduleCallCount);
    const callbackCalls = Math.max(snap.onFrameCallCount, rvfcState.callbackCallCount);
    const rvfcCallbackIdleMs = snap.lastOnFrameAtMs != null ? now - snap.lastOnFrameAtMs : 0;
    const videoCurrentTimeIdleMs = pipelineDiagnostics.getVideoTimeIdleMs?.() ?? 0;
    const stallTimeoutMs = ctx.stallTimeoutMs ?? 8000;
    const recentWithin = (ev: string, ms = 15000) =>
      videoEvents.some((e) => e.event === ev && performance.now() - e.atMs < ms);

    let playbackQuality: { totalVideoFrames: number; droppedVideoFrames: number } | null = null;
    try {
      if (typeof video.getVideoPlaybackQuality === 'function') {
        playbackQuality = video.getVideoPlaybackQuality();
      }
    } catch {
      playbackQuality = null;
    }

    recordRvfcDiagEvent('Watchdog RVFC Stall', {
      rvfcCallbackIdleMs: Math.round(rvfcCallbackIdleMs),
      stallTimeoutMs,
      watchdogOverrunMs: Math.max(0, Math.round(rvfcCallbackIdleMs - stallTimeoutMs)),
      videoCurrentTimeLive: liveVideo.currentTime,
      lastOnFrameCurrentTime: snap.lastOnFrameCurrentTime,
      lastOnFrameMediaTime: snap.lastOnFrameMediaTime,
      reason: reason.slice(0, 160),
    });

    const forced = classifyRvfcBreak({
      videoPaused: liveVideo.paused,
      videoEnded: liveVideo.ended,
      videoWaitingRecent: recentWithin('waiting'),
      videoStalledRecent: recentWithin('stalled'),
      rvfcCallbackIdleMs,
      videoCurrentTimeIdleMs,
      aborted: ctx.aborted,
      onFrameErrors: snap.onFrameErrors,
      scheduleCallCount: scheduleCalls,
      onFrameCallCount: callbackCalls,
      handleRegistered: snap.handleRegistered,
      stallReason: reason,
    });

    if (snap.lastOnFrameCurrentTime != null) {
      const drift = liveVideo.currentTime - snap.lastOnFrameCurrentTime;
      if (drift > 0.5 && !liveVideo.paused) {
        forced.evidence.push(
          `rvfcMediaDrift=${drift.toFixed(2)}s — video.currentTime=${liveVideo.currentTime.toFixed(2)}s, `
          + `lastOnFrame=${snap.lastOnFrameCurrentTime.toFixed(2)}s (timeline 진행, RVFC만 정지)`,
        );
      }
    }

    const rcaInput = {
      producerDone: ctx.producerDone,
      settled: ctx.settled,
      shouldReschedule: ctx.shouldReschedule ?? true,
      aborted: ctx.aborted,
      scheduleCalls,
      callbackCalls,
      lastOnFrameCurrentTime: snap.lastOnFrameCurrentTime,
      lastOnFrameMediaTime: snap.lastOnFrameMediaTime,
      videoCurrentTime: liveVideo.currentTime,
      videoReadyState: liveVideo.readyState,
      videoPaused: liveVideo.paused,
      videoEnded: liveVideo.ended,
      visibilityState: snap.visibilityState,
      videoEvents,
      stallTimeoutMs,
      droppedVideoFrames: playbackQuality?.droppedVideoFrames ?? null,
      totalVideoFrames: playbackQuality?.totalVideoFrames ?? null,
      samplerDroppedFrames: ctx.droppedFrames ?? 0,
      classifyOpts: {
        videoPaused: liveVideo.paused,
        videoEnded: liveVideo.ended,
        videoWaitingRecent: recentWithin('waiting'),
        videoStalledRecent: recentWithin('stalled'),
        rvfcCallbackIdleMs,
        videoCurrentTimeIdleMs,
        aborted: ctx.aborted,
        onFrameErrors: snap.onFrameErrors,
        scheduleCallCount: scheduleCalls,
        onFrameCallCount: callbackCalls,
        handleRegistered: snap.handleRegistered,
        stallReason: reason,
      },
      forced,
      rvfcCallbackIdleMs,
      videoCurrentTimeIdleMs,
      scheduleCallsGlobal: rvfcState.scheduleCallCount,
      callbackCallsGlobal: rvfcState.callbackCallCount,
    };

    console.group(`[RVFC-Diag] STALL — ${reason}`);
    console.info('강제 분류:', forced.cause);
    console.info('근거:', forced.evidence);

    dumpRvfcRcaTableAndSummary(rcaInput);

    if (scheduleCalls !== callbackCalls) {
      logRvfcCallbackLost(scheduleCalls, callbackCalls, {
        lastScheduleHandleId: rvfcState.lastScheduleHandleId,
        producerDone: ctx.producerDone,
      });
    }

    if (playbackQuality) {
      console.table({
        'Video Playback Quality': {
          totalVideoFrames: playbackQuality.totalVideoFrames,
          droppedVideoFrames: playbackQuality.droppedVideoFrames,
          corruptedVideoFrames: playbackQuality.corruptedVideoFrames ?? 'n/a',
          dropRatePct: playbackQuality.totalVideoFrames
            ? `${((playbackQuality.droppedVideoFrames / playbackQuality.totalVideoFrames) * 100).toFixed(1)}%`
            : 'n/a',
        },
      });
    }

    console.group('[RVFC-Diag] videoEvents');
    console.table({
      'Video Live At Stall': {
        currentTime: `${liveVideo.currentTime.toFixed(3)}s`,
        readyState: formatReadyState(liveVideo.readyState),
        paused: liveVideo.paused,
        ended: liveVideo.ended,
        lastOnFrameMediaTime: snap.lastOnFrameMediaTime != null
          ? `${snap.lastOnFrameMediaTime.toFixed(3)}s` : 'n/a',
      },
    });
    console.info(
      '※ 아래 videoEvents는 이벤트 발생 시점 스냅샷. playing/canplaythrough(0s)만 있으면 '
      + 'timeline 정지로 오해하지 말 것 — Live At Stall / timeupdate 참고.',
    );
    console.table(videoEvents.slice(-12).map((e) => ({
      event: e.event,
      videoCurrentTime: `${e.currentTime.toFixed(3)}s`,
      atIso: new Date(e.atMs).toISOString(),
      agoMs: Math.round(now - e.atMs),
      readyState: formatReadyState(e.readyState),
      paused: e.paused,
      ended: e.ended,
    })));
    console.groupEnd();

    console.table({
      'RVFC Schedule (global state)': {
        lastScheduleAgoMs: rvfcState.lastScheduleSuccessAtMs
          ? Math.round(now - rvfcState.lastScheduleSuccessAtMs) : 'never',
        lastScheduleHandleId: rvfcState.lastScheduleHandleId,
        lastCallbackAgoMs: rvfcState.lastCallbackAtMs
          ? Math.round(now - rvfcState.lastCallbackAtMs) : 'never',
        lastCallbackMediaTime: rvfcState.lastCallbackMediaTime,
        scheduleCalls: rvfcState.scheduleCallCount,
        callbackCalls: rvfcState.callbackCallCount,
      },
    });

    dumpRvfcStallTimeline();
    dumpPropagationCallGraph();
    console.groupEnd();

    pipelineDiagnostics.handleRvfcStall(snap, reason, forced);
    logSnapshot(`STALL — ${reason} [${forced.cause}]`, snap);
    recordTelemetry('pipeline_error', `RVFC Stall: ${reason}`, {
      subsystem: 'rvfc-producer',
      severity: 'error',
      meta: {
        rca: buildRcaTelemetryMeta(rcaInput),
        snapshot: snap,
      },
    });
    if (typeof window !== 'undefined') {
      (window as any).__K_ONNODE_RVFC_DIAG__ = { snapshot: snap, history: videoEvents };
    }
    return snap;
  };

  const startPeriodicLog = (getCtx: () => Parameters<typeof buildSnapshot>[0]) => {
    if (!isRvfcDebugMode()) return;
    periodicHandle = setInterval(() => {
      logSnapshot('periodic', buildSnapshot(getCtx()));
    }, 5000);
  };

  attach();

  resetPropagationSession();
  resetRvfcScheduleState();
  resetRvfcDiagSession();

  return {
    recordSchedule: recordScheduleLocal,
    recordOnFrame,
    recordOnFrameError,
    buildSnapshot,
    logSnapshot,
    dumpStall,
    startPeriodicLog,
    detach,
  };
}
