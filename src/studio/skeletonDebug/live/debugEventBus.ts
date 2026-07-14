// @ts-nocheck
/**
 * Skeleton Debug Event Bus — Debug/Analysis Layer 전용.
 * disabled 시 publish는 no-op이며 Pipeline 알고리즘·결과에 영향 없음.
 */
import type {
  DebugBusEvent,
  DebugCoverageEvent,
  DebugFrameEvent,
  DebugHungarianEvent,
  DebugKalmanEvent,
  DebugMediaPipeEvent,
  DebugOcclusionEvent,
  DebugPerformanceEvent,
  DebugRcaEvent,
  DebugTrackingEvent,
  DebugWorkerEvent,
  FrameDebugSnapshot,
  LiveDebugState,
} from './debugEventTypes';
import { COVERAGE_RCA_THRESHOLD, PERFORMANCE_RING_SIZE, PERFORMANCE_THRESHOLD_MS } from './debugEventTypes';

type Listener = (event: DebugBusEvent, state: LiveDebugState) => void;

function emptyFrameSnapshot(frameIndex: number, timestamp = 0, sourceVideoTime = 0): FrameDebugSnapshot {
  return {
    frameIndex,
    timestamp,
    sourceVideoTime,
    hungarian: [],
    kalman: [],
    occlusions: [],
    rca: [],
  };
}

function createLiveState(): LiveDebugState {
  return {
    enabled: false,
    isLive: false,
    currentFrameIndex: 0,
    currentTimestamp: 0,
    coverage: 0,
    detectedCount: 0,
    trackedCount: 0,
    peakTrack: 0,
    workerQueue: 0,
    droppedFrames: 0,
    queueLength: 0,
    rvfcFps: 0,
    mediaPipeFps: 0,
    trackingFps: 0,
    totalProcessingMs: 0,
    frameSnapshot: null,
    rcaLog: [],
    performanceRing: [],
    coverageRing: [],
    confidenceByTrack: new Map(),
  };
}

let enabled = false;
let isLive = false;
let state: LiveDebugState = createLiveState();
const listeners = new Set<Listener>();
const frameSnapshots = new Map<number, FrameDebugSnapshot>();
let peakTrackObserved = 0;

export function isDebugEventBusEnabled(): boolean {
  return enabled;
}

export function enableDebugEventBus(live = true): void {
  enabled = true;
  isLive = live;
  resetDebugEventBus();
  state.enabled = true;
  state.isLive = live;
}

export function disableDebugEventBus(): void {
  enabled = false;
  isLive = false;
  state.enabled = false;
  state.isLive = false;
}

export function resetDebugEventBus(): void {
  state = createLiveState();
  state.enabled = enabled;
  state.isLive = isLive;
  frameSnapshots.clear();
  peakTrackObserved = 0;
}

export function getLiveDebugState(): LiveDebugState {
  return state;
}

export function getFrameDebugSnapshot(frameIndex: number): FrameDebugSnapshot | null {
  return frameSnapshots.get(frameIndex) ?? null;
}

function ensureSnapshot(frameIndex: number, timestamp: number, sourceVideoTime?: number): FrameDebugSnapshot {
  let snap = frameSnapshots.get(frameIndex);
  if (!snap) {
    snap = emptyFrameSnapshot(frameIndex, timestamp, sourceVideoTime ?? timestamp);
    frameSnapshots.set(frameIndex, snap);
  }
  return snap;
}

function pushRca(entry: DebugRcaEvent): void {
  state.rcaLog = [entry, ...state.rcaLog].slice(0, 200);
  const snap = ensureSnapshot(entry.frameIndex, entry.timestamp);
  snap.rca.push(entry);
}

function maybeCoverageRca(ev: DebugCoverageEvent): void {
  if (ev.coverage >= COVERAGE_RCA_THRESHOLD) return;
  pushRca({
    type: 'rca',
    frameIndex: ev.frameIndex,
    timestamp: ev.timestamp,
    problem: 'Coverage Below Threshold',
    reason: `Coverage ${Math.round(ev.coverage * 100)}%`,
    evidence: [`Peak track ${ev.peakTrack}`, `Detected ${ev.detectedCount}`],
    suggestedCause: 'Track loss or detection miss',
    severity: ev.coverage < 0.75 ? 'critical' : 'warning',
    coverage: ev.coverage,
    emittedAtMs: performance.now(),
  });
}

function emit(event: DebugBusEvent): void {
  if (!enabled) return;

  const snap = ensureSnapshot(
    event.frameIndex,
    'timestamp' in event ? event.timestamp : 0,
    event.type === 'frame' ? event.sourceVideoTime : undefined,
  );

  switch (event.type) {
    case 'frame':
      snap.frame = event;
      snap.timestamp = event.timestamp;
      snap.sourceVideoTime = event.sourceVideoTime;
      state.currentFrameIndex = event.frameIndex;
      state.currentTimestamp = event.timestamp;
      state.frameSnapshot = snap;
      if (isLive) state.currentFrameIndex = event.frameIndex;
      break;
    case 'mediapipe':
      snap.mediapipe = event;
      state.detectedCount = event.detectedPersons;
      state.mediaPipeFps = event.processingMs > 0 ? 1000 / event.processingMs : state.mediaPipeFps;
      break;
    case 'tracking':
      snap.tracking = event;
      state.trackedCount = event.trackedPersons;
      state.peakTrack = Math.max(state.peakTrack, event.trackIds.length);
      peakTrackObserved = Math.max(peakTrackObserved, event.visibleCount);
      state.trackingFps = event.trackingMs > 0 ? 1000 / event.trackingMs : state.trackingFps;
      if (isLive) state.currentFrameIndex = event.frameIndex;
      state.frameSnapshot = snap;
      break;
    case 'hungarian':
      snap.hungarian.push(event);
      if (event.rejected || !event.matched) {
        pushRca({
          type: 'rca',
          frameIndex: event.frameIndex,
          timestamp: event.timestamp,
          problem: event.reason?.includes('switch') ? 'Track Switch' : 'Hungarian Reject',
          reason: event.reason || `Cost ${event.cost.toFixed(3)} > ${event.threshold.toFixed(3)}`,
          evidence: [`Track ${event.previousTrackId}`, `Cost ${event.cost.toFixed(3)}`, `Threshold ${event.threshold.toFixed(3)}`],
          suggestedCause: 'Hungarian reassignment',
          severity: 'warning',
          emittedAtMs: performance.now(),
        });
      }
      break;
    case 'kalman':
      snap.kalman.push(event);
      break;
    case 'occlusion':
      snap.occlusions.push(event);
      pushRca({
        type: 'rca',
        frameIndex: event.frameIndex,
        timestamp: event.timestamp,
        problem: `Track #${event.trackId} Lost`,
        reason: event.reason,
        evidence: [`Visibility ${event.visibility.toFixed(2)}`, event.bboxOverlap > 0 ? `BBox overlap ${Math.round(event.bboxOverlap * 100)}%` : ''].filter(Boolean),
        suggestedCause: 'Occlusion',
        severity: 'warning',
        emittedAtMs: performance.now(),
      });
      break;
    case 'coverage':
      snap.coverage = event;
      state.coverage = event.coverage;
      state.peakTrack = Math.max(state.peakTrack, event.peakTrack);
      state.coverageRing = [...state.coverageRing, event].slice(-PERFORMANCE_RING_SIZE);
      maybeCoverageRca(event);
      break;
    case 'worker':
      snap.worker = event;
      state.workerQueue = event.workerQueue;
      state.droppedFrames = event.droppedFrames;
      if (event.overflow) {
        pushRca({
          type: 'rca',
          frameIndex: event.frameIndex,
          timestamp: event.timestamp,
          problem: 'Worker Queue Overflow',
          reason: `Queue ${event.workerQueue}`,
          evidence: [`Dropped ${event.droppedFrames}`],
          suggestedCause: 'Processing overload',
          severity: 'critical',
          emittedAtMs: performance.now(),
        });
      }
      break;
    case 'performance':
      snap.performance = event;
      state.totalProcessingMs = event.totalMs;
      state.rvfcFps = event.rvfcFps;
      state.queueLength = event.queueLength;
      state.performanceRing = [...state.performanceRing, event].slice(-PERFORMANCE_RING_SIZE);
      state.mediaPipeFps = event.mediaPipeMs > 0 ? 1000 / event.mediaPipeMs : state.mediaPipeFps;
      state.frameSnapshot = snap;
      if (isLive) state.currentFrameIndex = event.frameIndex;
      break;
    case 'rca':
      snap.rca.push(event);
      pushRca(event);
      break;
    default:
      break;
  }

  listeners.forEach((fn) => {
    try {
      fn(event, state);
    } catch (err) {
      console.warn('[DebugEventBus] listener error', err);
    }
  });
}

export function subscribeDebugEventBus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishDebugEvent(event: DebugBusEvent): void {
  emit(event);
}

/** Pipeline에서 사용 — 타입별 publish 헬퍼 */
export const debugBus = {
  frame: (p: Omit<DebugFrameEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'frame', emittedAtMs: performance.now() }),
  mediapipe: (p: Omit<DebugMediaPipeEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'mediapipe', emittedAtMs: performance.now() }),
  tracking: (p: Omit<DebugTrackingEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'tracking', emittedAtMs: performance.now() }),
  hungarian: (p: Omit<DebugHungarianEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'hungarian', emittedAtMs: performance.now() }),
  kalman: (p: Omit<DebugKalmanEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'kalman', emittedAtMs: performance.now() }),
  occlusion: (p: Omit<DebugOcclusionEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'occlusion', emittedAtMs: performance.now() }),
  coverage: (p: Omit<DebugCoverageEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'coverage', emittedAtMs: performance.now() }),
  worker: (p: Omit<DebugWorkerEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'worker', emittedAtMs: performance.now() }),
  performance: (p: Omit<DebugPerformanceEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'performance', emittedAtMs: performance.now() }),
  rca: (p: Omit<DebugRcaEvent, 'type' | 'emittedAtMs'>) =>
    emit({ ...p, type: 'rca', emittedAtMs: performance.now() }),
  confidence: (frameIndex: number, trackId: number, confidence: number) => {
    if (!enabled) return;
    const series = state.confidenceByTrack.get(trackId) || [];
    const prev = series[series.length - 1];
    const isDrop = prev != null && prev.confidence - confidence > 0.25;
    series.push({ frameIndex, confidence, isDrop });
    if (series.length > PERFORMANCE_RING_SIZE * 2) series.splice(0, series.length - PERFORMANCE_RING_SIZE * 2);
    state.confidenceByTrack.set(trackId, series);
  },
  rvfcStall: (frameIndex: number, timestamp: number, detail: string) => {
    emit({
      type: 'rca',
      frameIndex,
      timestamp,
      problem: 'RVFC Stall',
      reason: detail,
      evidence: [detail],
      suggestedCause: 'RVFC callback idle',
      severity: 'critical',
      emittedAtMs: performance.now(),
    });
  },
  getPeakTrack: () => peakTrackObserved,
  isOverPerformanceThreshold: (ms: number) => ms > PERFORMANCE_THRESHOLD_MS,
};

export default debugBus;
