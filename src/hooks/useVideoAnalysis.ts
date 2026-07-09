// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import { MultiPersonTracker, type DetectionFrame } from '../services/MultiPersonTracker';
import type { AnalysisResult } from '../services/videoAnalysisTypes';
import { resolveVideoDurationSec, CHOREO_MAX_POSES_CAP } from '../config/choreoExtractConfig';
import { resolveAnalysisSampleFps } from '../utils/choreoVideoUtils';
import { sampleVideoFramesPlayback } from '../utils/videoFrameSampler';
import { createMultiLandmarkerDetector } from '../services/motion/MultiLandmarkerDetector';
import { associateHolisticLandmarksToPeople } from '../utils/holisticLandmarkUtils';

export function useVideoAnalysis() {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const trackerRef = useRef(new MultiPersonTracker());
  const abortRef = useRef(false);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsAnalyzing(false);
  }, []);

  const analyzeVideo = useCallback(async (videoFile: File): Promise<AnalysisResult> => {
    abortRef.current = false;
    trackerRef.current.reset();
    setIsAnalyzing(true);
    setError('');
    setProgress(5);
    setStatusMessage('Holistic AI 모션 분석 엔진을 준비하고 있습니다 (Pose+Hand+Face)...');

    let objectUrl = '';

    try {
      const detector = await createMultiLandmarkerDetector(CHOREO_MAX_POSES_CAP, setStatusMessage);
      if (abortRef.current) throw new Error('분석이 취소되었습니다.');

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;
      await new Promise<void>((resolve) => {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
      });

      const duration = resolveVideoDurationSec(video.duration);
      if (!duration) {
        throw new Error('영상 길이(video.duration)를 확인할 수 없습니다.');
      }
      const { sampleFps } = await resolveAnalysisSampleFps(video);
      trackerRef.current.setSampleFps(sampleFps);

      setStatusMessage('영상 재생·Holistic 동작 추출 중...');
      setProgress(15);

      const frames: DetectionFrame[] = [];
      const memberSamples: number[] = [];

      await sampleVideoFramesPlayback({
        video,
        sampleFps,
        maxDuration: duration,
        abortRef,
        onProgress: (pct) => setProgress(Math.round(15 + pct * 0.8)),
        onSample: async ({ time: t, video: src, source }) => {
          if (abortRef.current) throw new Error('분석이 취소되었습니다.');
          // source(캡처 시점 고정 스냅샷)를 우선 사용 — video는 Queue 처리 중 이미
          // 다른 프레임으로 재생이 진행되어 있을 수 있다.
          const results = detector.detect(source ?? src);
          const valid = trackerRef.current.countValidPoses(results.landmarks as unknown[]);
          if (valid > 0 && memberSamples.length < 20) memberSamples.push(valid);

          let trackedPeople = trackerRef.current.trackFrame(
            results.landmarks || [],
            results.worldLandmarks || [],
            t,
          );
          trackedPeople = associateHolisticLandmarksToPeople(trackedPeople, results);
          trackedPeople = trackerRef.current.enrichWithHolisticLandmarks(trackedPeople);
          frames.push({ timestamp: t, detectedPeople: trackedPeople });
        },
      });

      const memberCount = memberSamples.length
        ? Math.max(...memberSamples)
        : trackerRef.current.getPeakTrackCount();

      if (memberCount === 0) {
        throw new Error('영상에서 사람을 감지하지 못했습니다. 더 선명한 영상을 사용해주세요.');
      }

      setStatusMessage('각 멤버의 동선을 정리하는 중...');
      setProgress(92);

      const trackIdToInitialPosition = trackerRef.current.buildInitialPositions(frames);

      detector.close?.();
      setProgress(100);
      setStatusMessage('분석 완료!');
      setIsAnalyzing(false);

      return {
        detectedMemberCount: memberCount,
        frames,
        trackIdToInitialPosition,
      };
    } catch (err: any) {
      const message = err?.message || '영상 분석에 실패했습니다.';
      setError(message);
      setIsAnalyzing(false);
      throw err;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }, []);

  return {
    analyzeVideo,
    progress,
    statusMessage,
    isAnalyzing,
    error,
    cancel,
  };
}

export default useVideoAnalysis;
