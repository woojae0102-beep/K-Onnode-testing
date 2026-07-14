// @ts-nocheck
/**
 * K-POP Motion Extraction Engine Hook
 *
 * 프로토타입 수준의 단순 스켈레톤 추출 → 서비스 수준 Holistic Motion Pipeline.
 * Pose+Hand+Face · RVFC · Hungarian/Kalman · Interpolation · Normalize · Beat · Cache · DanceDatabase
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SkeletonFrameData } from '../types/groupPractice';
import {
  EMPTY_MOTION_DEBUG,
  type MotionExtractionDebugState,
  type MotionExtractionResult,
} from '../types/motionExtraction';
import { CHOREO_DEFAULT_SAMPLE_FPS } from '../config/choreoExtractConfig';
import type { ChoreoPoseModel, ChoreoSampleFps } from '../config/choreoExtractConfig';
import {
  extractMotionDatabase,
  analyzeFileHolistic,
  buildMotionDatabaseFromAnalysis,
  loadReferenceVideoMeta,
  runHolisticVideoAnalysis,
  createHolisticMotionDetector,
} from '../services/motion/MotionExtractionEngine';
import type { AnalysisResult } from '../services/videoAnalysisTypes';
import {
  buildFileCacheKey,
  getCachedChoreo,
  isChoreoCacheValid,
} from '../services/groupChoreoCache';
import { buildDanceDatabase, saveDanceDatabase } from '../services/dance/DanceDatabaseService';
import { suggestTrackToMemberMap } from '../services/formationMatching';
import { getGroupData } from '../data/groupPracticeData';
import {
  buildGroupMotionDebugFromAudit,
  buildGroupMotionDebugFromFrame,
} from '../utils/groupMotionDebugUtils';
import {
  createStressTestHarness,
  isStressTestMode,
} from '../utils/stressTestHarness';
import {
  createPipelineBenchmark,
  downloadBenchmarkReport,
  getBenchmarkPresetFromQuery,
  isBenchmarkMode,
} from '../utils/pipelineBenchmark';
import {
  EMPTY_GROUP_MOTION_DEBUG,
  type GroupMotionEngineDebugState,
} from '../types/groupMotionEngine';

export type { MotionExtractionResult, MotionExtractionDebugState };

export interface ExtractFromFileOptions {
  groupId: string;
  userMemberId: string;
  songId?: string;
  focusMemberId?: string | null;
  modelVariant?: ChoreoPoseModel;
  sampleFps?: ChoreoSampleFps;
  minBufferedFrames?: number;
  onFrameBufferReady?: (payload: { bufferedCount: number; minBufferedFrames: number }) => void;
  skipCache?: boolean;
  showDebug?: boolean;
}

export interface ExtractFromFileResult extends MotionExtractionResult {
  /** @deprecated frames alias — danceDatabase.skeletonFrames 사용 권장 */
  skeletonFrames: SkeletonFrameData[];
}

function mergeDebug(
  prev: MotionExtractionDebugState,
  patch: Partial<MotionExtractionDebugState>,
): MotionExtractionDebugState {
  return { ...prev, ...patch };
}

/** onDebug()가 프레임(최대 60fps)마다 호출되어도 React 리렌더는 최대 10fps로 제한한다.
 *  — Debug Overlay가 매 프레임 setState → 리렌더되어 Consumer/RVFC와 무관하게 Renderer가
 *  추가 병목이 되는 것을 막는다. 콘솔 로그(console.debug)도 같은 주기로 함께 스로틀된다. */
const DEBUG_FLUSH_INTERVAL_MS = 100;

function useThrottledDebugSetter(setDebug) {
  const pendingRef = useRef<Partial<MotionExtractionDebugState> | null>(null);
  const lastFlushAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    const patch = pendingRef.current;
    pendingRef.current = null;
    lastFlushAtRef.current = performance.now();
    setDebug((prev) => mergeDebug(prev, patch));
    if (import.meta.env?.DEV) console.debug('[MotionExtract]', patch);
  }, [setDebug]);

  const push = useCallback((patch: Partial<MotionExtractionDebugState>) => {
    pendingRef.current = pendingRef.current ? { ...pendingRef.current, ...patch } : patch;
    const elapsed = performance.now() - lastFlushAtRef.current;
    if (elapsed >= DEBUG_FLUSH_INTERVAL_MS) {
      flush();
    } else if (timerRef.current == null) {
      timerRef.current = setTimeout(flush, DEBUG_FLUSH_INTERVAL_MS - elapsed);
    }
  }, [flush]);

  useEffect(() => () => {
    if (timerRef.current != null) clearTimeout(timerRef.current);
  }, []);

  return { push, flush };
}

export function useSkeletonExtract() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [debug, setDebug] = useState<MotionExtractionDebugState>(EMPTY_MOTION_DEBUG);
  const [groupMotionDebug, setGroupMotionDebug] = useState<GroupMotionEngineDebugState>(
    EMPTY_GROUP_MOTION_DEBUG,
  );
  const [showDebug, setShowDebug] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const abortRef = useRef(false);
  const debugFlusher = useThrottledDebugSetter(setDebug);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsExtracting(false);
    setStep('취소됨');
    setDebug((d) => mergeDebug(d, { pipelineStage: 'cancelled' }));
  }, []);

  const loadFromCache = useCallback(async (songId: string, file: File) => {
    const cacheKey = buildFileCacheKey(songId, file);
    const cached = await getCachedChoreo(cacheKey);
    if (!cached?.frames?.length || !isChoreoCacheValid(cached)) return null;
    setFromCache(true);
    setGroupMotionDebug(
      buildGroupMotionDebugFromFrame(cached.frames[cached.frames.length - 1], {
        pipelineStage: 'cache_hit',
        cacheHit: true,
      }),
    );
    return cached.frames as SkeletonFrameData[];
  }, []);

  /**
   * Phase 1 — Holistic RVFC 분석 (멤버 매칭 UI 전)
   */
  const analyzeFile = useCallback(
    async (file: File, options: ExtractFromFileOptions): Promise<AnalysisResult | null> => {
      const { groupId, showDebug: debugVisible = true } = options;
      const group = getGroupData(groupId);
      if (!group || !file) return null;

      abortRef.current = false;
      setIsExtracting(true);
      setProgress(0);
      setError('');
      setShowDebug(debugVisible);
      setDebug(mergeDebug(EMPTY_MOTION_DEBUG, {
        pipelineStage: 'starting',
        expectedMemberCount: group.memberCount,
      }));
      setStep('Holistic Motion Analysis (RVFC)...');

      try {
        const analysisResult = await analyzeFileHolistic({
          file,
          groupId,
          userMemberId: options.userMemberId,
          video: videoRef.current,
          sampleFps: options.sampleFps,
          modelVariant: options.modelVariant,
          minBufferedFrames: options.minBufferedFrames,
          onFrameBufferReady: (payload) => {
            setStep(`FrameBuffer 준비 완료 (${payload.bufferedCount}프레임)`);
            options.onFrameBufferReady?.(payload);
          },
          abortRef,
          onStatus: setStep,
          onProgress: setProgress,
          onDebug: debugFlusher.push,
        });
        debugFlusher.flush();
        setIsExtracting(false);
        return analysisResult;
      } catch (err: unknown) {
        const message = (err as Error)?.message || 'Motion Analysis에 실패했습니다.';
        setError(message);
        setIsExtracting(false);
        return null;
      }
    },
    [],
  );

  /**
   * Phase 2 — 확인된 trackToMember → DanceDatabase + Cache
   */
  const finalizeExtraction = useCallback(
    async (
      file: File,
      analysisResult: AnalysisResult,
      trackToMember: Map<number, string>,
      options: ExtractFromFileOptions,
    ): Promise<ExtractFromFileResult | null> => {
      const {
        groupId,
        userMemberId,
        songId = `${groupId}-motion`,
        focusMemberId = null,
      } = options;
      const memberId = focusMemberId || userMemberId;

      setIsExtracting(true);
      setStep('Motion Database 생성 중...');

      try {
        const result = await buildMotionDatabaseFromAnalysis({
          analysisResult,
          file,
          groupId,
          userMemberId: memberId,
          songId,
          trackToMember,
          onStatus: setStep,
          onDebug: debugFlusher.push,
        });
        debugFlusher.flush();
        const lastFrame = result.frames[result.frames.length - 1] ?? null;
        setGroupMotionDebug(
          buildGroupMotionDebugFromAudit(result.danceDatabase?.motionPipelineAudit, {
            motionTimelines: result.danceDatabase?.motionTimelines,
            lastFrame,
            fromCache: result.fromCache,
          }),
        );
        setProgress(100);
        setIsExtracting(false);
        return { ...result, skeletonFrames: result.frames };
      } catch (err: unknown) {
        const message = (err as Error)?.message || 'Motion Database 저장에 실패했습니다.';
        setError(message);
        setIsExtracting(false);
        return null;
      }
    },
    [],
  );

  /**
   * 영상 파일 → Holistic Motion Extraction → DanceDatabase (원샷)
   */
  const extractFromFile = useCallback(
    async (
      file: File,
      options: ExtractFromFileOptions,
    ): Promise<ExtractFromFileResult | null> => {
      const {
        groupId,
        userMemberId,
        songId = `${groupId}-motion`,
        focusMemberId = null,
        skipCache = false,
        showDebug: debugVisible = true,
        modelVariant = 'lite',
        sampleFps = CHOREO_DEFAULT_SAMPLE_FPS,
        minBufferedFrames,
        onFrameBufferReady,
      } = options;

      const group = getGroupData(groupId);
      if (!group || !file) return null;

      const memberId = focusMemberId || userMemberId;
      abortRef.current = false;
      setIsExtracting(true);
      setProgress(0);
      setError('');
      setFromCache(false);
      setShowDebug(debugVisible);
      setDebug(mergeDebug(EMPTY_MOTION_DEBUG, {
        pipelineStage: 'starting',
        expectedMemberCount: group.memberCount,
      }));
      setStep('K-POP Motion Extraction Engine 시작...');

      try {
        const stressHarness = isStressTestMode() ? createStressTestHarness() : null;
        const benchmarkHarness = isBenchmarkMode() ? createPipelineBenchmark(getBenchmarkPresetFromQuery()) : null;
        stressHarness?.start();
        benchmarkHarness?.start();

        const result = await extractMotionDatabase({
          file,
          groupId,
          userMemberId: memberId,
          songId,
          video: videoRef.current,
          modelVariant,
          sampleFps,
          minBufferedFrames,
          onFrameBufferReady: (payload) => {
            setStep(`FrameBuffer 준비 완료 (${payload.bufferedCount}프레임)`);
            onFrameBufferReady?.(payload);
          },
          skipCache,
          abortRef,
          onStatus: setStep,
          onProgress: setProgress,
          onDebug: debugFlusher.push,
          onPipelineStats: (stats) => {
            const frameCount = stats.reduce((sum, s) => sum + s.processedCount, 0);
            stressHarness?.updateProgress(frameCount, stats);
            benchmarkHarness?.updateProgress(frameCount, stats);
          },
        });
        debugFlusher.flush();
        const benchmarkReport = benchmarkHarness?.stop();
        if (benchmarkReport) downloadBenchmarkReport(benchmarkReport, 'json');
        stressHarness?.stop();

        setFromCache(result.fromCache);
        setGroupMotionDebug(
          buildGroupMotionDebugFromAudit(result.danceDatabase?.motionPipelineAudit, {
            motionTimelines: result.danceDatabase?.motionTimelines,
            lastFrame: result.frames[result.frames.length - 1] ?? null,
            fromCache: result.fromCache,
          }),
        );
        setProgress(100);
        setStep(result.fromCache ? '캐시된 Motion Database 로드 완료' : 'Motion Extraction 완료');
        setIsExtracting(false);

        return {
          ...result,
          skeletonFrames: result.frames,
        };
      } catch (err: unknown) {
        const message = (err as Error)?.message || 'Motion Extraction에 실패했습니다.';
        console.error('[useSkeletonExtract]', err);
        setError(message);
        setIsExtracting(false);
        setDebug((d) => mergeDebug(d, { pipelineStage: 'error' }));
        return null;
      }
    },
    [],
  );

  /**
   * 이미 로드된 video 엘리먼트에서 추출 (YouTube/탭 녹화 등)
   */
  const extractFromVideo = useCallback(
    async (
      video: HTMLVideoElement,
      options: ExtractFromFileOptions & { referenceBlob?: Blob | null },
    ): Promise<ExtractFromFileResult | null> => {
      const {
        groupId,
        userMemberId,
        songId = `${groupId}-motion`,
        focusMemberId = null,
        showDebug: debugVisible = true,
        modelVariant = 'lite',
        sampleFps = CHOREO_DEFAULT_SAMPLE_FPS,
        minBufferedFrames,
        onFrameBufferReady,
      } = options;

      const group = getGroupData(groupId);
      if (!group || !video) return null;

      const memberId = focusMemberId || userMemberId;
      abortRef.current = false;
      setIsExtracting(true);
      setProgress(0);
      setError('');
      setFromCache(false);
      setShowDebug(debugVisible);
      setStep('Holistic Motion Extraction (RVFC)...');

      try {
        const detector = await createHolisticMotionDetector(group.memberCount, setStep, {
          modelVariant,
          runningMode: 'VIDEO',
        });
        const analysisResult = await runHolisticVideoAnalysis({
          video,
          groupId,
          detector,
          expectedMemberCount: group.memberCount,
          sampleFps,
          modelVariant,
          minBufferedFrames,
          onFrameBufferReady: (payload) => {
            setStep(`FrameBuffer 준비 완료 (${payload.bufferedCount}프레임)`);
            onFrameBufferReady?.(payload);
          },
          onProgress: (pct, msg) => {
            setProgress(pct);
            if (msg) setStep(msg);
          },
          onDebug: debugFlusher.push,
          abortRef,
        });
        debugFlusher.flush();
        detector.close?.();

        if (!analysisResult?.frames?.length) {
          throw new Error('영상에서 동작을 감지하지 못했습니다.');
        }

        const trackToMember = suggestTrackToMemberMap(
          groupId,
          memberId,
          analysisResult.trackIdToInitialPosition,
        );

        const danceDatabase = await buildDanceDatabase({
          groupId,
          songId,
          userMemberId: memberId,
          analysisResult,
          trackToMember,
          sampleFps,
        });

        await saveDanceDatabase(danceDatabase);

        let referenceVideo = { blobCacheKey: null, localPlaybackUrl: null, durationSec: 0 };
        if (options.referenceBlob) {
          const { persistReferenceVideoBlob } = await import('../services/motion/MotionExtractionEngine');
          referenceVideo = await persistReferenceVideoBlob({
            songId,
            videoId: songId,
            groupId,
            blob: options.referenceBlob,
            durationSec: analysisResult.sourceVideoDurationSec || danceDatabase.durationSec,
          });
        } else {
          const ref = await loadReferenceVideoMeta(songId, songId);
          if (ref) referenceVideo = ref;
        }

        setProgress(100);
        setIsExtracting(false);

        return {
          danceDatabase,
          frames: danceDatabase.skeletonFrames,
          skeletonFrames: danceDatabase.skeletonFrames,
          skeletonData: danceDatabase.skeletonData ?? {
            fps: sampleFps,
            duration: danceDatabase.durationSec,
            frameCount: danceDatabase.skeletonFrames.length,
          },
          analysisResult,
          fromCache: false,
          referenceVideo,
          songId,
          groupId,
          userMemberId: memberId,
        };
      } catch (err: unknown) {
        const message = (err as Error)?.message || 'Motion Extraction에 실패했습니다.';
        setError(message);
        setIsExtracting(false);
        return null;
      }
    },
    [],
  );

  return {
    isExtracting,
    progress,
    step,
    error,
    fromCache,
    debug,
    groupMotionDebug,
    showDebug,
    setShowDebug,
    videoRef,
    analyzeFile,
    finalizeExtraction,
    extractFromFile,
    extractFromVideo,
    loadFromCache,
    cancel,
  };
}

/** @deprecated frameLookupUtils.findNearestFrame 사용 권장 */
export { findNearestFrame } from '../utils/frameLookupUtils';

export default useSkeletonExtract;
