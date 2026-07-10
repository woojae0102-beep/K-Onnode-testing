// @ts-nocheck
/**
 * Pipeline Diagnostics — Frame Timeline · Deadlock · Video Health · Snapshot · Stall 분류
 *
 * window.__K_ONNODE_PIPELINE_DIAG__
 */
import { recordTelemetry } from './pipelineTelemetry';
import { getHungWorkers, getWorkerHealthStatuses } from './workerHealthMonitor';
import { formatReadyState, formatNetworkState } from './rvfcStallDiagnostics';
import type { RvfcDiagnosticsSnapshot } from './rvfcStallDiagnostics';
import { readHeapBytes, bytesToMb } from './memoryProfiler';

export type FrameTimelineStage =
  | 'capture'
  | 'queue-enter'
  | 'queue-exit'
  | 'mediapipe-start'
  | 'mediapipe-end'
  | 'tracking-start'
  | 'tracking-end'
  | 'worker-send'
  | 'worker-ack'
  | 'database-save'
  | 'renderer-start'
  | 'renderer-end';

export type StallCause =
  | 'VIDEO_PAUSED'
  | 'VIDEO_WAITING'
  | 'VIDEO_STALLED'
  | 'RVFC_CHAIN_BROKEN'
  | 'MEDIAPIPE_BLOCKED'
  | 'WORKER_HUNG'
  | 'QUEUE_DEADLOCK'
  | 'WEBCODECS_FAILURE'
  | 'UNKNOWN';

export type FrameTimelineEntry = {
  key: string;
  frameIndex: number | null;
  sampleTime: number;
  capture?: number;
  'queue-enter'?: number;
  'queue-exit'?: number;
  'mediapipe-start'?: number;
  'mediapipe-end'?: number;
  'tracking-start'?: number;
  'tracking-end'?: number;
  'worker-send'?: number;
  'worker-ack'?: number;
  'database-save'?: number;
  'renderer-start'?: number;
  'renderer-end'?: number;
};

export type PipelineSnapshot = {
  atMs: number;
  samplerQueue: number;
  pipelineQueues: Record<string, number>;
  rvfcFps: number;
  mediaPipeDelayMs: number;
  workerDelayMs: number;
  coverage: number;
  trackCount: number;
  memoryMb: number | null;
  workerQueueLength: number;
};

export type StageProcessingState = {
  stage: string;
  frameKey: string;
  frameIndex: number | null;
  sampleTime: number;
  sinceMs: number;
};

const TIMELINE_CAPACITY = 1000;
const TIMELINE_DUMP_COUNT = 100;
const SNAPSHOT_CAPACITY = 300; // 5분 @ 1s
const DEADLOCK_THRESHOLD_MS = 10_000;
const VIDEO_TIME_STALL_MS = 3000;

class RingBuffer<T> {
  private buf: T[] = [];
  constructor(private capacity: number) {}
  push(item: T) {
    this.buf.push(item);
    if (this.buf.length > this.capacity) this.buf.shift();
  }
  tail(n: number): T[] {
    return this.buf.slice(-n);
  }
  all(): T[] {
    return this.buf.slice();
  }
  clear() {
    this.buf.length = 0;
  }
}

function createPipelineDiagnostics() {
  const timelineRing = new RingBuffer<FrameTimelineEntry>(TIMELINE_CAPACITY);
  const snapshotRing = new RingBuffer<PipelineSnapshot>(SNAPSHOT_CAPACITY);
  const timelineByKey = new Map<string, FrameTimelineEntry>();

  let sessionActive = false;
  let videoRef: HTMLVideoElement | null = null;
  let decodePath: string = 'unknown';
  let snapshotTimer: ReturnType<typeof setInterval> | null = null;
  let deadlockTimer: ReturnType<typeof setInterval> | null = null;
  let videoHealthTimer: ReturnType<typeof setInterval> | null = null;

  let metricsProvider: (() => Partial<PipelineSnapshot> & Record<string, unknown>) | null = null;
  let stageStatsProvider: (() => Array<{
    name: string;
    queueLength: number;
    processedCount: number;
    droppedCount: number;
  }>) | null = null;

  let lastVideoCurrentTime = 0;
  let lastVideoTimeChangeAt = performance.now();
  let lastCompletedFrameIndex = -1;
  const stageProcessing = new Map<string, StageProcessingState>();
  const stageQueueFingerprint = new Map<string, { queueLength: number; processedCount: number; sinceMs: number }>();
  let deadlockDetected = false;
  let deadlockStage: string | null = null;
  let mediapipeBlockedSince: number | null = null;
  let webCodecsFailed = false;
  const recentVideoEvents: Array<{ event: string; atMs: number; currentTime: number }> = [];

  const frameKeyFromSampleTime = (t: number) => `t${Math.round(t * 10000)}`;

  const getOrCreateTimeline = (sampleTime: number, key?: string): FrameTimelineEntry => {
    const k = key || frameKeyFromSampleTime(sampleTime);
    let entry = timelineByKey.get(k);
    if (!entry) {
      entry = { key: k, frameIndex: null, sampleTime };
      timelineByKey.set(k, entry);
      timelineRing.push(entry);
      if (timelineByKey.size > TIMELINE_CAPACITY * 1.5) {
        const oldest = timelineRing.tail(TIMELINE_CAPACITY)[0];
        if (oldest) timelineByKey.delete(oldest.key);
      }
    }
    return entry;
  };

  const markTimeline = (sampleTime: number, stage: FrameTimelineStage, frameIndex?: number | null) => {
    if (!sessionActive) return;
    const entry = getOrCreateTimeline(sampleTime);
    if (frameIndex != null) entry.frameIndex = frameIndex;
    entry[stage] = performance.now();
  };

  const setFrameIndex = (sampleTime: number, frameIndex: number) => {
    const entry = getOrCreateTimeline(sampleTime);
    entry.frameIndex = frameIndex;
    lastCompletedFrameIndex = Math.max(lastCompletedFrameIndex, frameIndex);
  };

  const setStageProcessing = (stage: string, sampleTime: number, frameIndex: number | null = null) => {
    const fk = frameKeyFromSampleTime(sampleTime);
    stageProcessing.set(stage, {
      stage,
      frameKey: fk,
      frameIndex,
      sampleTime,
      sinceMs: performance.now(),
    });
    if (stage === 'mediapipe') {
      mediapipeBlockedSince = performance.now();
    }
  };

  const clearStageProcessing = (stage: string) => {
    stageProcessing.delete(stage);
    if (stage === 'mediapipe') mediapipeBlockedSince = null;
  };

  const recordVideoEvent = (event: string, currentTime: number) => {
    recentVideoEvents.push({ event, atMs: performance.now(), currentTime });
    if (recentVideoEvents.length > 50) recentVideoEvents.shift();
  };

  const tickVideoHealth = () => {
    if (!videoRef) return;
    const ct = Number(videoRef.currentTime) || 0;
    const now = performance.now();
    if (Math.abs(ct - lastVideoCurrentTime) > 0.01) {
      lastVideoCurrentTime = ct;
      lastVideoTimeChangeAt = now;
    } else if (now - lastVideoTimeChangeAt > VIDEO_TIME_STALL_MS && !videoRef.paused && !videoRef.ended) {
      const analysis = analyzeVideoStall();
      console.warn('[PipelineDiag] video.currentTime 3초+ 정체', analysis);
    }
  };

  const analyzeVideoStall = () => {
    if (!videoRef) return { possibleCauses: ['no video ref'] };
    const causes: string[] = [];
    if (videoRef.paused) causes.push('video.pause() 상태 — RVFC는 재생 중에만 호출됨');
    if (document.visibilityState === 'hidden') causes.push('탭 비활성(visibility=hidden) — 브라우저가 디코드/throttle 할 수 있음');
    if (videoRef.readyState < 2) causes.push(`readyState=${formatReadyState(videoRef.readyState)} — 버퍼 부족`);
    if (videoRef.networkState === 2) causes.push('networkState=LOADING — 네트워크 재버퍼링');
    const recent = recentVideoEvents.slice(-5);
    if (recent.some((e) => e.event === 'waiting')) causes.push('최근 waiting 이벤트 — 디코더 대기');
    if (recent.some((e) => e.event === 'stalled')) causes.push('최근 stalled 이벤트 — 미디어 스트림 정체');
    if (recent.some((e) => e.event === 'pause')) causes.push('최근 pause 이벤트');
    if (!causes.length) causes.push('원인 불명 — GPU/디코더 내부 정지 또는 RVFC 체인 끊김 가능');
    return {
      currentTime: videoRef.currentTime,
      readyState: formatReadyState(videoRef.readyState),
      networkState: formatNetworkState(videoRef.networkState),
      paused: videoRef.paused,
      playbackRate: videoRef.playbackRate,
      visibility: document.visibilityState,
      decodePath,
      recentEvents: recent,
      possibleCauses: causes,
    };
  };

  const tickDeadlockDetector = () => {
    if (!stageStatsProvider) return;
    const now = performance.now();
    const stats = stageStatsProvider();
    stats.forEach((st) => {
      const prev = stageQueueFingerprint.get(st.name);
      const same = prev
        && prev.queueLength === st.queueLength
        && prev.processedCount === st.processedCount
        && st.queueLength > 0;
      if (!prev || !same) {
        stageQueueFingerprint.set(st.name, {
          queueLength: st.queueLength,
          processedCount: st.processedCount,
          sinceMs: now,
        });
        return;
      }
      if (now - prev.sinceMs >= DEADLOCK_THRESHOLD_MS && !deadlockDetected) {
        deadlockDetected = true;
        deadlockStage = st.name;
        dumpDeadlock(st.name, stats);
      }
    });
    // mediapipe 장시간 처리 중
    const mp = stageProcessing.get('mediapipe');
    if (mp && now - mp.sinceMs > DEADLOCK_THRESHOLD_MS) {
      mediapipeBlockedSince = mp.sinceMs;
    }
  };

  const dumpDeadlock = (stageName: string, stats: ReturnType<NonNullable<typeof stageStatsProvider>>) => {
    const proc = Array.from(stageProcessing.values());
    console.group(`[PipelineDiag] QUEUE DEADLOCK 의심 — stage=${stageName}`);
    console.table(stats.map((s) => ({
      stage: s.name,
      queueLength: s.queueLength,
      processed: s.processedCount,
      dropped: s.droppedCount,
      stuckMs: Math.round(performance.now() - (stageQueueFingerprint.get(s.name)?.sinceMs ?? performance.now())),
    })));
    console.info('Stack Trace:', new Error(`deadlock@${stageName}`).stack);
    console.info('현재 처리 중:', proc);
    console.info('마지막 완료 frameIndex:', lastCompletedFrameIndex);
    console.groupEnd();
    recordTelemetry('pipeline_error', `Queue deadlock suspected: ${stageName}`, {
      subsystem: 'pipeline-deadlock',
      severity: 'error',
      meta: { stageName, stats, processing: proc, lastCompletedFrameIndex },
    });
  };

  const takeSnapshot = () => {
    if (!sessionActive || !metricsProvider) return;
    const m = metricsProvider();
    const snap: PipelineSnapshot = {
      atMs: performance.now(),
      samplerQueue: Number(m.samplerQueue) || 0,
      pipelineQueues: (m.pipelineQueues as Record<string, number>) || {},
      rvfcFps: Number(m.rvfcFps) || 0,
      mediaPipeDelayMs: Number(m.mediaPipeDelayMs) || 0,
      workerDelayMs: Number(m.workerDelayMs) || 0,
      coverage: Number(m.coverage) || 0,
      trackCount: Number(m.trackCount) || 0,
      memoryMb: m.memoryMb != null ? Number(m.memoryMb) : bytesToMb(readHeapBytes()),
      workerQueueLength: Number(m.workerQueueLength) || 0,
    };
    snapshotRing.push(snap);
  };

  const dumpTimeline = (count = TIMELINE_DUMP_COUNT) => {
    const rows = timelineRing.tail(count).map((e) => {
      const delta = (a?: number, b?: number) => (a != null && b != null ? Math.round(b - a) : '');
      return {
        frame: e.frameIndex ?? '—',
        sampleTime: e.sampleTime.toFixed(2),
        cap: e.capture ? '✓' : '',
        qIn: e['queue-enter'] ? '✓' : '',
        qOut: e['queue-exit'] ? '✓' : '',
        mp: delta(e['mediapipe-start'], e['mediapipe-end']),
        tr: delta(e['tracking-start'], e['tracking-end']),
        wSend: e['worker-send'] ? '✓' : '',
        wAck: e['worker-ack'] ? '✓' : '',
        db: e['database-save'] ? '✓' : '',
      };
    });
    console.group(`[PipelineDiag] Frame Timeline (최근 ${rows.length}프레임)`);
    console.table(rows);
    console.groupEnd();
  };

  const dumpSnapshots = (count = 60) => {
    const rows = snapshotRing.tail(count).map((s, i, arr) => {
      const prev = arr[i - 1];
      return {
        agoSec: prev ? Math.round((s.atMs - prev.atMs) / 1000) : 0,
        samplerQ: s.samplerQueue,
        rvfcFps: s.rvfcFps.toFixed(1),
        mpDelay: Math.round(s.mediaPipeDelayMs),
        workerDelay: Math.round(s.workerDelayMs),
        coverage: `${Math.round(s.coverage * 100)}%`,
        tracks: s.trackCount,
        memMb: s.memoryMb?.toFixed(1) ?? 'n/a',
        workerQ: s.workerQueueLength,
        ...Object.fromEntries(Object.entries(s.pipelineQueues).map(([k, v]) => [`q_${k}`, v])),
      };
    });
    console.group(`[PipelineDiag] Pipeline Snapshots (최근 ${rows.length}초)`);
    console.table(rows);
    console.groupEnd();
  };

  const classifyStall = (rvfcSnap: RvfcDiagnosticsSnapshot | null, reason: string): {
    cause: StallCause;
    confidence: string;
    evidence: string[];
  } => {
    const evidence: string[] = [];
    const now = performance.now();
    const recent = rvfcSnap?.videoEvents ?? recentVideoEvents.map((e) => ({ event: e.event, atMs: e.atMs }));

    const recentWithin = (ev: string, ms = 15000) =>
      recent.some((e) => e.event === ev && now - e.atMs < ms);

    if (videoRef?.paused || recentWithin('pause')) {
      evidence.push('video.paused=true 또는 최근 pause 이벤트');
      return { cause: 'VIDEO_PAUSED', confidence: 'high', evidence };
    }
    if (recentWithin('waiting')) {
      evidence.push('최근 waiting 이벤트 — 디코더 버퍼 대기');
      return { cause: 'VIDEO_WAITING', confidence: 'high', evidence };
    }
    if (recentWithin('stalled')) {
      evidence.push('최근 stalled 이벤트');
      return { cause: 'VIDEO_STALLED', confidence: 'high', evidence };
    }
    if (webCodecsFailed || decodePath === 'webcodecs') {
      evidence.push(`decodePath=${decodePath}, webCodecsFailed=${webCodecsFailed}`);
      return { cause: 'WEBCODECS_FAILURE', confidence: 'medium', evidence };
    }
    const hung = getHungWorkers();
    if (hung.length) {
      evidence.push(`Hung workers: ${hung.map((w) => w.name).join(', ')}`);
      return { cause: 'WORKER_HUNG', confidence: 'high', evidence };
    }
    if (deadlockDetected && deadlockStage) {
      evidence.push(`Stage queue ${deadlockStage} 10초+ 무변화`);
      return { cause: 'QUEUE_DEADLOCK', confidence: 'high', evidence };
    }
    const mpProc = stageProcessing.get('mediapipe');
    if (mpProc && now - mpProc.sinceMs > DEADLOCK_THRESHOLD_MS) {
      evidence.push(`mediapipe 처리 중 ${Math.round(now - mpProc.sinceMs)}ms — frameIndex=${mpProc.frameIndex}`);
      return { cause: 'MEDIAPIPE_BLOCKED', confidence: 'high', evidence };
    }
    if (mediapipeBlockedSince && now - mediapipeBlockedSince > DEADLOCK_THRESHOLD_MS) {
      evidence.push('mediapipe stage 장시간 블로킹');
      return { cause: 'MEDIAPIPE_BLOCKED', confidence: 'medium', evidence };
    }
    if (rvfcSnap) {
      const chainGap = rvfcSnap.scheduleCallCount - rvfcSnap.onFrameCallCount;
      if (rvfcSnap.onFrameErrors > 0 || chainGap > 2 || !rvfcSnap.handleRegistered) {
        if (rvfcSnap.onFrameErrors > 0) evidence.push(`onFrame 예외 ${rvfcSnap.onFrameErrors}회`);
        if (chainGap > 2) evidence.push(`schedule/onFrame 불일치 gap=${chainGap}`);
        if (!rvfcSnap.handleRegistered) evidence.push('RVFC handle 미등록');
        return { cause: 'RVFC_CHAIN_BROKEN', confidence: 'high', evidence };
      }
      if (now - lastVideoTimeChangeAt > VIDEO_TIME_STALL_MS && !videoRef?.ended) {
        evidence.push(`currentTime ${Math.round(now - lastVideoTimeChangeAt)}ms 무변화`);
        evidence.push(...(analyzeVideoStall().possibleCauses as string[]));
      }
    }
    evidence.push(reason);
    return { cause: 'UNKNOWN', confidence: 'low', evidence };
  };

  const handleRvfcStall = (
    rvfcSnap: RvfcDiagnosticsSnapshot | null,
    reason: string,
    forced?: { cause: string; evidence: string[] },
  ) => {
    const classification = forced ?? classifyStall(rvfcSnap, reason);
    console.group(`[PipelineDiag] RVFC STALL — ${forced?.cause ?? classification.cause}`);
    console.info('판단 근거:', forced?.evidence ?? classification.evidence);
    dumpTimeline();
    dumpSnapshots();
    console.table({ Workers: getWorkerHealthStatuses().map((w) => ({
      name: w.name,
      hung: w.hung,
      lastPongAgoMs: w.lastPongAtMs ? Math.round(performance.now() - w.lastPongAtMs) : 'never',
      managed: w.managed,
      restarts: w.restartCount,
    })) });
    if (videoRef) console.table({ 'Video Health': analyzeVideoStall() });
    console.groupEnd();
    recordTelemetry('pipeline_error', `RVFC Stall classified: ${classification.cause}`, {
      subsystem: 'pipeline-diagnostics',
      severity: 'error',
      meta: { classification, reason },
    });
    if (typeof window !== 'undefined') {
      (window as any).__K_ONNODE_PIPELINE_DIAG__ = {
        classification,
        timeline: timelineRing.tail(TIMELINE_DUMP_COUNT),
        snapshots: snapshotRing.tail(120),
        workerHealth: getWorkerHealthStatuses(),
      };
    }
    return classification;
  };

  const startSession = (opts: {
    video?: HTMLVideoElement | null;
    decodePath?: string;
    metricsProvider?: typeof metricsProvider;
    stageStatsProvider?: typeof stageStatsProvider;
  }) => {
    endSession();
    sessionActive = true;
    videoRef = opts.video ?? null;
    decodePath = opts.decodePath ?? 'unknown';
    metricsProvider = opts.metricsProvider ?? null;
    stageStatsProvider = opts.stageStatsProvider ?? null;
    deadlockDetected = false;
    deadlockStage = null;
    webCodecsFailed = false;
    lastVideoCurrentTime = videoRef ? Number(videoRef.currentTime) || 0 : 0;
    lastVideoTimeChangeAt = performance.now();

    snapshotTimer = setInterval(takeSnapshot, 1000);
    deadlockTimer = setInterval(tickDeadlockDetector, 1000);
    videoHealthTimer = setInterval(tickVideoHealth, 500);
  };

  const endSession = () => {
    sessionActive = false;
    if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = null; }
    if (deadlockTimer) { clearInterval(deadlockTimer); deadlockTimer = null; }
    if (videoHealthTimer) { clearInterval(videoHealthTimer); videoHealthTimer = null; }
    videoRef = null;
    metricsProvider = null;
    stageStatsProvider = null;
    stageProcessing.clear();
    stageQueueFingerprint.clear();
  };

  const markWebCodecsFailed = () => { webCodecsFailed = true; };

  return {
    frameKeyFromSampleTime,
    markTimeline,
    setFrameIndex,
    setStageProcessing,
    clearStageProcessing,
    recordVideoEvent,
    startSession,
    endSession,
    handleRvfcStall,
    dumpTimeline,
    dumpSnapshots,
    classifyStall,
    markWebCodecsFailed,
    setDecodePath: (p: string) => { decodePath = p; },
    getTimeline: () => timelineRing.all(),
    getSnapshots: () => snapshotRing.all(),
  };
}

export const pipelineDiagnostics = createPipelineDiagnostics();

if (typeof window !== 'undefined') {
  (window as any).__K_ONNODE_PIPELINE_DIAG__ = pipelineDiagnostics;
}
