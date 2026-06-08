// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseData } from '../types/tv';
import { computePoseMetrics } from '../utils/poseMetrics';
import { applyInlineVideoAttributes, buildMobileVideoConstraints } from '../utils/mobileMedia';
import { useSettingsStore } from '../store/settingsSlice';
import { getOptimizedCanvasContext, syncCanvasToDisplayRect } from '../utils/cameraFrameLoop';

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

const DETECT_INTERVAL_MS = 100;
const STATE_UPDATE_INTERVAL_MS = 250;

function buildTVVideoConstraints(settings, facingMode = 'user') {
  const base = buildMobileVideoConstraints(settings);
  return {
    ...base,
    facingMode: { ideal: facingMode },
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 24, max: 30 },
  };
}

function drawSkeletonOnCanvas(canvas, joints, accuracies) {
  if (!canvas || !joints) return;
  const ctx = getOptimizedCanvasContext(canvas);
  if (!ctx) return;

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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const facingModeRef = useRef('user');
  const detectTimerRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const agencyColorRef = useRef(agencyColor);
  const latestPoseRef = useRef(null);
  const lastStateUpdateAtRef = useRef(0);
  const isDetectingRef = useRef(false);
  const detectTimestampRef = useRef(0);

  useEffect(() => {
    agencyColorRef.current = agencyColor;
  }, [agencyColor]);

  const bindCanvasResizeObserver = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeObserverRef.current?.disconnect();
    syncCanvasToDisplayRect(canvas);

    resizeObserverRef.current = new ResizeObserver(() => {
      syncCanvasToDisplayRect(canvas);
      const cached = latestPoseRef.current;
      if (cached?.joints) {
        drawSkeletonOnCanvas(canvas, cached.joints, cached.jointAccuracies);
      }
    });
    resizeObserverRef.current.observe(canvas);
  }, []);

  const stopDetectionLoop = useCallback(() => {
    if (detectTimerRef.current) {
      clearTimeout(detectTimerRef.current);
      detectTimerRef.current = 0;
    }
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
  }, []);

  const startDetectionLoop = useCallback(() => {
    stopDetectionLoop();
    bindCanvasResizeObserver();

    const runDetection = () => {
      const detector = detectorRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!detector || !video) {
        detectTimerRef.current = window.setTimeout(runDetection, DETECT_INTERVAL_MS);
        return;
      }

      if (video.videoWidth > 0 && !isDetectingRef.current) {
        isDetectingRef.current = true;
        const now = performance.now();

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
              detectTimestampRef.current = now;
              setPoseData(nextPose);
            }
          }
        } catch {
          /* skip frame */
        } finally {
          isDetectingRef.current = false;
        }
      }

      detectTimerRef.current = window.setTimeout(runDetection, DETECT_INTERVAL_MS);
    };

    detectTimerRef.current = window.setTimeout(runDetection, DETECT_INTERVAL_MS);
  }, [bindCanvasResizeObserver, stopDetectionLoop]);

  const startTracking = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildTVVideoConstraints(settings, facingModeRef.current),
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        applyInlineVideoAttributes(video);
        video.srcObject = stream;
        await video.play();
      }

      const visionModule = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = visionModule;

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm',
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
      lastStateUpdateAtRef.current = 0;
      detectTimestampRef.current = 0;

      setIsTracking(true);
      startDetectionLoop();
    } catch (err) {
      console.error('카메라 시작 실패:', err);
    }
  }, [settings, startDetectionLoop]);

  const stopTracking = useCallback(() => {
    stopDetectionLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current?.close?.();
    detectorRef.current = null;
    latestPoseRef.current = null;
    setIsTracking(false);
    setPoseData(null);

    const canvas = canvasRef.current;
    const ctx = canvas ? getOptimizedCanvasContext(canvas) : null;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);

    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, [stopDetectionLoop]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const getStream = useCallback(() => streamRef.current, []);

  const switchCamera = useCallback(async () => {
    facingModeRef.current = facingModeRef.current === 'user' ? 'environment' : 'user';
    if (!isTracking) return;
    stopTracking();
    await startTracking();
  }, [isTracking, startTracking, stopTracking]);

  return {
    poseData,
    isTracking,
    startTracking,
    stopTracking,
    switchCamera,
    videoRef,
    canvasRef,
    getStream,
  };
}

export default useMediaPipeTV;
