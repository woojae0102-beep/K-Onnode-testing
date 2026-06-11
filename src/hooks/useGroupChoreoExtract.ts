// @ts-nocheck
import { useCallback, useState } from 'react';
import { GROUP_DATA } from '../data/groupPracticeData';
import { JOINT_MAP } from '../types/groupPractice';
import { postProcessFrame } from '../utils/memberPoseMatching';
import {
  buildChoreoCacheKey,
  getCachedChoreo,
  saveCachedChoreo,
} from '../services/groupChoreoCache';
import { buildProxyVideoUrl } from '../services/groupStudioApi';

const MAX_DURATION_SEC = 360;
const SAMPLE_FPS = 10;

function extractJoints(landmarks) {
  const joints = {};
  Object.entries(JOINT_MAP).forEach(([name, idx]) => {
    if (landmarks[idx]) {
      joints[name] = {
        x: landmarks[idx].x,
        y: landmarks[idx].y,
        z: landmarks[idx].z,
        visibility: landmarks[idx].visibility,
      };
    }
  });
  return joints;
}

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
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
        delegate,
      },
      runningMode: 'VIDEO',
      numPoses: group.memberCount,
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

  const extractFromVideoElement = useCallback(async (video, groupId, focusMemberId, onProgress) => {
    const group = GROUP_DATA[groupId];
    if (!group || !video) return null;

    abortRef.current = false;
    const detector = await createPoseDetector(group);
    const rawDuration = video.duration || 180;
    const duration = Math.min(Math.max(rawDuration, 10), MAX_DURATION_SEC);
    const sampleInterval = 1 / SAMPLE_FPS;
    const allFrames = [];
    let previousFrame = null;

    for (let t = 0; t < duration; t += sampleInterval) {
      if (abortRef.current) break;
      video.currentTime = t;
      await waitForVideoEvent(video, 'seeked');

      const results = detector.detectForVideo(video, t * 1000);
      if (results.landmarks?.length > 0) {
        const rawFrame = {
          timestamp: t,
          members: results.landmarks.map((landmarks, personIdx) => ({
            personIndex: personIdx,
            joints: extractJoints(landmarks),
            estimatedMemberId: null,
          })),
        };
        const frame = postProcessFrame(
          rawFrame,
          groupId,
          previousFrame,
          focusMemberId,
          results.landmarks.length,
        );
        allFrames.push(frame);
        previousFrame = frame;
      }

      const pct = Math.round((t / duration) * 100);
      onProgress?.(pct, `동작 추출 중... ${pct}%`);
    }

    detector.close?.();
    return allFrames.length ? allFrames : null;
  }, []);

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
        await waitForVideoEvent(video, 'loadeddata');
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
