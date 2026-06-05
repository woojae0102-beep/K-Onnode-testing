// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseData } from '../types/tv';
import { computePoseMetrics } from '../utils/poseMetrics';

const JOINT_MAP = {
  nose: 0,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};

const CONNECTIONS = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

function drawSkeletonOnCanvas(canvas, joints, accuracies, agencyColor) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  CONNECTIONS.forEach(([start, end]) => {
    const s = joints[start];
    const e = joints[end];
    if (!s || !e) return;

    const accuracy = ((accuracies[start] || 0) + (accuracies[end] || 0)) / 2;
    const color = accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444';

    ctx.beginPath();
    ctx.moveTo(s.x * canvas.width, s.y * canvas.height);
    ctx.lineTo(e.x * canvas.width, e.y * canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  Object.entries(joints).forEach(([name, joint]) => {
    const accuracy = accuracies[name] || 0;
    const color = accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444';
    ctx.beginPath();
    ctx.arc(joint.x * canvas.width, joint.y * canvas.height, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

export function useMediaPipeTV(agencyColor = '#FF1F8E') {
  const [poseData, setPoseData] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(0);
  const agencyColorRef = useRef(agencyColor);

  useEffect(() => {
    agencyColorRef.current = agencyColor;
  }, [agencyColor]);

  const startDetectionLoop = useCallback((video) => {
    const detect = async () => {
      if (!detectorRef.current || !video) return;

      try {
        const results = detectorRef.current.detectForVideo(video, performance.now());

        if (results.landmarks?.[0]) {
          const landmarks = results.landmarks[0];
          const joints = {};

          Object.entries(JOINT_MAP).forEach(([name, idx]) => {
            const lm = landmarks[idx];
            if (lm) {
              joints[name] = {
                x: lm.x,
                y: lm.y,
                z: lm.z,
                visibility: lm.visibility,
              };
            }
          });

          const metrics = computePoseMetrics(joints);
          const jointAccuracies = metrics.jointAccuracies;
          const canvas = document.querySelector('#skeleton-canvas');
          drawSkeletonOnCanvas(canvas, joints, jointAccuracies, agencyColorRef.current);

          setPoseData({
            joints,
            jointAccuracies,
            metrics,
            timestamp: performance.now(),
          });
        }
      } catch {
        /* skip frame */
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    detect();
  }, []);

  const startTracking = useCallback(async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = document.querySelector('#user-camera-video');
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      const visionModule = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = visionModule;

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      detectorRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      setIsTracking(true);
      if (video) startDetectionLoop(video);
    } catch (err) {
      console.error('카메라 시작 실패:', err);
    }
  }, [startDetectionLoop]);

  const stopTracking = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
    setIsTracking(false);
    setPoseData(null);
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  return { poseData, isTracking, startTracking, stopTracking };
}

export default useMediaPipeTV;
