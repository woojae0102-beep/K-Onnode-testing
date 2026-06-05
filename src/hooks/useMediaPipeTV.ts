// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseData } from '../types/tv';
import { computePoseMetrics } from '../utils/poseMetrics';
import { applyInlineVideoAttributes, buildMobileVideoConstraints } from '../utils/mobileMedia';
import { useSettingsStore } from '../store/settingsSlice';
import {
  cancelVideoFrame,
  getOptimizedCanvasContext,
  scheduleVideoFrame,
  syncCanvasToDisplayRect,
} from '../utils/cameraFrameLoop';

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

const DETECT_INTERVAL_MS = 1000 / 15;
const STATE_UPDATE_INTERVAL_MS = 100;

function drawSkeletonOnCanvas(canvas, joints, accuracies) {
  if (!canvas || !joints) return;
  const ctx = getOptimizedCanvasContext(canvas);
  if (!ctx) return;

  syncCanvasToDisplayRect(canvas);
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
    ctx.stroke();
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
  const settings = useSettingsStore((s) => s.settings);
  const [poseData, setPoseData] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const frameHandleRef = useRef(null);
  const agencyColorRef = useRef(agencyColor);
  const latestPoseRef = useRef(null);
  const lastDetectAtRef = useRef(0);
  const lastStateUpdateAtRef = useRef(0);
  const isDetectingRef = useRef(false);

  useEffect(() => {
    agencyColorRef.current = agencyColor;
  }, [agencyColor]);

  const stopLoop = useCallback(() => {
    cancelVideoFrame(frameHandleRef.current);
    frameHandleRef.current = null;
  }, []);

  const startDetectionLoop = useCallback((video) => {
    stopLoop();

    const tick = (now) => {
      const detector = detectorRef.current;
      if (!detector || !video) return;

      const canvas = document.querySelector('#skeleton-canvas');
      const cached = latestPoseRef.current;
      if (cached?.joints) {
        drawSkeletonOnCanvas(canvas, cached.joints, cached.jointAccuracies);
      }

      if (
        video.videoWidth > 0 &&
        !isDetectingRef.current &&
        now - lastDetectAtRef.current >= DETECT_INTERVAL_MS
      ) {
        isDetectingRef.current = true;
        lastDetectAtRef.current = now;

        try {
          const results = detector.detectForVideo(video, now);

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
            const nextPose = {
              joints,
              jointAccuracies,
              metrics,
              timestamp: now,
            };

            latestPoseRef.current = nextPose;
            drawSkeletonOnCanvas(canvas, joints, jointAccuracies);

            if (now - lastStateUpdateAtRef.current >= STATE_UPDATE_INTERVAL_MS) {
              lastStateUpdateAtRef.current = now;
              setPoseData(nextPose);
            }
          }
        } catch {
          /* skip frame */
        } finally {
          isDetectingRef.current = false;
        }
      }

      frameHandleRef.current = scheduleVideoFrame(video, tick);
    };

    frameHandleRef.current = scheduleVideoFrame(video, tick);
  }, [stopLoop]);

  const startTracking = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildMobileVideoConstraints(settings),
        audio: false,
      });
      streamRef.current = stream;

      const video = document.querySelector('#user-camera-video');
      if (video) {
        applyInlineVideoAttributes(video);
        video.srcObject = stream;
        await video.play();
      }

      const visionModule = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = visionModule;

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      const createDetector = async (delegate) =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate,
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });

      try {
        detectorRef.current = await createDetector('GPU');
      } catch {
        detectorRef.current = await createDetector('CPU');
      }

      latestPoseRef.current = null;
      lastDetectAtRef.current = 0;
      lastStateUpdateAtRef.current = 0;

      setIsTracking(true);
      if (video) startDetectionLoop(video);
    } catch (err) {
      console.error('카메라 시작 실패:', err);
    }
  }, [settings, startDetectionLoop]);

  const stopTracking = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current?.close?.();
    detectorRef.current = null;
    latestPoseRef.current = null;
    setIsTracking(false);
    setPoseData(null);

    const canvas = document.querySelector('#skeleton-canvas');
    const ctx = canvas ? getOptimizedCanvasContext(canvas) : null;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [stopLoop]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  return { poseData, isTracking, startTracking, stopTracking };
}

export default useMediaPipeTV;
