// @ts-nocheck
/**
 * K-POP Motion Extraction Engine — Holistic(Pose+Hand+Face) · RVFC · Tracking · Pipeline · Cache
 * useSkeletonExtract / useGroupChoreoExtract 공용 코어
 */
import { getGroupData } from '../../data/groupPracticeData';
import { MultiPersonTracker } from '../MultiPersonTracker';
import type { AnalysisResult } from '../videoAnalysisTypes';
import { suggestTrackToMemberMap } from '../formationMatching';
import { buildDanceDatabase, saveDanceDatabase } from '../dance/DanceDatabaseService';
import {
  buildChoreoCacheKey,
  buildFileCacheKey,
  getCachedChoreo,
  isChoreoCacheValid,
  CHOREO_CACHE_PIPELINE_VERSION,
} from '../groupChoreoCache';
import {
  buildReferenceVideoCacheKey,
  getReferenceVideoObjectUrl,
  saveReferenceVideo,
} from '../referenceVideoStore';
import {
  CHOREO_DEFAULT_SAMPLE_FPS,
  CHOREO_MEMBER_PROBE_SAMPLES,
  normalizeChoreoPoseModel,
  normalizeChoreoSampleFps,
  resolveMinAiReferenceTracks,
} from '../../config/choreoExtractConfig';
import {
  resolveAnalysisSampleFps,
  resolveVideoDuration,
  waitForAnalysisVideoReady,
} from '../../utils/choreoVideoUtils';
import { sampleVideoFrames } from '../../utils/sampleVideoFrames';
import { createMotionExtractionPipeline } from '../../utils/motionExtractionStages';
import { debugBus, isDebugEventBusEnabled } from '../../studio/skeletonDebug/live/debugEventBus';
import { createMotionDetector } from './WorkerMotionDetector';
import { isForceMainThreadMediaPipe } from '../../config/pipelineConfig';
import { createManagedWorker } from '../../utils/workerRecovery';
import { recordCoverageFailure, recordQueueOverflow, recordMemoryReport, recordWorkerError } from '../../utils/pipelineTelemetry';
import { pipelineDiagnostics } from '../../utils/pipelineDiagnostics';
import { handleWorkerMessageForHealth, registerWorkerHealth } from '../../utils/workerHealthMonitor';
import {
  logWorkerErrorDetail,
  logWorkerLifecycle,
  recordPropagationHop,
} from '../../utils/workerErrorDiagnostics';
import { getGpuResourceSnapshot } from '../../utils/gpuResourceMonitor';
import {
  createHeapTrendTracker,
  createWorkerMemoryAggregator,
  estimateBytesPerSkeletonFrame,
  estimateCanvasPoolMemoryBytes,
  estimateFrameBufferMemoryBytes,
  estimateDanceDatabaseMemoryBytes,
  bytesToMb,
} from '../../utils/memoryProfiler';
import { pipelineEventBus, pipelineRegistry } from '../../utils/pipelineEventBus';
import {
  createMotionExtractionRcaSession,
  clearMotionExtractionRcaSession,
} from '../../utils/motionExtractionRca';
import { associateHolisticLandmarksToPeople } from '../../utils/holisticLandmarkUtils';
import { timeSecToBeat, timeSecToBeatIndex } from '../../utils/frameMetadataUtils';
import { computeMemberHipCenter } from '../rendering/SkeletonFormationRender';
import { guardGroupModeNoExtraction } from '../group/groupModeRuntimeGuard';
import {
  buildSkeletonData,
  calculateTimelineCoverage,
  SKELETON_MIN_TIMELINE_COVERAGE,
} from '../../utils/skeletonDataUtils';
import type {
  MotionExtractionDebugState,
  MotionExtractionResult,
  ReferenceVideoMeta,
} from '../../types/motionExtraction';
import type { DanceDatabase } from '../../types/danceDatabase';

const AI_INIT_TIMEOUT_MS = 60000;
const DEFAULT_FRAME_BUFFER_READY_FRAMES = 30;
/** Worker Queue Overflow 방지 — sent-acked 차이가 이 값을 넘으면 Frame Drop */
const MAX_WORKER_QUEUE = 45;
/** Track ID 안정화 — 이 거리(정규화 좌표) 이내면 "같은 사람"으로 간주해 이전 trackId 유지 */
const TRACK_STABILIZE_POSITION_THRESHOLD = 0.09;
/** RVFC가 이 시간 이상 멈추면 Coverage 확보 불가로 판단해 즉시 종료 */
const STALL_TIMEOUT_MS = 12000;
/** sampleVideoFramesPlayback() Processing Queue 최대 길이 — 초과 시 Frame Drop */
const SAMPLER_MAX_QUEUE_LENGTH = 40;
/** Queue 소비(단일 프레임 detect+track+worker dispatch)가 이 시간 이상 걸리면 경고 로그 */
const PROCESSING_STALL_TIMEOUT_MS = 4000;
const COVERAGE_CHECKPOINTS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const COVERAGE_PROJECTION_MIN_PROGRESS = 0.3;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function detectHolistic(detector, source, timestampMs = 0, imagePerFrame = false) {
  if (imagePerFrame && typeof detector.detect === 'function') {
    return detector.detect(source);
  }
  if (typeof detector.detectForVideo === 'function') {
    return detector.detectForVideo(source, timestampMs);
  }
  return detector.detect(source);
}

export function createOffscreenDetectPipeline(videoWidth, videoHeight) {
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = videoWidth;
  offscreenCanvas.height = videoHeight;
  const offscreenCtx = offscreenCanvas.getContext('2d');

  const detectFrame = (detector, video, timestampMs = 0) => {
    const vw = video.videoWidth || videoWidth;
    const vh = video.videoHeight || videoHeight;
    if (offscreenCtx && vw && vh) {
      if (offscreenCanvas.width !== vw) offscreenCanvas.width = vw;
      if (offscreenCanvas.height !== vh) offscreenCanvas.height = vh;
      offscreenCtx.drawImage(video, 0, 0, vw, vh);
      return detectHolistic(detector, offscreenCanvas, timestampMs);
    }
    return detectHolistic(detector, video, timestampMs);
  };

  return { offscreenCanvas, detectFrame };
}

export async function ensureVideoDimensions(video) {
  const duration = await resolveVideoDuration(video);
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('영상 크기를 인식할 수 없습니다. 다른 영상 파일을 사용해 주세요.');
  }
  const { nativeFps } = await resolveAnalysisSampleFps(video);
  return {
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    sourceVideoDurationSec: duration,
    sourceVideoNativeFps: nativeFps,
    sampleFps: CHOREO_DEFAULT_SAMPLE_FPS,
  };
}

export async function createHolisticMotionDetector(groupMemberCount, onStatus, {
  lenient = false,
  modelVariant = 'lite',
  runningMode = 'VIDEO',
} = {}) {
  return withTimeout(
    createMotionDetector(groupMemberCount, onStatus, {
      lenient,
      modelVariant: normalizeChoreoPoseModel(modelVariant),
      runningMode,
      forceMainThread: isForceMainThreadMediaPipe(),
    }),
    AI_INIT_TIMEOUT_MS,
    'Holistic AI 모델 로드 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  );
}

function createMotionPostProcessWorker() {
  if (typeof Worker === 'undefined') return null;
  try {
    const workerUrl = new URL('../../workers/motionPostProcessWorker.ts', import.meta.url);
    const managed = createManagedWorker({
      name: 'motion-post-process',
      workerUrl,
      subsystem: 'motion-extraction',
      maxRestarts: 3,
      onWorkerCreated: async (worker) => {
        worker.postMessage({ type: 'RESET' });
      },
      onWorkerTerminated: (reason) => {
        logWorkerLifecycle('motion-post-process', 'terminate', { reason });
      },
      onFatal: (err) => {
        logWorkerLifecycle('motion-post-process', 'onFatal', { message: err.message });
        recordPropagationHop('MotionExtractionEngine.postProcessWorker.onFatal', err.message, { propagatedToSampler: false });
      },
    });

    managed.addEventListener('error', (ev) => {
      recordPropagationHop(
        'MotionExtractionEngine.postProcessWorker.addEventListener(error)',
        (ev as ErrorEvent)?.message || 'worker error event',
        { propagatedToSampler: false },
      );
    });

    return {
      postMessage: (message: unknown, transfer?: unknown[]) => managed.postMessage(message, transfer),
      addEventListener: (type: 'message' | 'error', listener: (event: MessageEvent) => void) => managed.addEventListener(type, listener as any),
      terminate: () => managed.terminate(),
      _managed: managed,
    };
  } catch (err) {
    logWorkerErrorDetail('motion-post-process', 'create-failed', err);
    console.warn('[MotionExtract] Worker 초기화 실패 — 메인 스레드 분석만 진행', err);
    return null;
  }
}

function createPerfStats() {
  return {
    videoDecodeMs: 0,
    poseDetectionMs: 0,
    postProcessMs: 0,
    jsonSerializeMs: 0,
    totalMs: 0,
    sampledFrames: 0,
    workerFrames: 0,
  };
}

function addMs(stats, key, ms) {
  const n = Number(ms);
  if (Number.isFinite(n) && n >= 0) stats[key] += n;
}

function logPerfStats(stats, label, extra = {}) {
  const frames = Math.max(1, stats.sampledFrames || stats.workerFrames || 1);
  console.table({
    [label]: {
      'Video Decode': `${stats.videoDecodeMs.toFixed(1)}ms`,
      'Pose Detection': `${stats.poseDetectionMs.toFixed(1)}ms`,
      PostProcess: `${stats.postProcessMs.toFixed(1)}ms`,
      'JSON Serialize': `${stats.jsonSerializeMs.toFixed(1)}ms`,
      'Total Time': `${stats.totalMs.toFixed(1)}ms`,
      Frames: stats.sampledFrames,
      'Avg/Frame': `${(stats.totalMs / frames).toFixed(2)}ms`,
      ...extra,
    },
  });
}

function logCoverageTable(label, payload) {
  console.table({
    [label]: {
      videoDuration: payload.videoDuration,
      analysisDuration: payload.analysisDuration,
      frameCount: payload.frameCount,
      firstTimestamp: payload.firstTimestamp,
      lastTimestamp: payload.lastTimestamp,
      coverage: payload.coverage,
      cacheUsed: payload.cacheUsed,
      cacheValid: payload.cacheValid,
    },
  });
}

/**
 * Track Stability — associateHolisticLandmarksToPeople() 이후, 이전 프레임과
 * 위치가 거의 같은데 trackId만 급격히 바뀐 경우 이전 trackId를 유지한다.
 * (Hungarian/재등장 매칭이 흔들려도 최종 출력 trackId는 안정적으로 유지)
 */
function stabilizeTrackIds(people, prevPeopleById, positionThreshold = TRACK_STABILIZE_POSITION_THRESHOLD) {
  if (!people?.length) return { people, changes: 0 };
  if (!prevPeopleById?.size) return { people, changes: 0 };

  const usedPrevIds = new Set();
  let changes = 0;

  const stabilized = people.map((person) => {
    const center = computeMemberHipCenter(person.joints);
    if (!center) return person;

    let bestId = null;
    let bestDist = Infinity;
    prevPeopleById.forEach((prevPerson, prevId) => {
      if (usedPrevIds.has(prevId)) return;
      const prevCenter = computeMemberHipCenter(prevPerson.joints);
      if (!prevCenter) return;
      const dist = Math.hypot(center.x - prevCenter.x, center.y - prevCenter.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = prevId;
      }
    });

    if (bestId == null || bestDist > positionThreshold) return person;
    usedPrevIds.add(bestId);
    if (bestId === person.trackId) return person;

    changes += 1;
    return { ...person, trackId: bestId };
  });

  return { people: stabilized, changes };
}

/** fillMissingMembers — 유령 스켈레톤 겹침 방지 */
const FILL_OVERLAP_MIN_DIST = 0.07;
const FILL_MAX_STALE_SEC = 3;

/**
 * Group Skeleton 개수 유지 — expectedMemberCount보다 적게 검출된 경우
 * lastDetectedPeople(trackId별 최신 관측)에서 누락 멤버를 보간해 채운다.
 */
function fillMissingMembersFromLastDetected(people, lastDetectedById, expectedMemberCount, timestamp) {
  const present = new Set((people || []).map((p) => p.trackId));
  const merged = [...(people || [])];
  const missingTrackIds = [];
  const visibleCount = merged.filter((p) => !p.isEstimated).length;
  const maxFill = expectedMemberCount > 0
    ? Math.max(0, expectedMemberCount - visibleCount)
    : Infinity;
  let filled = 0;

  if (lastDetectedById?.size) {
    lastDetectedById.forEach((lastPerson, trackId) => {
      if (present.has(trackId)) return;
      if (expectedMemberCount > 0 && merged.length >= expectedMemberCount) return;
      if (filled >= maxFill) return;

      const lastSeen = lastPerson.lastSeenTimestamp ?? timestamp;
      if (timestamp - lastSeen > FILL_MAX_STALE_SEC) return;

      const hip = computeMemberHipCenter(lastPerson.joints);
      if (hip) {
        const overlapsVisible = merged.some((p) => {
          if (p.isEstimated) return false;
          const other = computeMemberHipCenter(p.joints);
          return other && Math.hypot(hip.x - other.x, hip.y - other.y) < FILL_OVERLAP_MIN_DIST;
        });
        if (overlapsVisible) return;
      }

      merged.push({
        ...lastPerson,
        isEstimated: true,
        lastSeenTimestamp: timestamp,
      });
      missingTrackIds.push(trackId);
      filled += 1;
    });
  }

  return { people: merged, missingTrackIds };
}

/** 포메이션 기본 위치에 중립 T-포즈 — 미검출 멤버 슬롯 보간용 */
function createNeutralPoseAt(cx: number, cy: number) {
  return {
    nose: { x: cx, y: cy - 0.12, z: 0, visibility: 0.4, confidence: 0.3 },
    left_shoulder: { x: cx - 0.06, y: cy - 0.04, z: 0, visibility: 0.4, confidence: 0.3 },
    right_shoulder: { x: cx + 0.06, y: cy - 0.04, z: 0, visibility: 0.4, confidence: 0.3 },
    left_elbow: { x: cx - 0.1, y: cy + 0.02, z: 0, visibility: 0.35, confidence: 0.25 },
    right_elbow: { x: cx + 0.1, y: cy + 0.02, z: 0, visibility: 0.35, confidence: 0.25 },
    left_wrist: { x: cx - 0.12, y: cy + 0.08, z: 0, visibility: 0.3, confidence: 0.2 },
    right_wrist: { x: cx + 0.12, y: cy + 0.08, z: 0, visibility: 0.3, confidence: 0.2 },
    left_hip: { x: cx - 0.04, y: cy + 0.1, z: 0, visibility: 0.4, confidence: 0.3 },
    right_hip: { x: cx + 0.04, y: cy + 0.1, z: 0, visibility: 0.4, confidence: 0.3 },
    left_knee: { x: cx - 0.04, y: cy + 0.2, z: 0, visibility: 0.35, confidence: 0.25 },
    right_knee: { x: cx + 0.04, y: cy + 0.2, z: 0, visibility: 0.35, confidence: 0.25 },
    left_ankle: { x: cx - 0.05, y: cy + 0.28, z: 0, visibility: 0.3, confidence: 0.2 },
    right_ankle: { x: cx + 0.05, y: cy + 0.28, z: 0, visibility: 0.3, confidence: 0.2 },
  };
}

/** 기존 트랙 위치와 가장 멀리 떨어진 포메이션 멤버 — 미검출 1명 추정 슬롯 */
function findLeastMatchedFormationMember(group, trackIdToInitialPosition) {
  const positions = [...trackIdToInitialPosition.values()];
  if (!group?.members?.length) return null;
  if (!positions.length) return group.members[0];

  let worst = group.members[0];
  let worstDist = -1;
  group.members.forEach((member) => {
    const minDist = Math.min(...positions.map((p) => {
      const dx = (p.x || 0) - (member.defaultX || 0.5);
      const dy = (p.y || 0) - (member.defaultY || 0.5);
      return dx * dx + dy * dy;
    }));
    if (minDist > worstDist) {
      worstDist = minDist;
      worst = member;
    }
  });
  return worst;
}

/**
 * 영상 전체에서 한 번도 검출되지 않은 멤버 슬롯을 포메이션 기본 위치로 보간.
 * coverage는 충족했으나 peakTrack이 1명 부족한 경우 추출 완료를 허용한다.
 */
function padNeverDetectedMemberSlots(frames, trackIdToInitialPosition, targetTrackCount, group) {
  const shortfall = targetTrackCount - trackIdToInitialPosition.size;
  if (shortfall <= 0 || !frames.length || !group) return { padded: 0, trackIdToInitialPosition };

  let padded = 0;
  const usedTrackIds = new Set([...trackIdToInitialPosition.keys()]);

  for (let slot = 0; slot < shortfall; slot += 1) {
    let newTrackId = 1;
    while (usedTrackIds.has(newTrackId)) newTrackId += 1;

    const member = findLeastMatchedFormationMember(group, trackIdToInitialPosition);
    if (!member) break;

    const cx = member.defaultX ?? 0.5;
    const cy = member.defaultY ?? 0.5;
    const placeholderJoints = createNeutralPoseAt(cx, cy);

    trackIdToInitialPosition.set(newTrackId, { x: cx, y: cy });
    usedTrackIds.add(newTrackId);
    padded += 1;

    frames.forEach((frame) => {
      const people = frame.detectedPeople || [];
      if (people.length >= targetTrackCount) return;
      if (people.some((p) => p.trackId === newTrackId)) return;
      people.push({
        trackId: newTrackId,
        joints: placeholderJoints,
        worldJoints: {},
        confidence: 0.25,
        isEstimated: true,
        lastSeenTimestamp: frame.sourceVideoTime ?? frame.timestamp ?? 0,
      });
      frame.detectedPeople = people;
    });
  }

  return { padded, trackIdToInitialPosition };
}

/** 허용 가능한 멤버 수 부족 — coverage 충족 시 포메이션 보간으로 추출 계속 */
function maxTolerableMemberShortfall(expectedMemberCount: number) {
  if (expectedMemberCount <= 3) return 0;
  return Math.max(1, Math.floor(expectedMemberCount * 0.2));
}

export interface RunHolisticAnalysisOptions {
  video: HTMLVideoElement;
  sourceFile?: Blob | File | null;
  /** true면 WebCodecs를 건너뛰고 RVFC(HTMLVideo)만 사용 — Skeleton Studio 등 */
  forceRvfc?: boolean;
  /** RVFC stall 허용 시간(ms) — 긴 영상·느린 MediaPipe 시 기본값보다 크게 */
  stallTimeoutMs?: number;
  /** 프레임마다 IMAGE detect() — VIDEO temporal tracking 혼선 완화 (Studio) */
  imageDetectPerFrame?: boolean;
  /** 탭 비활성 시 pause-resume (Studio) */
  hiddenTabPolicy?: 'fail-fast' | 'pause-resume';
  onTabVisibilityPause?: (paused: boolean, hiddenMs: number) => void;
  /** lenient MediaPipe confidence */
  lenient?: boolean;
  groupId: string;
  detector: { detect: (src: unknown) => unknown; close?: () => void };
  expectedMemberCount: number;
  /** 연습에서 카메라로 대체할 멤버 — 있으면 최소 추적 인원 = 정원 - 1 */
  userMemberId?: string;
  sampleFps?: number;
  modelVariant?: 'lite' | 'full' | 'heavy';
  minBufferedFrames?: number;
  onFrameBufferReady?: (payload: { bufferedCount: number; minBufferedFrames: number }) => void;
  bpm?: number;
  onProgress?: (pct: number, message?: string) => void;
  onFrameDetected?: (payload: Record<string, unknown>) => void;
  onDebug?: (state: Partial<MotionExtractionDebugState>) => void;
  abortRef?: { current: boolean };
  onPipelineStats?: (stats: import('../../utils/asyncPipelineQueue').PipelineStageStats[]) => void;
}

/** RVFC 재생 + Holistic detect + Hungarian/Kalman tracking */
export async function runHolisticVideoAnalysis({
  video,
  sourceFile = null,
  forceRvfc = false,
  stallTimeoutMs: stallTimeoutOverride,
  imageDetectPerFrame = false,
  hiddenTabPolicy,
  onTabVisibilityPause,
  lenient = false,
  groupId,
  detector,
  expectedMemberCount,
  userMemberId,
  sampleFps: sampleFpsOverride,
  modelVariant = 'lite',
  minBufferedFrames = DEFAULT_FRAME_BUFFER_READY_FRAMES,
  onFrameBufferReady,
  bpm = 120,
  onProgress,
  onFrameDetected,
  onDebug,
  abortRef,
  onPipelineStats,
}: RunHolisticAnalysisOptions): Promise<AnalysisResult | null> {
  const group = getGroupData(groupId);
  if (!group || !video || !detector) return null;

  const totalStartedAt = performance.now();
  const perfStats = createPerfStats();
  const { videoWidth, videoHeight, sourceVideoDurationSec, sourceVideoNativeFps } =
    await ensureVideoDimensions(video);
  const sampleFps = normalizeChoreoSampleFps(sampleFpsOverride ?? CHOREO_DEFAULT_SAMPLE_FPS);
  const minRequiredTracks = resolveMinAiReferenceTracks(expectedMemberCount);
  const aiReferenceCount = minRequiredTracks;

  const tracker = new MultiPersonTracker();
  tracker.setSampleFps(sampleFps);
  tracker.setBpm(bpm);

  const worker = createMotionPostProcessWorker();
  const unregisterWorker = worker
    ? pipelineRegistry.register({ name: 'motionPostProcessWorker', subsystem: 'motion-extraction', kind: 'worker' })
    : () => {};
  const unregisterWorkerHealth = worker
    ? registerWorkerHealth({
      name: 'motion-post-process',
      subsystem: 'motion-extraction',
      postMessage: (m) => worker.postMessage(m),
      managed: true,
    })
    : () => {};
  let workerReady = false;
  let workerSentCount = 0;
  let workerAckCount = 0;
  let workerDroppedCount = 0;
  let maxWorkerQueueObserved = 0;
  const workerSentAtByFrame = new Map<number, number>();
  let avgWorkerDelayMs = 0;
  worker?.postMessage({ type: 'RESET' });
  const workerMemory = createWorkerMemoryAggregator();
  worker?.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (handleWorkerMessageForHealth('motion-post-process', msg)) return;
    if (msg.type === 'FRAME_BUFFERED') {
      const ackDelta = Number.isFinite(msg.ackDelta) && msg.ackDelta > 0
        ? msg.ackDelta
        : (Number.isFinite(msg.bufferedCount) ? Math.max(0, msg.bufferedCount - workerAckCount) : 1) || 1;
      perfStats.workerFrames += ackDelta;
      workerAckCount = Number.isFinite(msg.bufferedCount)
        ? msg.bufferedCount
        : workerAckCount + ackDelta;
      const ackSampleTime = Number.isFinite(msg.frameIndex) ? msg.frameIndex / sampleFps : 0;
      pipelineDiagnostics.markTimeline(ackSampleTime, 'worker-ack', msg.frameIndex);
      addMs(perfStats, 'postProcessMs', msg.postProcessMs);
      if (Number.isFinite(msg.frameIndex)) {
        workerSentAtByFrame.forEach((sentAt, idx) => {
          if (idx <= msg.frameIndex) {
            const delay = performance.now() - sentAt;
            avgWorkerDelayMs = avgWorkerDelayMs > 0 ? avgWorkerDelayMs * 0.85 + delay * 0.15 : delay;
            workerSentAtByFrame.delete(idx);
          }
        });
      }
    } else if (msg.type === 'FRAME_BUFFER_READY') {
      workerReady = true;
      onFrameBufferReady?.({
        bufferedCount: msg.bufferedCount,
        minBufferedFrames: msg.minBufferedFrames,
      });
      onDebug?.({
        pipelineStage: 'frame_buffer_ready',
        progress: Math.max(10, Math.round((msg.bufferedCount / Math.max(1, timelineTotalFrames)) * 100)),
      });
    } else if (msg.type === 'ERROR' || msg.type === 'WORKER_RUNTIME_ERROR'
      || msg.type === 'WORKER_UNHANDLED_REJECTION' || msg.type === 'WORKER_ONERROR') {
      logWorkerErrorDetail('motion-post-process', msg.type, msg, {
        frameIndex: msg.frameIndex,
        phase: msg.phase,
        step: msg.step,
        stepContext: msg.stepContext,
      });
      recordPropagationHop(
        `MotionExtractionEngine.worker.${msg.type}`,
        msg.error || msg.message || msg.reason || 'worker error',
        { propagatedToSampler: false },
      );
    } else if (msg.type === 'memory-report') {
      workerMemory.ingest(msg);
      pipelineEventBus.emit('pipeline-memory-report', {
        subsystem: 'motion-extraction:postProcessWorker',
        usedJSHeapBytes: msg.usedJSHeapBytes,
        reportedAtMs: msg.reportedAtMs,
      });
    }
  });

  console.info('[MotionExtract] GPU 사용 여부', {
    delegate: detector.delegate ?? 'unknown',
    gpu: detector.delegate === 'GPU',
    runningMode: detector.runningMode ?? 'VIDEO',
    modelVariant: detector.modelVariant ?? modelVariant,
    sampleFps,
  });

  onProgress?.(5, forceRvfc ? 'RVFC 연속 재생 추출 시작...' : '프레임 추출 시작...');
  onDebug?.({
    pipelineStage: 'rvfc_playback',
    sampleFps,
    nativeFps: sourceVideoNativeFps,
    expectedMemberCount,
    aiReferenceCount,
    userMemberId: userMemberId ?? null,
  });

  const duration = sourceVideoDurationSec;
  if (!duration || duration <= 0) return null;

  const analysisDuration = duration;
  const timelineTotalFrames = Math.max(1, Math.round(analysisDuration * sampleFps));

  const frames = [];
  /** trackId → 최신 관측(joints 포함) — 누락 멤버 보간용 */
  const lastDetectedPeopleById = new Map();
  /** Track Stability 비교용 — 직전 프레임의 최종 framePeople */
  let prevFramePeopleById = new Map();
  const memberCountSamples: number[] = [];
  let lastSampleAt = 0;
  let measuredFps = sampleFps;

  // Frame Processing Lock은 sampleVideoFramesPlayback()의 Processing Queue Consumer가
  // 이미 단일 실행(순차 처리)을 보장하므로 엔진 레벨에서는 더 필요하지 않다.
  let lastProcessingDelayMs = 0;

  // [요구사항 3] Track Stability 누적 카운터
  let trackIdChangeCount = 0;

  // [요구사항 2] 누락 멤버 보간 통계
  let missingMemberFrameCount = 0;
  let maxMissingInFrame = 0;

  let samplerQueueDroppedCount = 0;
  let nextCoverageCheckpointIdx = 0;
  let maxSamplerQueueObserved = 0;
  let rvfcFpsSum = 0;
  let queueDelaySum = 0;
  let sampleCountForAvg = 0;
  const heapTracker = createHeapTrendTracker();
  heapTracker.start();
  let bytesPerSkeletonFrame = 0;

  const rcaSession = createMotionExtractionRcaSession(expectedMemberCount);

  const dumpMemberCountRca = (observed: number, peak: number, mapped: number) => {
    const avgDetected = memberCountSamples.length
      ? memberCountSamples.reduce((a, b) => a + b, 0) / memberCountSamples.length
      : 0;
    const avgTracked = frames.length
      ? frames.reduce((sum, f) => sum + (f.detectedPeople?.filter((p) => !p.isEstimated).length || 0), 0) / frames.length
      : 0;
    return rcaSession.dumpSummaryAndRca({
      expectedMembers: expectedMemberCount,
      observedMembers: observed,
      peakTrack: peak,
      mappedTracks: mapped,
      totalDroppedFrames: samplerQueueDroppedCount + workerDroppedCount,
      averageDetectedPersons: avgDetected,
      averageTrackedPersons: avgTracked,
    });
  };

  const pipelineCtx = {
    detector,
    tracker,
    worker,
    frames,
    groupId,
    expectedMemberCount,
    sampleFps,
    bpm,
    analysisDuration,
    timelineTotalFrames,
    videoWidth,
    videoHeight,
    sourceVideoNativeFps,
    minBufferedFrames,
    perfStats,
    heapTracker,
    workerMemory,
    onDebug,
    onFrameDetected,
    onProgress,
    abortRef,
    lastDetectedPeopleById,
    prevFramePeopleById,
    memberCountSamples,
    trackIdChangeCount,
    missingMemberFrameCount,
    maxMissingInFrame,
    workerSentCount,
    workerAckCount,
    workerDroppedCount,
    maxWorkerQueueObserved,
    workerSentAtByFrame,
    avgWorkerDelayMs,
    samplerQueueDroppedCount,
    nextCoverageCheckpointIdx,
    bytesPerSkeletonFrame,
    lastProcessingDelayMs,
    measuredFps,
    lastSampleAt,
    rvfcFpsSum,
    queueDelaySum,
    sampleCountForAvg,
    maxSamplerQueueObserved,
    COVERAGE_CHECKPOINTS,
    COVERAGE_PROJECTION_MIN_PROGRESS,
    MAX_WORKER_QUEUE,
    SAMPLER_MAX_QUEUE_LENGTH,
    rcaSession,
    stabilizeTrackIds,
    fillMissingMembersFromLastDetected,
    detectHolistic: (d, src, ts) => detectHolistic(d, src, ts, imageDetectPerFrame),
    imageDetectPerFrame,
  };

  const motionPipeline = createMotionExtractionPipeline(pipelineCtx);
  const unregisterStages = motionPipeline.stages.map((stage) =>
    pipelineRegistry.register({ name: stage.name, subsystem: 'motion-extraction', kind: 'queue' }),
  );

  try {
    await sampleVideoFrames({
    video,
    sourceFile,
    forceRvfc,
    sampleFps,
    maxDuration: analysisDuration,
    abortRef,
    stallTimeoutMs: stallTimeoutOverride ?? STALL_TIMEOUT_MS,
    hiddenTabPolicy: hiddenTabPolicy ?? (forceRvfc ? 'pause-resume' : 'fail-fast'),
    onTabVisibilityPause,
    onStall: (info) => {
      // rvfc_idle — 디코더 정지, Coverage 확보 불가로 확정되어 즉시 종료됨 (치명적).
      // processing_delay — Queue 소비(detect+track+worker)가 느릴 뿐, RVFC는 계속 진행 중 (경고).
      if (info.kind === 'rvfc_idle') {
        if (isDebugEventBusEnabled()) {
          debugBus.rvfcStall(
            frames.length,
            video.currentTime ?? 0,
            `RVFC idle ${Math.round(info.idleMs ?? 0)}ms — ${info.reason ?? 'stall'}`,
          );
        }
        const projected = calculateTimelineCoverage(frames, analysisDuration);
        recordCoverageFailure({
          kind: 'rvfc_idle',
          ...info,
          framesSoFar: frames.length,
          projectedCoverage: projected.coverage,
        });
        console.error(
          '[MotionExtract] Coverage 조기 종료 — RVFC Stall',
          {
            ...info,
            framesSoFar: frames.length,
            projectedLastTimestamp: projected.lastTimestamp,
            projectedCoverage: projected.coverage,
          },
        );
      } else {
        console.warn('[MotionExtract] Processing Delay 경고', { ...info, framesSoFar: frames.length });
      }
    },
    onDecode: (ms) => addMs(perfStats, 'videoDecodeMs', ms),
    onProgress: (pct) => {
      onProgress?.(Math.max(5, pct), `AI 참조 ${aiReferenceCount}명 추적 ${pct}%`);
      onDebug?.({ progress: pct, pipelineStage: 'extracting' });
    },
    maxQueueLength: SAMPLER_MAX_QUEUE_LENGTH,
    processingStallTimeoutMs: PROCESSING_STALL_TIMEOUT_MS,
    onQueueOverflow: ({ queueLength, droppedFrames: samplerDropped }) => {
      samplerQueueDroppedCount = samplerDropped;
      recordQueueOverflow('sampler', { queueLength, droppedCount: samplerDropped });
      rcaSession.recordQueue(samplerDropped, 0, {
        stage: 'videoFrameSampler',
        queueLength,
        droppedFrames: samplerDropped,
        overflowCount: 1,
      });
      onDebug?.({ pipelineStage: 'sampler_queue_overflow', workerQueue: queueLength });
    },
    getExternalDiagnostics: () => {
      const stageStats = motionPipeline.getAllStats();
      const pipelineQueueLength = stageStats.reduce((sum, s) => sum + s.queueLength, 0);
      const workerQueueLength = Math.max(0, workerSentCount - workerAckCount);
      const cov = calculateTimelineCoverage(frames, analysisDuration);
      const lastFrame = frames[frames.length - 1];
      return {
        pipelineQueueLength,
        pipelineStages: Object.fromEntries(stageStats.map((s) => [s.name, {
          queueLength: s.queueLength,
          droppedCount: s.droppedCount,
          processedCount: s.processedCount,
          maxQueue: s.maxQueueLengthObserved,
        }])),
        workerQueueLength,
        workerSentCount,
        workerAckCount,
        workerDroppedCount,
        motionDetectorWorkerBacked: detector?.isWorkerBacked ?? false,
        motionDetectorDelegate: detector?.delegate ?? 'unknown',
        coverage: cov.coverage,
        trackCount: lastFrame?.detectedPeople?.length ?? 0,
        lastMediaPipeDelayMs: perfStats.sampledFrames
          ? perfStats.poseDetectionMs / perfStats.sampledFrames
          : 0,
        lastWorkerDelayMs: avgWorkerDelayMs,
        memoryMb: bytesToMb(heapTracker.getStats().latestBytes),
      };
    },
    onSample: async (sample) => {
      if (abortRef?.current) return;
      await motionPipeline.ingressAndWait({
        time: sample.time,
        mediaTime: sample.mediaTime,
        source: sample.source,
        queueDelayMs: sample.queueDelayMs ?? 0,
        queueLength: sample.queueLength ?? 0,
        rvfcFps: sample.rvfcFps ?? 0,
      });
      onPipelineStats?.(motionPipeline.getAllStats());
    },
    });
    await motionPipeline.drain();
  } finally {
    motionPipeline.close();
    unregisterStages.forEach((fn) => fn());
    perfStats.totalMs = performance.now() - totalStartedAt;
    workerSentAtByFrame.clear();
    heapTracker.stop();
    worker?.terminate();
    unregisterWorker();
    unregisterWorkerHealth();
  }

  if (!frames.length) {
    clearMotionExtractionRcaSession();
    return null;
  }

  const coverageReport = calculateTimelineCoverage(frames, analysisDuration);
  logCoverageTable('Motion Extraction Coverage', {
    videoDuration: sourceVideoDurationSec,
    analysisDuration,
    frameCount: coverageReport.frameCount,
    firstTimestamp: coverageReport.firstTimestamp,
    lastTimestamp: coverageReport.lastTimestamp,
    coverage: coverageReport.coverage,
    cacheUsed: false,
    cacheValid: false,
  });

  if (coverageReport.coverage < SKELETON_MIN_TIMELINE_COVERAGE) {
    recordCoverageFailure({
      analysisDuration,
      lastTimestamp: coverageReport.lastTimestamp,
      coverage: coverageReport.coverage,
      frameCount: coverageReport.frameCount,
    });
    throw new Error(
      `Motion Extraction coverage 부족: analysisDuration=${analysisDuration.toFixed(2)}s, `
      + `lastTimestamp=${coverageReport.lastTimestamp.toFixed(2)}s, `
      + `coverage=${Math.round(coverageReport.coverage * 100)}%`,
    );
  }

  let trackIdToInitialPosition = tracker.buildInitialPositions(frames);

  const detectedMemberCount = (() => {
    const peakFromSamples = memberCountSamples.length ? Math.max(...memberCountSamples) : 0;
    const peakFromTracker = tracker.getPeakTrackCount();
    const mappedCount = trackIdToInitialPosition.size;
    const peak = Math.max(peakFromSamples, peakFromTracker, mappedCount);
    if (expectedMemberCount > 0 && peak >= expectedMemberCount) return expectedMemberCount;
    return peak;
  })();

  if (detectedMemberCount === 0) return null;
  let peakTrackCount = Math.max(tracker.getPeakTrackCount(), trackIdToInitialPosition.size);
  let observedTrackCount = Math.max(detectedMemberCount, peakTrackCount, trackIdToInitialPosition.size);
  let memberCountShortfall = Math.max(0, minRequiredTracks - observedTrackCount);
  let memberCountPadded = false;

  console.table({
    'Motion Member Count': {
      groupMemberCount: expectedMemberCount,
      minRequiredAiTracks: minRequiredTracks,
      userReplacedSlot: userMemberId ?? '(연습 시 카메라)',
      detectedInVideo: observedTrackCount,
      detectedMemberCount,
      peakTrackCount,
      mappedTrackPositions: trackIdToInitialPosition.size,
      memberCountShortfall,
    },
  });

  const tolerableShortfall = maxTolerableMemberShortfall(minRequiredTracks);

  if (observedTrackCount < minRequiredTracks) {
    if (
      coverageReport.coverage >= SKELETON_MIN_TIMELINE_COVERAGE
      && memberCountShortfall <= tolerableShortfall
    ) {
      const padResult = padNeverDetectedMemberSlots(
        frames,
        trackIdToInitialPosition,
        minRequiredTracks,
        group,
      );
      if (padResult.padded > 0) {
        memberCountPadded = true;
        trackIdToInitialPosition = padResult.trackIdToInitialPosition;
        peakTrackCount = Math.max(peakTrackCount, trackIdToInitialPosition.size);
        observedTrackCount = Math.max(observedTrackCount, trackIdToInitialPosition.size);
        memberCountShortfall = Math.max(0, minRequiredTracks - observedTrackCount);
        console.warn(
          '[MotionExtract] AI 참조 1명 미검출 — coverage 충족, 포메이션 보간 슬롯으로 추출 계속',
          {
            groupMemberCount: expectedMemberCount,
            minRequiredAiTracks: minRequiredTracks,
            observedBeforePad: detectedMemberCount,
            peakTrackCount,
            paddedSlots: padResult.padded,
            observedAfterPad: observedTrackCount,
          },
        );
      }
    }

    if (observedTrackCount < minRequiredTracks) {
      dumpMemberCountRca(
        observedTrackCount,
        peakTrackCount,
        trackIdToInitialPosition.size,
      );
      clearMotionExtractionRcaSession();
      throw new Error(
        `Motion Extraction AI 참조 인원 부족: 그룹 ${expectedMemberCount}명 중 연습 담당 1명을 제외하고 `
        + `영상에서 최소 ${minRequiredTracks}명이 필요합니다 `
        + `(영상에서 감지=${observedTrackCount}, peakTrack=${peakTrackCount}). `
        + '다른 멤버가 선명히 보이는 안무 영상을 사용해 주세요.',
      );
    }
  } else if (observedTrackCount < expectedMemberCount) {
    console.info(
      '[MotionExtract] 선택 멤버 자리는 영상에 없거나 미검출 — 연습 시 카메라로 대체됩니다.',
      {
        groupMemberCount: expectedMemberCount,
        detectedInVideo: observedTrackCount,
        aiReferenceNeeded: minRequiredTracks,
        userMemberId: userMemberId ?? null,
      },
    );
  }

  onDebug?.({ pipelineStage: 'analysis_complete', progress: 92 });
  dumpMemberCountRca(
    observedTrackCount,
    peakTrackCount,
    trackIdToInitialPosition.size,
  );
  logPerfStats(perfStats, 'Motion Extraction', {
    'Worker Frames': perfStats.workerFrames,
    'FrameBuffer Ready': workerReady ? 'yes' : 'no',
    GPU: detector.delegate === 'GPU' ? 'yes' : 'no',
    Model: detector.modelVariant ?? modelVariant,
    FPS: sampleFps,
  });

  // [요구사항 8] Motion Extraction 종료 리포트 — Worker Queue / Track Stability /
  // Coverage / Dropped Members / Dropped Frames.
  console.table({
    'Worker Queue': {
      sent: workerSentCount,
      acked: workerAckCount,
      pendingAtEnd: Math.max(0, workerSentCount - workerAckCount),
      dropped: workerDroppedCount,
      maxQueueObserved: maxWorkerQueueObserved,
    },
    'Track Stability': {
      trackIdChanges: trackIdChangeCount,
      trackerResetCount: tracker.getReleasedTrackCount(),
      peakTrackCount,
    },
    Coverage: {
      coverage: coverageReport.coverage,
      lastTimestamp: coverageReport.lastTimestamp,
      frameCount: coverageReport.frameCount,
    },
    'Dropped Members': {
      framesWithMissingMembers: missingMemberFrameCount,
      maxMissingInSingleFrame: maxMissingInFrame,
    },
    'Dropped Frames': {
      samplerQueueDrops: samplerQueueDroppedCount,
      workerQueueDrops: workerDroppedCount,
    },
  });

  const finalHeapStats = heapTracker.getStats();
  const gpuSnapshot = getGpuResourceSnapshot();
  console.table({
    'Memory Profile Report': {
      'Frame Buffer': bytesToMb(estimateFrameBufferMemoryBytes(frames.length, bytesPerSkeletonFrame)) != null
        ? `${bytesToMb(estimateFrameBufferMemoryBytes(frames.length, bytesPerSkeletonFrame))!.toFixed(1)}MB` : 'n/a',
      'Peak Heap': bytesToMb(finalHeapStats.peakBytes) != null
        ? `${bytesToMb(finalHeapStats.peakBytes)!.toFixed(1)}MB` : 'n/a (Chrome only)',
      'GC Frequency (heuristic)': finalHeapStats.gcEventCount,
      'ImageBitmap live': gpuSnapshot.imageBitmapLive,
      'VideoFrame live': gpuSnapshot.videoFrameLive,
      'Canvas live': gpuSnapshot.canvasLive,
      'WebGL live': gpuSnapshot.webglContextLive,
    },
  });
  recordMemoryReport('motion-extraction', {
    peakHeapBytes: finalHeapStats.peakBytes,
    gcFrequency: finalHeapStats.gcEventCount,
    gpu: gpuSnapshot,
  });

  pipelineEventBus.emit('motion-extraction-complete', {
    groupId,
    songId: '',
    frameCount: coverageReport.frameCount,
    coverage: coverageReport.coverage,
  });

  clearMotionExtractionRcaSession();

  return {
    detectedMemberCount: observedTrackCount,
    peakTrackCount,
    minRequiredAiTracks: minRequiredTracks,
    groupMemberCount: expectedMemberCount,
    memberCountShortfall: memberCountPadded ? 0 : memberCountShortfall,
    memberCountPadded,
    frames,
    trackIdToInitialPosition,
    videoWidth,
    videoHeight,
    sourceVideoDurationSec,
    sourceVideoNativeFps,
    sampleFps,
  };
}

export async function persistReferenceVideoBlob({
  songId,
  videoId,
  groupId,
  blob,
  durationSec,
}: {
  songId: string;
  videoId: string;
  groupId: string;
  blob: Blob;
  durationSec: number;
}): Promise<ReferenceVideoMeta> {
  const cacheKey = buildReferenceVideoCacheKey(songId, videoId);
  await saveReferenceVideo({
    cacheKey,
    songId,
    videoId,
    groupId,
    mimeType: blob.type || 'video/mp4',
    sizeBytes: blob.size || 0,
    durationSec,
    blob,
  });
  const localPlaybackUrl = await getReferenceVideoObjectUrl(cacheKey);
  return {
    blobCacheKey: cacheKey,
    localPlaybackUrl,
    durationSec,
    mimeType: blob.type,
    sizeBytes: blob.size,
  };
}

export async function loadReferenceVideoMeta(songId: string, videoId: string): Promise<ReferenceVideoMeta | null> {
  const cacheKey = buildReferenceVideoCacheKey(songId, videoId);
  const url = await getReferenceVideoObjectUrl(cacheKey);
  if (!url) return null;
  return { blobCacheKey: cacheKey, localPlaybackUrl: url, durationSec: 0 };
}

export interface AnalyzeFileHolisticOptions {
  file: File;
  groupId: string;
  userMemberId?: string;
  video?: HTMLVideoElement | null;
  sampleFps?: number;
  modelVariant?: 'lite' | 'full' | 'heavy';
  minBufferedFrames?: number;
  /** true면 WebCodecs를 건너뛰고 RVFC만 사용 (Skeleton Debug Studio 권장) */
  forceRvfc?: boolean;
  /** 실패 후에도 video blob URL 유지 (Studio 미리보기) */
  retainVideoObjectUrl?: boolean;
  /** RVFC stall 허용 시간(ms) */
  stallTimeoutMs?: number;
  /** lenient MediaPipe confidence (다인원·등 돌린 포즈) */
  lenient?: boolean;
  /** 프레임마다 IMAGE detect — Studio 다인원 검출 개선 */
  imageDetectPerFrame?: boolean;
  hiddenTabPolicy?: 'fail-fast' | 'pause-resume';
  onTabVisibilityPause?: (paused: boolean, hiddenMs: number) => void;
  onFrameBufferReady?: (payload: { bufferedCount: number; minBufferedFrames: number }) => void;
  onStatus?: (msg: string) => void;
  onProgress?: (pct: number) => void;
  onDebug?: (state: Partial<MotionExtractionDebugState>) => void;
  /** Skeleton Debug Studio 등 — 미전달 시 no-op */
  onFrameDetected?: (payload: Record<string, unknown>) => void;
  abortRef?: { current: boolean };
}

/** Phase 1 — Holistic RVFC 분석만 (멤버 매칭 확인 전) */
export async function analyzeFileHolistic({
  file,
  groupId,
  userMemberId,
  video: videoEl,
  sampleFps,
  modelVariant = 'lite',
  minBufferedFrames,
  onFrameBufferReady,
  onStatus,
  onProgress,
  onDebug,
  onFrameDetected,
  abortRef,
  forceRvfc = false,
  retainVideoObjectUrl = false,
  stallTimeoutMs,
  lenient = false,
  imageDetectPerFrame = false,
  hiddenTabPolicy,
  onTabVisibilityPause,
}: AnalyzeFileHolisticOptions): Promise<AnalysisResult> {
  guardGroupModeNoExtraction('MotionExtractionEngine.analyzeFileHolistic');
  const group = getGroupData(groupId);
  if (!group || !file) throw new Error('그룹 또는 영상 파일이 없습니다.');

  const video = videoEl || document.createElement('video');
  const ownsVideo = !videoEl;
  video.muted = true;
  video.playsInline = true;
  const existingBlobUrl = video.src?.startsWith('blob:') ? video.src : '';
  const objectUrl = existingBlobUrl || URL.createObjectURL(file);
  const ownsObjectUrl = !existingBlobUrl;
  if (!existingBlobUrl) video.src = objectUrl;

  try {
    await waitForAnalysisVideoReady(video);

    onStatus?.('Holistic AI 초기화 (Pose+Hand+Face)...');
    onDebug?.({
      pipelineStage: 'init_models',
      progress: 5,
      expectedMemberCount: group.memberCount,
      aiReferenceCount: resolveMinAiReferenceTracks(group.memberCount),
    });

    const detector = await createHolisticMotionDetector(group.memberCount, onStatus, {
      lenient: lenient || forceRvfc,
      modelVariant,
      runningMode: imageDetectPerFrame || forceRvfc ? 'IMAGE' : 'VIDEO',
    });
    if (abortRef?.current) throw new Error('추출이 취소되었습니다.');

    const analysisResult = await runHolisticVideoAnalysis({
      video,
      sourceFile: file,
      forceRvfc,
      stallTimeoutMs,
      lenient: lenient || forceRvfc,
      imageDetectPerFrame: imageDetectPerFrame || forceRvfc,
      hiddenTabPolicy,
      onTabVisibilityPause,
      groupId,
      detector,
      expectedMemberCount: group.memberCount,
      userMemberId,
      sampleFps,
      modelVariant,
      minBufferedFrames,
      onFrameBufferReady,
      onProgress: (pct, msg) => {
        onProgress?.(pct);
        if (msg) onStatus?.(msg);
      },
      onDebug,
      onFrameDetected,
      abortRef,
    });

    detector.close?.();

    if (!analysisResult?.frames?.length) {
      throw new Error('영상에서 동작을 감지하지 못했습니다. K-POP 안무 영상인지 확인해 주세요.');
    }

    onDebug?.({ pipelineStage: 'analysis_ready', progress: 90 });
    onStatus?.('분석 완료 — 멤버 매칭을 확인해 주세요');
    return analysisResult;
  } finally {
    if (!retainVideoObjectUrl && ownsObjectUrl) {
      URL.revokeObjectURL(objectUrl);
      if (ownsVideo) video.src = '';
    }
  }
}

export interface BuildMotionDatabaseOptions {
  analysisResult: AnalysisResult;
  file: File;
  groupId: string;
  userMemberId: string;
  songId: string;
  trackToMember: Map<number, string> | Record<string | number, string>;
  onStatus?: (msg: string) => void;
  onDebug?: (state: Partial<MotionExtractionDebugState>) => void;
}

/** Phase 2 — 확인된 매칭 → Motion Pipeline → DanceDatabase + Cache + Reference Video */
export async function buildMotionDatabaseFromAnalysis({
  analysisResult,
  file,
  groupId,
  userMemberId,
  songId,
  trackToMember,
  onStatus,
  onDebug,
}: BuildMotionDatabaseOptions): Promise<MotionExtractionResult> {
  const fileCacheKey = buildFileCacheKey(songId, file);
  const videoId = fileCacheKey.split(':').slice(1).join(':');

  onStatus?.('Motion Pipeline v4 처리 중...');
  onDebug?.({ pipelineStage: 'motion_pipeline', progress: 93 });

  const danceDatabase = await buildDanceDatabase({
    groupId,
    songId,
    userMemberId,
    analysisResult,
    trackToMember,
    videoId,
    sampleFps: analysisResult.sampleFps,
  });

  if (!danceDatabase.skeletonFrames?.length) {
    throw new Error('Motion Database 생성 실패 — 멤버 매칭을 확인해 주세요.');
  }

  const mid = danceDatabase.skeletonFrames[Math.floor(danceDatabase.skeletonFrames.length / 2)];
  onDebug?.({
    pipelineStage: 'pipeline_complete',
    progress: 96,
    poseQuality: mid?.poseQuality ?? null,
    beat: mid?.beat ?? null,
    beatIndex: mid?.beatIndex ?? null,
    formation: mid?.formation?.slots?.length ? `${mid.formation.slots.length} slots` : null,
    timelineDuration: danceDatabase.durationSec,
    timelineTotalFrames: danceDatabase.skeletonFrames.length,
    trackingIds: mid?.members?.map((m) => m.trackId ?? m.personIndex) ?? [],
  });

  onStatus?.('Reference Video · Motion Cache 저장...');
  const referenceVideo = await persistReferenceVideoBlob({
    songId,
    videoId,
    groupId,
    blob: file,
    durationSec: analysisResult.sourceVideoDurationSec || danceDatabase.durationSec,
  });

  await saveDanceDatabase(danceDatabase);
  pipelineDiagnostics.markTimeline(danceDatabase.durationSec, 'database-save');
  onDebug?.({ pipelineStage: 'complete', progress: 100 });
  onStatus?.('K-POP Motion Extraction 완료');

  return {
    danceDatabase,
    frames: danceDatabase.skeletonFrames,
    skeletonData: danceDatabase.skeletonData ?? buildSkeletonData(
      danceDatabase.skeletonFrames,
      CHOREO_DEFAULT_SAMPLE_FPS,
      danceDatabase.durationSec,
    ),
    analysisResult,
    fromCache: false,
    referenceVideo,
    songId,
    groupId,
    userMemberId,
  };
}

export interface ExtractMotionDatabaseOptions {
  file: File;
  groupId: string;
  userMemberId: string;
  songId: string;
  video?: HTMLVideoElement | null;
  sampleFps?: number;
  modelVariant?: 'lite' | 'full' | 'heavy';
  minBufferedFrames?: number;
  onFrameBufferReady?: (payload: { bufferedCount: number; minBufferedFrames: number }) => void;
  skipCache?: boolean;
  onStatus?: (msg: string) => void;
  onProgress?: (pct: number) => void;
  onDebug?: (state: Partial<MotionExtractionDebugState>) => void;
  abortRef?: { current: boolean };
  onPipelineStats?: (stats: import('../../utils/asyncPipelineQueue').PipelineStageStats[]) => void;
}

/**
 * 파일 → Holistic 분석 → GroupMotionPipeline v4 → DanceDatabase + Cache + Reference Video
 */
export async function extractMotionDatabase({
  file,
  groupId,
  userMemberId,
  songId,
  video: videoEl,
  sampleFps,
  modelVariant = 'lite',
  minBufferedFrames,
  onFrameBufferReady,
  skipCache = false,
  onStatus,
  onProgress,
  onDebug,
  abortRef,
  onPipelineStats,
}: ExtractMotionDatabaseOptions): Promise<MotionExtractionResult> {
  const group = getGroupData(groupId);
  if (!group || !file) throw new Error('그룹 또는 영상 파일이 없습니다.');

  const fileCacheKey = buildFileCacheKey(songId, file);
  const videoId = fileCacheKey.split(':').slice(1).join(':');

  if (!skipCache) {
    const cached = await getCachedChoreo(fileCacheKey);
    if (cached?.frames?.length && isChoreoCacheValid(cached)) {
      const coverageReport = calculateTimelineCoverage(cached.frames, cached.durationSec);
      logCoverageTable('Motion Cache Coverage', {
        videoDuration: cached.durationSec,
        analysisDuration: cached.durationSec,
        frameCount: coverageReport.frameCount,
        firstTimestamp: coverageReport.firstTimestamp,
        lastTimestamp: coverageReport.lastTimestamp,
        coverage: coverageReport.coverage,
        cacheUsed: true,
        cacheValid: true,
      });
      onStatus?.('캐시된 Motion Database 로드');
      onDebug?.({ pipelineStage: 'cache_hit', progress: 100 });
      const ref = await loadReferenceVideoMeta(songId, videoId);
      const danceDatabase: DanceDatabase = {
        version: '2.0',
        pipelineVersion: cached.pipelineVersion || CHOREO_CACHE_PIPELINE_VERSION,
        groupId,
        songId,
        videoId,
        detectedMemberCount: cached.frames[0]?.members?.length || group.memberCount,
        durationSec: cached.durationSec || 0,
        sourceVideoDurationSec: cached.durationSec || 0,
        sampleFps: cached.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS,
        skeletonData: cached.skeletonData ?? buildSkeletonData(
          cached.frames,
          cached.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS,
          cached.durationSec || 0,
        ),
        bpm: { bpm: cached.bpm ?? 120, estimated: true, source: 'cache' },
        skeletonFrames: cached.frames,
        memberTracks: [],
        formation: {
          groupId,
          songId,
          userMemberId,
          defaultFormation: 'diamond',
          keyframes: [],
        },
        positionMap: cached.positionMap || {
          userMemberId,
          aiMemberIds: [],
          trackToMember: {},
          memberToTrack: {},
        },
        formationHole: cached.formationHole || {
          memberId: userMemberId,
          anchor: { x: 0.5, y: 0.5, z: 0 },
          label: 'YOU',
          color: '#FF1F8E',
        },
        savedAt: cached.savedAt || '',
      };
      return {
        danceDatabase,
        frames: cached.frames,
        skeletonData: danceDatabase.skeletonData!,
        analysisResult: {
          detectedMemberCount: danceDatabase.detectedMemberCount,
          frames: [],
          trackIdToInitialPosition: new Map(),
          sourceVideoDurationSec: cached.durationSec,
          sampleFps: cached.sampleFps,
        },
        fromCache: true,
        referenceVideo: ref || { blobCacheKey: null, localPlaybackUrl: null, durationSec: 0 },
        songId,
        groupId,
        userMemberId,
      };
    }
  }

  const video = videoEl || document.createElement('video');
  const ownsVideo = !videoEl;
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await waitForAnalysisVideoReady(video);

    onStatus?.('Holistic AI 초기화 (Pose+Hand+Face)...');
    onDebug?.({ pipelineStage: 'init_models', progress: 5 });

    const detector = await createHolisticMotionDetector(group.memberCount, onStatus, {
      modelVariant,
      runningMode: 'VIDEO',
    });
    if (abortRef?.current) throw new Error('추출이 취소되었습니다.');

    const analysisResult = await runHolisticVideoAnalysis({
      video,
      sourceFile: file,
      groupId,
      detector,
      expectedMemberCount: group.memberCount,
      userMemberId,
      sampleFps,
      modelVariant,
      minBufferedFrames,
      onFrameBufferReady,
      onProgress: (pct, msg) => {
        onProgress?.(pct);
        if (msg) onStatus?.(msg);
      },
      onDebug,
      abortRef,
      onPipelineStats,
    });

    detector.close?.();

    if (!analysisResult?.frames?.length) {
      throw new Error('영상에서 동작을 감지하지 못했습니다. K-POP 안무 영상인지 확인해 주세요.');
    }

    onStatus?.('멤버 트래킹 매칭 · Motion Pipeline...');
    onDebug?.({ pipelineStage: 'motion_pipeline', progress: 93 });

    const trackToMember = suggestTrackToMemberMap(
      groupId,
      userMemberId,
      analysisResult.trackIdToInitialPosition,
    );

    return buildMotionDatabaseFromAnalysis({
      analysisResult,
      file,
      groupId,
      userMemberId,
      songId,
      trackToMember,
      onStatus,
      onDebug,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
    if (ownsVideo) video.src = '';
  }
}

export default extractMotionDatabase;
