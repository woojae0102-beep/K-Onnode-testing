// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import { MultiPersonTracker, type DetectionFrame } from '../services/MultiPersonTracker';
import type { AnalysisResult } from '../services/videoAnalysisTypes';

const MAX_DURATION_SEC = 360;
const SAMPLE_FPS = 15;
const MAX_POSES = 8;

function waitForVideoEvent(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve) => {
    video.addEventListener(event, () => resolve(), { once: true });
  });
}

async function createPoseDetector() {
  const visionModule = await import('@mediapipe/tasks-vision');
  const { PoseLandmarker, FilesetResolver } = visionModule;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
  );

  const createDetector = async (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
        delegate,
      },
      runningMode: 'IMAGE',
      numPoses: MAX_POSES,
    });

  try {
    return await createDetector('GPU');
  } catch {
    return createDetector('CPU');
  }
}

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
    setStatusMessage('AI 모션 분석 엔진을 준비하고 있습니다...');

    let objectUrl = '';

    try {
      const detector = await createPoseDetector();
      if (abortRef.current) throw new Error('분석이 취소되었습니다.');

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;
      await waitForVideoEvent(video, 'loadeddata');

      setStatusMessage('영상 속 인원을 파악하고 있습니다...');
      setProgress(15);

      const memberCount = await trackerRef.current.detectMemberCount(video, detector, 20, (d, v) => d.detect(v));
      if (memberCount === 0) {
        throw new Error('영상에서 사람을 감지하지 못했습니다. 더 선명한 영상을 사용해주세요.');
      }

      setStatusMessage(`${memberCount}명을 감지했습니다. 동작을 추출하는 중...`);
      setProgress(25);

      const duration = Math.min(Math.max(video.duration || 0, 1), MAX_DURATION_SEC);
      const sampleInterval = 1 / SAMPLE_FPS;
      const frames: DetectionFrame[] = [];

      for (let t = 0; t < duration; t += sampleInterval) {
        if (abortRef.current) throw new Error('분석이 취소되었습니다.');

        video.currentTime = t;
        await waitForVideoEvent(video, 'seeked');

        const results = detector.detect(video);
        const trackedPeople = trackerRef.current.trackFrame(results.landmarks || [], t);
        frames.push({ timestamp: t, detectedPeople: trackedPeople });

        setProgress(Math.round(25 + (t / duration) * 65));
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
