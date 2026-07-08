// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseData } from '../types/tv';
import { computePoseMetrics } from '../utils/poseMetrics';
import { applyInlineVideoAttributes, buildMobileVideoConstraints } from '../utils/mobileMedia';
import { useSettingsStore } from '../store/settingsSlice';
import { MEDIAPIPE_WASM_BASE, MEDIAPIPE_WASM_CDN } from '../config/groupChoreoConstants';
import { getOptimizedCanvasContext, syncCanvasToDisplayRect } from '../utils/cameraFrameLoop';
import {
  buildCameraFitView,
  drawCameraSkeletonOverlay,
  verifyCameraPipeline,
  type CameraFitMode,
  type CameraHealthStatus,
} from '../utils/cameraOverlayUtils';

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

async function playVideoWhenReady(video: HTMLVideoElement) {
  applyInlineVideoAttributes(video);
  await new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.addEventListener('loadeddata', () => resolve(), { once: true });
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await video.play();
      return;
    } catch (err: any) {
      if (err?.name !== 'AbortError' || attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
  }
}

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

function drawSkeletonOnCanvas(canvas, video, joints, accuracies, fitMode: CameraFitMode = 'contain') {
  if (!canvas || !joints) return;
  const ctx = getOptimizedCanvasContext(canvas);
  if (!ctx) return;

  // Overlay only — video 프레임은 <video>에 표시, canvas에 drawImage 금지
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vw = video?.videoWidth || canvas.width;
  const vh = video?.videoHeight || canvas.height;
  const view = buildCameraFitView(fitMode, vw, vh, canvas.width, canvas.height);

  const colorForJoint = (name) => {
    const accuracy = accuracies[name] || 0;
    if (accuracy > 80) return '#00FF88';
    if (accuracy > 60) return '#FFD700';
    return '#FF4444';
  };

  drawCameraSkeletonOverlay(ctx, joints, view, CONNECTIONS, {
    boneWidth: 5,
    jointRadius: 7,
    glowBlur: 14,
    colorForJoint,
  });
}

export interface UseMediaPipeTVOptions {
  /** 연습 모드 기본값 contain — 몸 잘림 방지, letterbox 허용 */
  fitMode?: CameraFitMode;
}

export function useMediaPipeTV(agencyColor = '#FF1F8E', options: UseMediaPipeTVOptions = {}) {
  const fitMode: CameraFitMode = options.fitMode ?? 'contain';
  const settings = useSettingsStore((s) => s.settings);
  const [poseData, setPoseData] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [cameraHealth, setCameraHealth] = useState<CameraHealthStatus | null>(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const facingModeRef = useRef('user');
  const detectTimerRef = useRef(0);
  const resizeObserverRef = useRef(null);
  const agencyColorRef = useRef(agencyColor);
  const fitModeRef = useRef(fitMode);
  const latestPoseRef = useRef(null);
  const lastStateUpdateAtRef = useRef(0);
  const isDetectingRef = useRef(false);
  const detectTimestampRef = useRef(0);

  useEffect(() => {
    agencyColorRef.current = agencyColor;
  }, [agencyColor]);

  useEffect(() => {
    fitModeRef.current = fitMode;
  }, [fitMode]);

  const bindCanvasResizeObserver = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeObserverRef.current?.disconnect();
    syncCanvasToDisplayRect(canvas);

    const stackEl = canvas.parentElement;

    const redrawOverlay = () => {
      syncCanvasToDisplayRect(canvas);
      const cached = latestPoseRef.current;
      if (cached?.joints) {
        drawSkeletonOnCanvas(
          canvas,
          videoRef.current,
          cached.joints,
          cached.jointAccuracies,
          fitModeRef.current,
        );
      }
    };

    resizeObserverRef.current = new ResizeObserver(redrawOverlay);
    resizeObserverRef.current.observe(stackEl || canvas);
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
            drawSkeletonOnCanvas(canvas, video, joints, jointAccuracies, fitModeRef.current);

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
    setCameraHealth(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildTVVideoConstraints(settings, facingModeRef.current),
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error('video element not mounted — CameraPreviewStack required');
      }

      if (import.meta.env?.DEV) {
        const stack = video.parentElement;
        const overlay = canvasRef.current;
        if (!stack?.querySelector('video') || !overlay) {
          console.warn(
            '[useMediaPipeTV] Camera layer stack invalid — video + overlay canvas required',
          );
        }
      }

      video.srcObject = stream;
      applyInlineVideoAttributes(video);
      await playVideoWhenReady(video);

      const health = await verifyCameraPipeline(video);
      setCameraHealth(health);

      if (health.error) {
        console.warn('[useMediaPipeTV] camera pipeline:', health.error);
      }

      const visionModule = await import('@mediapipe/tasks-vision');
      const { PoseLandmarker, FilesetResolver } = visionModule;

      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
      } catch {
        vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);
      }

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
      setCameraHealth({
        getUserMediaOk: false,
        srcObjectSet: false,
        videoPlaying: false,
        videoWidth: 0,
        videoHeight: 0,
        error: err?.message || String(err),
      });
      setIsTracking(false);
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
    setCameraHealth(null);

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
    cameraHealth,
    startTracking,
    stopTracking,
    switchCamera,
    videoRef,
    canvasRef,
    getStream,
    fitMode,
  };
}

export default useMediaPipeTV;
