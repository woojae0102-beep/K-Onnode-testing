// @ts-nocheck
import { useCallback, useState } from 'react';
import { getGroupData } from '../data/groupPracticeData';
import { MultiPersonTracker } from '../services/MultiPersonTracker';
import { buildSkeletonFramesFromAnalysis } from '../services/videoAnalysisUtils';
import { suggestTrackToMemberMap } from '../services/formationMatching';
import {
  buildChoreoCacheKey,
  getCachedChoreo,
  saveCachedChoreo,
} from '../services/groupChoreoCache';
import {
  CHOREO_MAX_DURATION_SEC,
  CHOREO_MAX_POSES,
  CHOREO_MEMBER_PROBE_SAMPLES,
  CHOREO_POSE_MODEL_URL,
  CHOREO_SAMPLE_FPS,
} from '../config/choreoExtractConfig';
import { prepareAnalysisVideo, seekVideoTo } from '../utils/choreoVideoUtils';

const MAX_DURATION_SEC = CHOREO_MAX_DURATION_SEC;
const SAMPLE_FPS = CHOREO_SAMPLE_FPS;
const MAX_POSES = CHOREO_MAX_POSES;
const AI_INIT_TIMEOUT_MS = 60000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function createPoseDetector(onStatus) {
  onStatus?.('MediaPipe AI 모듈 로드 중...');
  const visionModule = await withTimeout(
    import('@mediapipe/tasks-vision'),
    AI_INIT_TIMEOUT_MS,
    'AI 모듈 로드 시간이 초과되었습니다. 네트워크 연결 후 다시 시도해 주세요.',
  );
  const { PoseLandmarker, FilesetResolver } = visionModule;

  onStatus?.('AI 모션 분석 엔진 초기화 중...');
  const vision = await withTimeout(
    FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
    ),
    AI_INIT_TIMEOUT_MS,
    'AI 엔진(WASM) 초기화 시간이 초과되었습니다. 페이지를 새로고침 후 다시 시도해 주세요.',
  );

  const build = async (delegate) => {
    onStatus?.(delegate === 'GPU' ? 'GPU AI 모델 로드 중...' : 'CPU AI 모델 로드 중...');
    return withTimeout(
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: CHOREO_POSE_MODEL_URL.lite,
          delegate,
        },
        runningMode: 'VIDEO',
        numPoses: MAX_POSES,
      }),
      AI_INIT_TIMEOUT_MS,
      'AI 포즈 모델 로드 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
    );
  };

  try {
    return await build('GPU');
  } catch (gpuErr) {
    console.warn('[createPoseDetector] GPU failed, falling back to CPU', gpuErr);
    return build('CPU');
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
    setStep('취소됨');
  }, []);

  const loadFromCache = useCallback(async (songId, videoId) => {
    const cacheKey = buildChoreoCacheKey(songId, videoId);
    const cached = await getCachedChoreo(cacheKey);
    if (!cached?.frames?.length) return null;
    setFromCache(true);
    return cached.frames;
  }, []);

  const extractAnalysisFromVideo = useCallback(async (video, groupId, detector, onProgress) => {
    const group = getGroupData(groupId);
    if (!group || !video || !detector) return null;

    abortRef.current = false;
    const tracker = new MultiPersonTracker();

    onProgress?.(5, '영상 속 인원을 파악하고 있습니다...');
    const detectedMemberCount = await tracker.detectMemberCount(
      video,
      detector,
      CHOREO_MEMBER_PROBE_SAMPLES,
    );
    if (detectedMemberCount === 0) {
      return null;
    }

    const rawDuration = video.duration || 180;
    const duration = Math.min(Math.max(rawDuration, 10), MAX_DURATION_SEC);
    const sampleInterval = 1 / SAMPLE_FPS;
    const frames = [];

    for (let t = 0; t < duration; t += sampleInterval) {
      if (abortRef.current) break;
      await seekVideoTo(video, t);

      const results = detector.detectForVideo(video, t * 1000);
      const trackedPeople = tracker.trackFrame(results.landmarks || [], t);
      if (trackedPeople.length) {
        frames.push({ timestamp: t, detectedPeople: trackedPeople });
      }

      const pct = Math.round((t / duration) * 100);
      onProgress?.(pct, `${detectedMemberCount}명 추적 중... ${pct}%`);
    }

    if (!frames.length) return null;

    return {
      detectedMemberCount,
      frames,
      trackIdToInitialPosition: tracker.buildInitialPositions(frames),
    };
  }, []);

  const extractFromVideoElement = useCallback(
    async (video, groupId, focusMemberId, detector, onProgress) => {
      const analysisResult = await extractAnalysisFromVideo(video, groupId, detector, onProgress);
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
    async ({ songId, groupId, videoId, file, videoRef, youtubePlayerRef }) => {
      const group = getGroupData(groupId);
      if (!group) return null;

      setError('');
      setFromCache(false);
      abortRef.current = false;
      setIsExtracting(true);
      setProgress(5);
      setStep('준비 중...');

      let cleanup = () => {};

      try {
        const video = videoRef?.current;
        if (!video) throw new Error('비디오 요소가 없습니다.');

        const status = (msg) => {
          setStep(msg);
        };

        let detectorPromise = null;

        // YouTube: 영상 준비(탭 녹화)를 먼저 시작하고, 녹화 중 AI 모델을 병렬 로드
        const prepPromise = prepareAnalysisVideo(video, {
          file,
          videoId,
          onStatus: status,
          youtubePlayerRef,
        });

        if (videoId && youtubePlayerRef && !file) {
          // 녹화 안내 메시지가 AI 로드 메시지에 덮이지 않도록
          detectorPromise = createPoseDetector(null);
        }

        const prep = await prepPromise;
        cleanup = prep.cleanup;

        if (abortRef.current) throw new Error('취소되었습니다.');

        setProgress(12);
        const detector = detectorPromise
          ? await detectorPromise
          : await createPoseDetector(status);

        setProgress(15);
        setStep(`${group.nameKr} 안무를 분석하고 있습니다...`);

        const analysisResult = await extractAnalysisFromVideo(
          video,
          groupId,
          detector,
          (pct, msg) => {
            setProgress(Math.round(15 + pct * 0.8));
            setStep(msg);
          },
        );

        detector.close?.();
        cleanup();

        if (!analysisResult) throw new Error('영상에서 동작을 감지하지 못했습니다. 안무 연습 영상인지 확인하거나 파일을 직접 업로드해 주세요.');

        setProgress(100);
        setStep('분석 완료 — 멤버 매칭을 확인해주세요');
        setIsExtracting(false);
        return {
          analysisResult,
          songId,
          groupId,
          videoId: videoId || (file ? `file:${file.name}` : null),
        };
      } catch (err) {
        console.error('[useGroupChoreoExtract.extractAnalysis]', err);
        cleanup();
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
    youtubePlayerRef,
  }) => {
    const group = getGroupData(groupId);
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
    setStep('준비 중...');

    let cleanup = () => {};

    try {
      const video = videoRef?.current;
      if (!video) throw new Error('비디오 요소가 없습니다.');

      const status = (msg) => setStep(msg);
      const prep = await prepareAnalysisVideo(video, {
        file,
        videoId,
        onStatus: status,
        youtubePlayerRef,
      });
      cleanup = prep.cleanup;

      setProgress(12);
      const detector = await createPoseDetector(status);

      setProgress(15);
      setStep(file ? `${group.nameKr} 안무를 분석하고 있습니다...` : 'YouTube 안무 영상을 분석하고 있습니다...');

      const frames = await extractFromVideoElement(
        video,
        groupId,
        focusMemberId,
        detector,
        (pct, msg) => {
          setProgress(Math.round(15 + pct * 0.8));
          setStep(msg);
        },
      );

      detector.close?.();
      cleanup();

      if (!frames?.length) {
        throw new Error(
          videoId
            ? 'YouTube 영상 추출에 실패했습니다. 영상 파일을 직접 업로드해 주세요.'
            : '영상에서 동작을 감지하지 못했습니다.',
        );
      }

      await persistCache(songId, videoId || (file ? `file:${file.name}` : null), frames, groupId, videoId);
      setProgress(100);
      setStep('안무 추출 완료!');
      setIsExtracting(false);
      return frames;
    } catch (err) {
      console.error('[useGroupChoreoExtract]', err);
      cleanup();
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
