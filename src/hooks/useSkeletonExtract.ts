// @ts-nocheck
import { useCallback, useRef, useState } from 'react';
import type { SkeletonFrameData } from '../types/groupPractice';
import { JOINT_MAP } from '../types/groupPractice';
import { GROUP_DATA } from '../data/groupPracticeData';

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

export function useSkeletonExtract() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const abortRef = useRef(false);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsExtracting(false);
  }, []);

  const extractFromFile = useCallback(async (file, groupId) => {
    const group = GROUP_DATA[groupId];
    if (!group || !file) return null;

    abortRef.current = false;
    setIsExtracting(true);
    setProgress(0);
    setError('');
    setStep('영상을 분석하고 있습니다...');

    try {
      setProgress(10);
      setStep('AI 모션 감지 시스템 초기화 중...');
      setProgress(25);

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

      let detector;
      try {
        detector = await createDetector('GPU');
      } catch {
        detector = await createDetector('CPU');
      }

      setStep(`${group.nameKr} 멤버 ${group.memberCount}명의 동작을 추출하고 있습니다...`);
      setProgress(40);

      const video = videoRef.current;
      if (!video) throw new Error('비디오 요소가 없습니다.');

      const url = URL.createObjectURL(file);
      video.src = url;
      await waitForVideoEvent(video, 'loadeddata');

      const duration = video.duration || 30;
      const sampleFps = 10;
      const sampleInterval = 1 / sampleFps;
      const allFrames = [];
      const sortedMembers = group.members.slice().sort((a, b) => a.defaultX - b.defaultX);

      for (let t = 0; t < duration; t += sampleInterval) {
        if (abortRef.current) break;

        video.currentTime = t;
        await waitForVideoEvent(video, 'seeked');

        const results = detector.detectForVideo(video, t * 1000);

        if (results.landmarks?.length > 0) {
          const frameData = {
            timestamp: t,
            members: results.landmarks.map((landmarks, personIdx) => ({
              personIndex: personIdx,
              joints: extractJoints(landmarks),
              estimatedMemberId: null,
            })),
          };

          frameData.members.sort(
            (a, b) => (a.joints.nose?.x || 0) - (b.joints.nose?.x || 0),
          );

          frameData.members.forEach((m, i) => {
            if (sortedMembers[i]) m.estimatedMemberId = sortedMembers[i].id;
          });

          allFrames.push(frameData);
        }

        setProgress(Math.round(40 + (t / duration) * 50));
        setStep(`동작 추출 중... ${Math.round((t / duration) * 100)}%`);
      }

      detector.close?.();
      URL.revokeObjectURL(url);
      video.src = '';

      if (allFrames.length === 0) {
        throw new Error('영상에서 동작을 감지하지 못했습니다. 다른 영상을 시도해 주세요.');
      }

      setStep('AI 아바타 생성 완료!');
      setProgress(100);
      setIsExtracting(false);
      return allFrames;
    } catch (err) {
      console.error('스켈레톤 추출 실패:', err);
      setError(err?.message || '스켈레톤 추출에 실패했습니다.');
      setIsExtracting(false);
      return null;
    }
  }, []);

  return {
    isExtracting,
    progress,
    step,
    error,
    videoRef,
    extractFromFile,
    cancel,
  };
}

export function findNearestFrame(frames, time) {
  if (!frames?.length) return null;
  return frames.reduce((nearest, frame) =>
    Math.abs(frame.timestamp - time) < Math.abs(nearest.timestamp - time) ? frame : nearest,
  );
}

export default useSkeletonExtract;
