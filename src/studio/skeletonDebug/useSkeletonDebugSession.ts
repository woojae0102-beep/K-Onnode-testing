// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeFileHolistic } from '../../services/motion/MotionExtractionEngine';
import type { DetectionFrame } from '../../services/MultiPersonTracker';
import { getGroupData } from '../../data/groupPracticeData';
import { CHOREO_DEFAULT_SAMPLE_FPS } from '../../config/choreoExtractConfig';
import { getRvfcScheduleState, resetRvfcScheduleState } from '../../utils/workerErrorDiagnostics';
import { getRvfcDecodePath, setRvfcDecodePath } from '../../utils/rvfcStallDiagnostics';
import { getWorkerHealthStatuses } from '../../utils/workerHealthMonitor';
import { SkeletonDebugRecorder } from './SkeletonDebugRecorder';
import { buildTrackHistory } from './trackHistoryBuilder';
import {
  buildSkeletonDebugExport,
  parseSkeletonDebugJson,
  sessionFromExportDocument,
} from './skeletonDebugExport';
import { analyzeSkeletonExtractionFailure } from './skeletonDebugFailureAnalyzer';
import { buildFullAnalysisPackage, getFrameAnalysis } from './analysis/buildFullAnalysis';
import type { SkeletonAnalysisPackage } from './analysis/analysisTypes';
import type {
  SkeletonDebugLiveDiagnostics,
  SkeletonDebugOverlayOptions,
  SkeletonDebugSession,
} from './types';
import { DEFAULT_OVERLAY_OPTIONS as DEFAULT_OVERLAY } from './types';
import { getAllMediaPipeRawSnapshots } from './live/debugEventBus';
import { useDebugEventBus } from './live/useDebugEventBus';
import { resolveFrameAnalysis } from './live/liveFrameAnalysisBridge';
import {
  createSkeletonTimelineStore,
  type PlaybackMetrics,
  type SkeletonTimelineStore,
} from './render/skeletonTimelineStore';
import type { SkeletonPlaybackMode } from './render/skeletonPlaybackEngine';

/** Skeleton Studio — 정밀 추출 10fps, full pose model */
const STUDIO_STALL_TIMEOUT_MS = 90_000;
const STUDIO_SAMPLE_FPS = 10;
const STUDIO_POSE_MODEL = 'full';
const UI_THROTTLE_MS = 300;

function frameVideoTime(frame: DetectionFrame | null | undefined, index: number, sampleFps: number): number {
  if (!frame) return index / sampleFps;
  return frame.sourceVideoTime ?? frame.timestamp ?? index / sampleFps;
}

export function useSkeletonDebugSession() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** RVFC 추출 전용 — 화면에 보이지 않음 (미리보기 video와 분리) */
  const extractionVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef(new SkeletonDebugRecorder());
  const timelineStoreRef = useRef<SkeletonTimelineStore>(createSkeletonTimelineStore());
  const overlayRef = useRef<SkeletonDebugOverlayOptions>({ ...DEFAULT_OVERLAY });
  const virtualVideoTimeRef = useRef(0);
  const abortRef = useRef(false);
  const replayRafRef = useRef<number | null>(null);
  const lastDebugNotifyRef = useRef(0);

  const [session, setSession] = useState<SkeletonDebugSession | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [analysisFrameCount, setAnalysisFrameCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [overlay, setOverlay] = useState<SkeletonDebugOverlayOptions>({ ...DEFAULT_OVERLAY });
  const [liveDiagnostics, setLiveDiagnostics] = useState<SkeletonDebugLiveDiagnostics>({});
  const [renderMetrics, setRenderMetrics] = useState<PlaybackMetrics | null>(null);
  const [failureAnalysis, setFailureAnalysis] = useState<import('./types').SkeletonFailureAnalysis | null>(null);
  const [analysisPackage, setAnalysisPackage] = useState<SkeletonAnalysisPackage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractionPreviewUrl, setExtractionPreviewUrl] = useState<string | null>(null);
  const [timelineReady, setTimelineReady] = useState(false);
  const [playbackTimeSec, setPlaybackTimeSec] = useState(0);

  const {
    liveState,
    isLive,
    startLiveBus,
    stopLiveBus,
    getSnapshotForFrame,
    flush: flushDebugBus,
  } = useDebugEventBus();

  useEffect(() => () => stopLiveBus(), [stopLiveBus]);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  /** Render metrics — RAF 루프와 분리, UI만 300ms 폴링 */
  useEffect(() => {
    const pull = () => setRenderMetrics(timelineStoreRef.current.getMetrics());
    pull();
    const id = setInterval(pull, UI_THROTTLE_MS);
    return () => clearInterval(id);
  }, []);

  const frames = useMemo(() => session?.analysisResult?.frames ?? [], [session]);

  const frameStats = session?.frameStats ?? [];
  const totalFrames = frames.length;
  const playbackMode: SkeletonPlaybackMode = useMemo(() => {
    if (isExtracting) return 'ANALYZING';
    if (!session?.analysisResult?.frames?.length) return 'ANALYZING';
    if (isPlaying) return 'PLAYBACK';
    return 'ANALYSIS_COMPLETE';
  }, [isExtracting, session, isPlaying]);

  const hasPlaybackTimeline = Boolean(!isExtracting && timelineReady);
  const sampleFps = session?.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS;

  const buildLiveDiagnostics = useCallback(
    (recorder: SkeletonDebugRecorder): SkeletonDebugLiveDiagnostics => {
      const last = recorder.getLastDebug();
      const rvfc = getRvfcScheduleState();
      const workers = getWorkerHealthStatuses();
      const motionWorker = workers.find((w) => w.name.includes('motion'));
      const workerBusy = (last.workerQueue ?? 0) > 0 || Boolean(last.processingFrame);
      return {
        ...last,
        rvfcScheduleCount: rvfc.scheduleCallCount,
        rvfcCallbackCount: rvfc.callbackCallCount,
        decodePath: getRvfcDecodePath(),
        workerBusy,
        workerIdle: !workerBusy,
        workerRestartCount: motionWorker?.restartCount ?? 0,
        averageProcessingTimeMs: recorder.getAverageProcessingTimeMs(),
        trackingFps: last.measuredFps ?? 0,
        mediaPipeFps: last.mediaPipeDelay
          ? 1000 / Math.max(1, last.mediaPipeDelay)
          : last.measuredFps ?? 0,
        videoFps: last.nativeFps ?? session?.analysisResult?.sourceVideoNativeFps ?? 0,
      };
    },
    [session],
  );

  const handleRenderFrameIndex = useCallback((frameIndex: number, videoTime: number) => {
    setCurrentFrameIndex(frameIndex);
    virtualVideoTimeRef.current = videoTime;
    setPlaybackTimeSec(videoTime);
  }, []);

  const runExtraction = useCallback(
    async (file: File, groupId: string, userMemberId: string) => {
      const group = getGroupData(groupId);
      if (!group || !file) return;

      abortRef.current = false;
      setIsExtracting(true);
      setProgress(0);
      setStep('Skeleton Debug Studio — 추출 시작...');
      setError('');
      setFailureAnalysis(null);
      setIsPlaying(false);
      const liveOverlay = {
        ...DEFAULT_OVERLAY,
        showEstimated: true,
        prediction: true,
        kalmanPrediction: true,
      };
      setOverlay(liveOverlay);
      overlayRef.current = liveOverlay;
      setCurrentFrameIndex(0);
      setAnalysisFrameCount(0);
      setTimelineReady(false);
      setPlaybackTimeSec(0);
      virtualVideoTimeRef.current = 0;
      timelineStoreRef.current.reset();

      const recorder = new SkeletonDebugRecorder();
      recorderRef.current = recorder;
      resetRvfcScheduleState();
      setRvfcDecodePath('unknown');
      startLiveBus();

      await new Promise<void>((resolve) => {
        const wait = () => {
          if (extractionVideoRef.current && videoRef.current) resolve();
          else requestAnimationFrame(wait);
        };
        requestAnimationFrame(wait);
      });

      const video = extractionVideoRef.current;
      const previewVideo = videoRef.current;
      if (!video) {
        throw new Error('추출용 비디오 요소가 준비되지 않았습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
      }
      video.muted = true;
      video.playsInline = true;
      if (previewVideo) {
        previewVideo.muted = true;
        previewVideo.playsInline = true;
      }

      const previewUrl = URL.createObjectURL(file);
      setExtractionPreviewUrl(previewUrl);
      video.src = previewUrl;
      if (previewVideo) {
        previewVideo.src = previewUrl;
        previewVideo.currentTime = 0;
        previewVideo.pause();
      }

      let wakeLock: WakeLockSentinel | null = null;
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Wake Lock 미지원/거부 — 추출은 계속
      }

      try {
        const analysisResult = await analyzeFileHolistic({
          file,
          groupId,
          userMemberId,
          video,
          forceRvfc: true,
          retainVideoObjectUrl: true,
          stallTimeoutMs: STUDIO_STALL_TIMEOUT_MS,
          sampleFps: STUDIO_SAMPLE_FPS,
          modelVariant: STUDIO_POSE_MODEL,
          lenient: true,
          imageDetectPerFrame: true,
          hiddenTabPolicy: 'pause-resume',
          onTabVisibilityPause: (paused, hiddenMs) => {
            if (previewVideo && paused) previewVideo.pause();
            setStep(
              paused
                ? `탭 비활성 — 추출 일시정지 (${(hiddenMs / 1000).toFixed(1)}s). 이 탭으로 돌아오면 재개됩니다.`
                : 'Skeleton Debug Studio — 추출 재개...',
            );
          },
          onStatus: setStep,
          onProgress: setProgress,
          onDebug: (patch) => {
            recorder.recordDebug(patch);
            const now = performance.now();
            if (now - lastDebugNotifyRef.current >= UI_THROTTLE_MS) {
              lastDebugNotifyRef.current = now;
              setLiveDiagnostics(buildLiveDiagnostics(recorder));
            }
          },
          onFrameDetected: (payload) => {
            recorder.recordFrameDetected(payload);
            setAnalysisFrameCount(Math.floor(Number(payload.frameIndex) || 0) + 1);
          },
          abortRef,
        });

        const builtStats = recorder.buildFrameStats(analysisResult.frames);
        const trackHistory = buildTrackHistory(analysisResult.frames);
        const coverage = builtStats.length ? builtStats[builtStats.length - 1].coverage : 0;
        const sampleFps = analysisResult.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS;

        timelineStoreRef.current.loadTimeline(analysisResult.frames, sampleFps);
        setAnalysisFrameCount(analysisResult.frames.length);
        setTimelineReady(true);

        setSession({
          mode: 'extraction',
          groupId,
          videoUrl: previewUrl,
          videoFileName: file.name,
          analysisResult,
          exportDocument: null,
          frameStats: builtStats,
          trackHistory,
          sampleFps,
          totalFrames: analysisResult.frames.length,
          durationSec: analysisResult.sourceVideoDurationSec ?? 0,
          failureAnalysis: null,
          analysisPackage: null,
        });
        setExtractionPreviewUrl(null);
        setCurrentFrameIndex(0);
        virtualVideoTimeRef.current = 0;
        if (previewVideo) {
          previewVideo.currentTime = 0;
        }
        setIsExtracting(false);
        setIsPlaying(Boolean(previewUrl && analysisResult.frames.length > 0));
        setStep(`추출 완료 — ${analysisResult.frames.length} frames · 재생 중`);

        setStep('Skeleton Analysis — RCA 계산 중...');
        setIsAnalyzing(true);
        const pkg = buildFullAnalysisPackage({
          analysisResult,
          frameStats: builtStats,
          groupId,
          sampleFps,
          mediaPipeRawByFrame: getAllMediaPipeRawSnapshots(),
        });
        setIsAnalyzing(false);

        const exportDocument = buildSkeletonDebugExport(
          analysisResult,
          builtStats,
          trackHistory,
          groupId,
          coverage,
          pkg,
        );

        setAnalysisPackage(pkg);
        setSession((prev) => (prev ? {
          ...prev,
          exportDocument,
          analysisPackage: pkg,
        } : prev));
        setLiveDiagnostics(buildLiveDiagnostics(recorder));
        setStep(`추출 완료 — ${analysisResult.frames.length} frames · 재생 준비`);
        flushDebugBus();
      } catch (err: unknown) {
        const message = (err as Error)?.message || 'Motion Extraction 실패';
        const lastDebug = recorder.getLastDebug();
        const partialFrames = recorder.buildFrameStats([]);
        const analysis = analyzeSkeletonExtractionFailure({
          error: message,
          lastDebug,
          frameStats: partialFrames,
          expectedMemberCount: group.memberCount,
        });
        setError(message);
        setFailureAnalysis(analysis);
        if (analysis) {
          setStep(`실패: ${analysis.message}`);
        }
      } finally {
        try {
          await wakeLock?.release();
        } catch {
          // ignore
        }
        stopLiveBus();
        if (isExtracting) setIsExtracting(false);
      }
    },
    [buildLiveDiagnostics, startLiveBus, stopLiveBus, flushDebugBus],
  );

  const loadReplayJson = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const doc = parseSkeletonDebugJson(text);
      const { frames: replayFrames, frameStats, trackHistory } = sessionFromExportDocument(doc);
      const analysisResult = {
        frames: replayFrames,
        detectedMemberCount: doc.meta.peakTrackCount,
        peakTrackCount: doc.meta.peakTrackCount,
        groupMemberCount: 0,
        videoWidth: doc.meta.videoWidth,
        videoHeight: doc.meta.videoHeight,
        sourceVideoDurationSec: doc.meta.sourceVideoDurationSec,
        sourceVideoNativeFps: doc.meta.sourceVideoNativeFps,
        sampleFps: doc.meta.sampleFps,
        trackIdToInitialPosition: new Map(),
      };

      timelineStoreRef.current.loadTimeline(replayFrames, doc.meta.sampleFps);
      setAnalysisFrameCount(replayFrames.length);
      setTimelineReady(true);

      setIsAnalyzing(true);
      const pkg = buildFullAnalysisPackage({
        analysisResult,
        frameStats,
        groupId: doc.meta.groupId,
        sampleFps: doc.meta.sampleFps,
      });
      setIsAnalyzing(false);
      setAnalysisPackage(pkg);

      setSession({
        mode: 'replay',
        groupId: doc.meta.groupId,
        videoUrl: null,
        videoFileName: file.name,
        analysisResult,
        exportDocument: doc,
        frameStats,
        trackHistory,
        sampleFps: doc.meta.sampleFps,
        totalFrames: replayFrames.length,
        durationSec: doc.meta.sourceVideoDurationSec,
        failureAnalysis: null,
        analysisPackage: pkg,
      });
      setCurrentFrameIndex(0);
      virtualVideoTimeRef.current = 0;
      setIsPlaying(false);
      setStep(`JSON Replay 로드 — ${replayFrames.length} frames`);
      setError('');
    } catch (err: unknown) {
      setError((err as Error)?.message || 'JSON 로드 실패');
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
    stopLiveBus();
    setIsExtracting(false);
    setStep('취소됨');
    videoRef.current?.pause();
  }, [stopLiveBus]);

  const previewVideoSrc = session?.videoUrl ?? extractionPreviewUrl;

  const seekToFrame = useCallback(
    (frameIndex: number) => {
      const maxIdx = Math.max(0, totalFrames - 1);
      const clamped = Math.max(0, Math.min(frameIndex, maxIdx));
      const frame = timelineStoreRef.current.getFrame(clamped);
      const t = frameVideoTime(frame, clamped, sampleFps);
      virtualVideoTimeRef.current = t;
      setCurrentFrameIndex(clamped);
      setPlaybackTimeSec(t);

      const video = videoRef.current;
      if (video && previewVideoSrc) {
        video.pause();
        if (Math.abs(video.currentTime - t) > 0.0005) {
          video.currentTime = t;
        }
      }
    },
    [totalFrames, sampleFps, previewVideoSrc],
  );

  const goPrev = useCallback(() => seekToFrame(currentFrameIndex - 1), [currentFrameIndex, seekToFrame]);
  const goNext = useCallback(() => seekToFrame(currentFrameIndex + 1), [currentFrameIndex, seekToFrame]);

  const togglePlay = useCallback(() => {
    const timelineCount = timelineStoreRef.current.getTimeline()?.frames.length ?? 0;
    const frameCount = session?.analysisResult?.frames?.length ?? 0;
    if (isExtracting || (frameCount < 1 && timelineCount < 1)) return;
    setIsPlaying((p) => !p);
  }, [session?.analysisResult?.frames?.length, isExtracting]);

  useEffect(() => {
    if (!session?.videoUrl || !frames.length || isExtracting) return;
    virtualVideoTimeRef.current = 0;
    setCurrentFrameIndex(0);
    setPlaybackTimeSec(0);
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  }, [session?.videoUrl, frames.length, isExtracting]);

  /** 원본 video native play */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewVideoSrc) return undefined;

    video.playbackRate = playbackSpeed;

    if (isExtracting) {
      video.pause();
      return undefined;
    }

    if (!isPlaying) {
      video.pause();
      return undefined;
    }

    const attemptPlay = () => {
      void video.play().catch((err) => {
        console.warn('[SkeletonDebug] video.play() failed:', err);
      });
    };

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      attemptPlay();
    } else {
      video.addEventListener('canplay', attemptPlay, { once: true });
    }

    const onEnded = () => setIsPlaying(false);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('canplay', attemptPlay);
      video.removeEventListener('ended', onEnded);
    };
  }, [isExtracting, isPlaying, playbackSpeed, previewVideoSrc]);

  /** Replay 모드(영상 없음) — ref 기반 가상 시간, React setState 없음 */
  useEffect(() => {
    if (session?.videoUrl || isExtracting || !isPlaying) {
      if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
      replayRafRef.current = null;
      return undefined;
    }

    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000) * playbackSpeed;
      last = now;
      virtualVideoTimeRef.current += delta;
      const duration = session?.durationSec ?? 0;
      if (duration > 0 && virtualVideoTimeRef.current >= duration) {
        virtualVideoTimeRef.current = duration;
        setIsPlaying(false);
        return;
      }
      replayRafRef.current = requestAnimationFrame(tick);
    };

    replayRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
      replayRafRef.current = null;
    };
  }, [isPlaying, session?.videoUrl, isExtracting, playbackSpeed, session?.durationSec]);

  const currentFrame = timelineStoreRef.current.getFrame(currentFrameIndex) ?? null;
  const prevFrame = currentFrameIndex > 0
    ? timelineStoreRef.current.getFrame(currentFrameIndex - 1) ?? null
    : null;
  const storedFrameStat = frameStats[currentFrameIndex] ?? null;

  const liveFrameStat = isExtracting
    ? (() => {
        const last = recorderRef.current.getLastDebug();
        return {
          frameIndex: liveState.currentFrameIndex ?? currentFrameIndex,
          timestamp: liveState.currentTimestamp || virtualVideoTimeRef.current,
          sourceVideoTime: liveState.currentTimestamp || virtualVideoTimeRef.current,
          detected: liveState.detectedCount || last.rawPoseCount || 0,
          tracked: liveState.trackedCount || last.trackedCount || 0,
          visible: liveState.detectedCount || last.visibleCount || 0,
          estimated: Math.max(0, (liveState.trackedCount || last.trackedCount || 0) - (liveState.detectedCount || last.rawPoseCount || 0)),
          confidence: last.avgConfidence ?? 0,
          coverage: liveState.coverage || last.coverage || 0,
          processingMs: liveState.totalProcessingMs || last.processingDelay || 0,
          queueLength: liveState.queueLength ?? last.queueLength ?? 0,
          droppedFrames: liveState.droppedFrames ?? last.droppedFrames ?? 0,
          mediaPipeDelayMs: liveState.frameSnapshot?.performance?.mediaPipeMs ?? last.mediaPipeDelay ?? 0,
          workerQueue: liveState.workerQueue ?? last.workerQueue ?? 0,
          poseQuality: last.poseQuality ?? null,
          trackingIds: liveState.frameSnapshot?.tracking?.trackIds ?? last.trackingIds ?? [],
          pipelineStage: last.pipelineStage || 'extracting',
        };
      })()
    : null;

  const currentFrameStat = liveFrameStat ?? storedFrameStat;

  const postHocAnalysis = analysisPackage && session
    ? getFrameAnalysis(
        analysisPackage,
        frames,
        frameStats,
        currentFrameIndex,
        session.groupId,
        sampleFps,
      )
    : null;

  const debugSnapshot = getSnapshotForFrame(currentFrameIndex);

  const currentFrameAnalysis = resolveFrameAnalysis({
    frameIndex: currentFrameIndex,
    debugSnapshot,
    postHoc: postHocAnalysis,
    frameStat: currentFrameStat,
    frames,
    sampleFps,
  });

  const trackIds = useMemo(() => {
    if ((isLive || isExtracting) && liveState.confidenceByTrack.size) {
      return Array.from(liveState.confidenceByTrack.keys()).sort((a, b) => a - b);
    }
    const ids = new Set<number>();
    frames.forEach((f) => f.detectedPeople?.forEach((p) => ids.add(p.trackId)));
    return Array.from(ids).sort((a, b) => a - b);
  }, [frames, isLive, isExtracting, liveState.confidenceByTrack]);

  const liveVideoWidth = timelineStoreRef.current.videoWidth
    || videoRef.current?.videoWidth
    || session?.analysisResult?.videoWidth
    || 1280;
  const liveVideoHeight = timelineStoreRef.current.videoHeight
    || videoRef.current?.videoHeight
    || session?.analysisResult?.videoHeight
    || 720;

  return {
    videoRef,
    extractionVideoRef,
    timelineStore: timelineStoreRef.current,
    playbackMode,
    hasPlaybackTimeline,
    timelineReady,
    playbackTimeSec,
    durationSec: session?.durationSec ?? 0,
    overlayRef,
    virtualVideoTimeRef,
    session,
    extractionPreviewUrl,
    isExtracting,
    progress,
    step,
    error,
    currentFrameIndex,
    currentFrame,
    prevFrame,
    currentFrameStat,
    frameStats,
    totalFrames,
    isPlaying,
    playbackSpeed,
    overlay,
    liveDiagnostics,
    renderMetrics,
    failureAnalysis,
    analysisPackage,
    currentFrameAnalysis,
    isAnalyzing,
    isLive: isLive || isExtracting,
    liveState,
    liveVideoWidth,
    liveVideoHeight,
    isExtractingLive: false,
    trackIds,
    handleRenderFrameIndex,
    setOverlay,
    runExtraction,
    loadReplayJson,
    cancel,
    seekToFrame,
    goPrev,
    goNext,
    togglePlay,
    setPlaybackSpeed,
  };
}

export default useSkeletonDebugSession;
