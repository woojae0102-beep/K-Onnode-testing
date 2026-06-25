// @ts-nocheck
import { useCallback, useState } from 'react';
import { GROUP_DATA } from '../data/groupPracticeData';
import { MultiPersonTracker } from '../services/MultiPersonTracker';
import { buildSkeletonFramesFromAnalysis } from '../services/videoAnalysisUtils';
import { suggestTrackToMemberMap } from '../services/formationMatching';
import {
  buildChoreoCacheKey,
  getCachedChoreo,
  saveCachedChoreo,
} from '../services/groupChoreoCache';
import { buildProxyVideoUrl } from '../services/groupStudioApi';
import {
  CHOREO_MAX_DURATION_SEC,
  CHOREO_MAX_POSES,
  CHOREO_MEMBER_PROBE_SAMPLES,
  CHOREO_POSE_MODEL_URL,
  CHOREO_SAMPLE_FPS,
} from '../config/choreoExtractConfig';

const MAX_DURATION_SEC = CHOREO_MAX_DURATION_SEC;
const SAMPLE_FPS = CHOREO_SAMPLE_FPS;
const MAX_POSES = CHOREO_MAX_POSES;

function waitForVideoEvent(video, event) {
  return new Promise((resolve) => {
    video.addEventListener(event, resolve, { once: true });
  });
}

async function createPoseDetector(group) {
  const visionModule = await import('@mediapipe/tasks-vision');
  const { PoseLandmarker, FilesetResolver } = visionModule;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
  );
  const createDetector = async (delegate) =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: CHOREO_POSE_MODEL_URL.lite,
        delegate,
      },
      runningMode: 'VIDEO',
      numPoses: MAX_POSES,
    });
  try {
    return await createDetector('GPU');
  } catch {
    return createDetector('CPU');
  }
}

export function useGroupChoreoExtract() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const abortRef = { current: false };

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsExtracting(false);
  }, []);

  const loadFromCache = useCallback(async (songId, videoId) => {
    const cacheKey = buildChoreoCacheKey(songId, videoId);
    const cached = await getCachedChoreo(cacheKey);
    if (!cached?.frames?.length) return null;
    setFromCache(true);
    return cached.frames;
  }, []);

  const extractAnalysisFromVideo = useCallback(async (video, groupId, onProgress) => {
    const group = GROUP_DATA[groupId];
    if (!group || !video) return null;

    abortRef.current = false;
    const detector = await createPoseDetector(group);
    const tracker = new MultiPersonTracker();

    onProgress?.(5, '영상 속 인원을 파악하고 있습니다...');
    const detectedMemberCount = await tracker.detectMemberCount(
      video,
      detector,
      CHOREO_MEMBER_PROBE_SAMPLES,
    );
    if (detectedMemberCount === 0) {
      detector.close?.();
      return null;
    }

    const rawDuration = video.duration || 180;
    const duration = Math.min(Math.max(rawDuration, 10), MAX_DURATION_SEC);
    const sampleInterval = 1 / SAMPLE_FPS;
    const frames = [];

    for (let t = 0; t < duration; t += sampleInterval) {
      if (abortRef.current) break;
      video.currentTime = t;
      await waitForVideoEvent(video, 'seeked');

      const results = detector.detectForVideo(video, t * 1000);
      const trackedPeople = tracker.trackFrame(results.landmarks || [], t);
      if (trackedPeople.length) {
        frames.push({ timestamp: t, detectedPeople: trackedPeople });
      }

      const pct = Math.round((t / duration) * 100);
      onProgress?.(pct, `${detectedMemberCount}명 추적 중... ${pct}%`);
    }

    detector.close?.();
    if (!frames.length) return null;

    return {
      detectedMemberCount,
      frames,
      trackIdToInitialPosition: tracker.buildInitialPositions(frames),
    };
  }, []);

  const extractFromVideoElement = useCallback(
    async (video, groupId, focusMemberId, onProgress) => {
      const analysisResult = await extractAnalysisFromVideo(video, groupId, onProgress);
      if (!analysisResult) return null;
      const trackToMemberMap = suggestTrackToMemberMap(
        groupId,
        focusMemberId,
        analysisResult.trackIdToInitialPosition,
      );
      return buildSkeletonFramesFromAnalysis(analysisResult, trackToMemberMap, focusMemberId);
    },
    [extractAnalysisFromVideo],
  );

  const extractAnalysis = useCallback(
    async ({ songId, groupId, videoId, file, videoRef }) => {
      const group = GROUP_DATA[groupId];
      if (!group) return null;

      setError('');
      setFromCache(false);
      abortRef.current = false;
      setIsExtracting(true);
      setProgress(5);
      setStep('AI 모션 분석 엔진 초기화 중...');

      try {
        const video = videoRef?.current;
        if (!video) throw new Error('비디오 요소가 없습니다.');

        let objectUrl = '';
        if (file) {
          objectUrl = URL.createObjectURL(file);
          video.src = objectUrl;
          video.crossOrigin = 'anonymous';
          await waitForVideoEvent(video, 'loadeddata');
        } else if (videoId) {
          video.src = buildProxyVideoUrl(videoId);
          video.crossOrigin = 'anonymous';
          video.preload = 'auto';
          await waitForVideoEvent(video, 'loadedmetadata');
          await waitForVideoEvent(video, 'canplay');
        } else {
          throw new Error('영상 소스가 없습니다.');
        }

        setProgress(15);
        setStep(`${group.nameKr} 안무를 분석하고 있습니다...`);

        const analysisResult = await extractAnalysisFromVideo(video, groupId, (pct, msg) => {
          setProgress(Math.round(15 + pct * 0.8));
          setStep(msg);
        });

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        video.src = '';

        if (!analysisResult) throw new Error('영상에서 동작을 감지하지 못했습니다.');

        setProgress(100);
        setStep('분석 완료 — 멤버 매칭을 확인해주세요');
        setIsExtracting(false);
        return { analysisResult, songId, groupId, videoId: videoId || (file ? `file:${file.name}` : null) };
      } catch (err) {
        console.error('[useGroupChoreoExtract.extractAnalysis]', err);
        setError(err?.message || '안무 분석에 실패했습니다.');
        setIsExtracting(false);
        return null;
      }
    },
    [extractAnalysisFromVideo],
  );

  const extractChoreo = useCallback(async ({
    songId,
    groupId,
    videoId,
    focusMemberId,
    file,
    skipCache = false,
    videoRef,
  }) => {
    const group = GROUP_DATA[groupId];
    if (!group) return null;

    setError('');
    setFromCache(false);

    if (!skipCache && videoId) {
      const cached = await loadFromCache(songId, videoId);
      if (cached) {
        setProgress(100);
        setStep('캐시된 안무 데이터를 불러왔습니다.');
        return cached;
      }
    }

    abortRef.current = false;
    setIsExtracting(true);
    setProgress(5);
    setStep('AI 모션 감지 시스템 초기화 중...');

    try {
      const video = videoRef?.current;
      if (!video) throw new Error('비디오 요소가 없습니다.');

      if (file) {
        const url = URL.createObjectURL(file);
        video.src = url;
        video.crossOrigin = 'anonymous';
        await waitForVideoEvent(video, 'loadeddata');
        setProgress(15);
        setStep(`${group.nameKr} 안무를 분석하고 있습니다...`);

        const frames = await extractFromVideoElement(video, groupId, focusMemberId, (pct, msg) => {
          setProgress(Math.round(15 + pct * 0.8));
          setStep(msg);
        });

        URL.revokeObjectURL(url);
        video.src = '';

        if (!frames?.length) throw new Error('영상에서 동작을 감지하지 못했습니다.');
        await persistCache(songId, videoId || `file:${file.name}`, frames, groupId, videoId);
        setProgress(100);
        setStep('안무 추출 완료!');
        setIsExtracting(false);
        return frames;
      }

      if (videoId) {
        const proxyUrl = buildProxyVideoUrl(videoId);
        video.src = proxyUrl;
        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        await waitForVideoEvent(video, 'loadedmetadata');
        await waitForVideoEvent(video, 'canplay');
        setProgress(15);
        setStep('YouTube 안무 영상을 분석하고 있습니다...');

        const frames = await extractFromVideoElement(video, groupId, focusMemberId, (pct, msg) => {
          setProgress(Math.round(15 + pct * 0.8));
          setStep(msg);
        });

        video.src = '';

        if (!frames?.length) {
          throw new Error('YouTube 영상 추출에 실패했습니다. 영상 파일을 직접 업로드해 주세요.');
        }

        await persistCache(songId, videoId, frames, groupId, videoId);
        setProgress(100);
        setStep('안무 추출 완료!');
        setIsExtracting(false);
        return frames;
      }

      throw new Error('영상 소스가 없습니다.');
    } catch (err) {
      console.error('[useGroupChoreoExtract]', err);
      setError(err?.message || '안무 추출에 실패했습니다.');
      setIsExtracting(false);
      return null;
    }
  }, [extractFromVideoElement, loadFromCache]);

  return {
    isExtracting,
    progress,
    step,
    error,
    fromCache,
    cancel,
    loadFromCache,
    extractChoreo,
    extractAnalysis,
  };
}

async function persistCache(songId, videoId, frames, groupId, sourceVideoId) {
  const cacheKey = buildChoreoCacheKey(songId, sourceVideoId || videoId);
  await saveCachedChoreo({
    cacheKey,
    songId,
    videoId: sourceVideoId || videoId,
    groupId,
    frames,
    frameCount: frames.length,
    durationSec: frames[frames.length - 1]?.timestamp || 0,
  });
}

export default useGroupChoreoExtract;
