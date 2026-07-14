// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeFileHolistic } from '../../services/motion/MotionExtractionEngine';
import { getGroupData } from '../../data/groupPracticeData';
import { CHOREO_DEFAULT_SAMPLE_FPS } from '../../config/choreoExtractConfig';
import { getRvfcScheduleState, resetRvfcScheduleState } from '../../utils/workerErrorDiagnostics';
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
import { useDebugEventBus } from './live/useDebugEventBus';
import { resolveFrameAnalysis } from './live/liveFrameAnalysisBridge';

export function useSkeletonDebugSession() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef(new SkeletonDebugRecorder());
  const abortRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const [session, setSession] = useState<SkeletonDebugSession | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [overlay, setOverlay] = useState<SkeletonDebugOverlayOptions>({ ...DEFAULT_OVERLAY });
  const [liveDiagnostics, setLiveDiagnostics] = useState<SkeletonDebugLiveDiagnostics>({});
  const [failureAnalysis, setFailureAnalysis] = useState<import('./types').SkeletonFailureAnalysis | null>(null);
  const [analysisPackage, setAnalysisPackage] = useState<SkeletonAnalysisPackage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const {
    liveState,
    isLive,
    startLiveBus,
    stopLiveBus,
    getSnapshotForFrame,
    flush: flushDebugBus,
  } = useDebugEventBus();

  useEffect(() => () => stopLiveBus(), [stopLiveBus]);

  const frames = session?.analysisResult?.frames ?? [];
  const frameStats = session?.frameStats ?? [];
  const totalFrames = frames.length;
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
      setCurrentFrameIndex(0);

      const recorder = new SkeletonDebugRecorder();
      recorderRef.current = recorder;
      resetRvfcScheduleState();
      startLiveBus();

      const videoUrl = URL.createObjectURL(file);
      const video = videoRef.current || document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = videoUrl;
      if (!videoRef.current) videoRef.current = video;

      try {
        const analysisResult = await analyzeFileHolistic({
          file,
          groupId,
          userMemberId,
          video,
          onStatus: setStep,
          onProgress: setProgress,
          onDebug: (patch) => {
            recorder.recordDebug(patch);
            setLiveDiagnostics(buildLiveDiagnostics(recorder));
            if (patch.frameIndex != null) {
              setCurrentFrameIndex(Math.floor(patch.frameIndex));
            }
          },
          onFrameDetected: (payload) => {
            recorder.recordFrameDetected(payload);
          },
          abortRef,
        });

        const builtStats = recorder.buildFrameStats(analysisResult.frames);
        const trackHistory = buildTrackHistory(analysisResult.frames);
        const coverage = builtStats.length ? builtStats[builtStats.length - 1].coverage : 0;
        const sampleFps = analysisResult.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS;

        setStep('Skeleton Analysis — RCA 계산 중...');
        setIsAnalyzing(true);
        const pkg = buildFullAnalysisPackage({
          analysisResult,
          frameStats: builtStats,
          groupId,
          sampleFps,
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
        setSession({
          mode: 'extraction',
          groupId,
          videoUrl,
          videoFileName: file.name,
          analysisResult,
          exportDocument,
          frameStats: builtStats,
          trackHistory,
          sampleFps,
          totalFrames: analysisResult.frames.length,
          durationSec: analysisResult.sourceVideoDurationSec ?? 0,
          failureAnalysis: null,
          analysisPackage: pkg,
        });
        setLiveDiagnostics(buildLiveDiagnostics(recorder));
        setStep(`추출 완료 — ${analysisResult.frames.length} frames`);
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
        URL.revokeObjectURL(videoUrl);
      } finally {
        stopLiveBus();
        setIsExtracting(false);
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
  }, [stopLiveBus]);

  const seekToFrame = useCallback(
    (frameIndex: number) => {
      const clamped = Math.max(0, Math.min(frameIndex, Math.max(0, totalFrames - 1)));
      setCurrentFrameIndex(clamped);
      const frame = frames[clamped];
      const video = videoRef.current;
      if (video && session?.videoUrl && frame) {
        const t = frame.sourceVideoTime ?? frame.timestamp ?? clamped / sampleFps;
        if (Math.abs(video.currentTime - t) > 0.02) {
          video.currentTime = t;
        }
      }
    },
    [frames, totalFrames, sampleFps, session?.videoUrl],
  );

  const goPrev = useCallback(() => seekToFrame(currentFrameIndex - 1), [currentFrameIndex, seekToFrame]);
  const goNext = useCallback(() => seekToFrame(currentFrameIndex + 1), [currentFrameIndex, seekToFrame]);

  const togglePlay = useCallback(() => {
    if (totalFrames <= 1) return;
    setIsPlaying((p) => !p);
    if (session?.videoUrl && videoRef.current) {
      if (!isPlaying) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
  }, [totalFrames, session?.videoUrl, isPlaying]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || totalFrames <= 1) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return undefined;
    }

    const tick = (now: number) => {
      if (!lastTickRef.current) lastTickRef.current = now;
      const delta = now - lastTickRef.current;
      const frameAdvance = (delta / 1000) * sampleFps * playbackSpeed;
      if (frameAdvance >= 1) {
        const steps = Math.floor(frameAdvance);
        lastTickRef.current = now;
        setCurrentFrameIndex((idx) => {
          const next = idx + steps;
          if (next >= totalFrames - 1) {
            setIsPlaying(false);
            if (videoRef.current) videoRef.current.pause();
            return totalFrames - 1;
          }
          const frame = frames[next];
          if (videoRef.current && session?.videoUrl && frame) {
            const t = frame.sourceVideoTime ?? frame.timestamp ?? next / sampleFps;
            videoRef.current.currentTime = t;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [isPlaying, totalFrames, sampleFps, playbackSpeed, frames, session?.videoUrl]);

  const currentFrame = frames[currentFrameIndex] ?? null;
  const prevFrame = currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : null;
  const storedFrameStat = frameStats[currentFrameIndex] ?? null;

  const liveFrameStat = isExtracting && isLive
    ? {
        frameIndex: liveState.currentFrameIndex,
        timestamp: liveState.currentTimestamp,
        sourceVideoTime: liveState.currentTimestamp,
        detected: liveState.detectedCount,
        tracked: liveState.trackedCount,
        visible: liveState.detectedCount,
        estimated: Math.max(0, liveState.trackedCount - liveState.detectedCount),
        confidence: recorderRef.current.getLastDebug().avgConfidence ?? 0,
        coverage: liveState.coverage,
        processingMs: liveState.totalProcessingMs,
        queueLength: liveState.queueLength,
        droppedFrames: liveState.droppedFrames,
        mediaPipeDelayMs: liveState.frameSnapshot?.performance?.mediaPipeMs ?? 0,
        workerQueue: liveState.workerQueue,
        poseQuality: null,
        trackingIds: liveState.frameSnapshot?.tracking?.trackIds ?? [],
        pipelineStage: 'live',
      }
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

  return {
    videoRef,
    session,
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
    failureAnalysis,
    analysisPackage,
    currentFrameAnalysis,
    isAnalyzing,
    isLive: isLive || isExtracting,
    liveState,
    trackIds,
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
