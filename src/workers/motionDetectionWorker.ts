// @ts-nocheck
/**
 * MediaPipe Detection Worker — Pose+Hand+Face detect()를 메인 스레드에서 분리한다.
 * 프레임은 ImageBitmap transferable로 zero-copy 전달한다.
 */
import { startWorkerMemoryReporter } from '../utils/memoryProfiler';
import {
  CHOREO_FACE_MODEL_URL,
  CHOREO_HAND_MODEL_URL,
  CHOREO_POSE_CONFIDENCE,
  CHOREO_POSE_MODEL_URL,
  normalizeChoreoPoseModel,
  resolveNumFaces,
  resolveNumHands,
  resolveNumPoses,
} from '../config/choreoExtractConfig';
import { MEDIAPIPE_WASM_BASE, MEDIAPIPE_WASM_CDN } from '../config/groupChoreoConstants';

let detector: {
  detect: (src: unknown) => unknown;
  detectForVideo?: (src: unknown, ts: number) => unknown;
  close?: () => void;
} | null = null;
let pose: { detect: (s: unknown) => unknown; detectForVideo?: (s: unknown, ts: number) => unknown; close?: () => void } | null = null;
let hand: { detect: (s: unknown) => unknown; detectForVideo?: (s: unknown, ts: number) => unknown; close?: () => void } | null = null;
let face: { detect: (s: unknown) => unknown; detectForVideo?: (s: unknown, ts: number) => unknown; close?: () => void } | null = null;
let runningMode: 'IMAGE' | 'VIDEO' = 'VIDEO';
let delegateUsed: 'GPU' | 'CPU' = 'CPU';

startWorkerMemoryReporter('motionDetection', (msg) => self.postMessage(msg));

function post(type: string, payload: Record<string, unknown> = {}) {
  self.postMessage({ type, ...payload });
}

async function resolveVisionWasm(FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> }) {
  try {
    return await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
  } catch {
    return FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);
  }
}

async function createLandmarker(
  vision: unknown,
  factory: (v: unknown, d: 'GPU' | 'CPU') => Promise<{ detect: (s: unknown) => unknown; close?: () => void }>,
) {
  try {
    return { instance: await factory(vision, 'GPU'), delegate: 'GPU' as const };
  } catch {
    return { instance: await factory(vision, 'CPU'), delegate: 'CPU' as const };
  }
}

function normalizeResult(poseRaw: any, handRaw: any, faceRaw: any) {
  const hands = (handRaw.landmarks || []).map((lm: unknown[], i: number) => ({
    landmarks: lm,
    worldLandmarks: handRaw.worldLandmarks?.[i],
    handedness: handRaw.handedness?.[i]?.[0]?.categoryName === 'Right' ? 'Right' : 'Left',
    score: Number(handRaw.handedness?.[i]?.[0]?.score ?? 0.5),
  }));
  const faces = (faceRaw.faceLandmarks || []).map((lm: unknown[]) => ({
    landmarks: lm,
    score: 0.8,
  }));
  return {
    landmarks: poseRaw.landmarks,
    worldLandmarks: poseRaw.worldLandmarks,
    hands,
    faces,
  };
}

async function initDetector(config: {
  groupMemberCount: number;
  modelVariant?: string;
  runningMode?: 'IMAGE' | 'VIDEO';
  lenient?: boolean;
}) {
  const visionModule = await import('@mediapipe/tasks-vision');
  const { PoseLandmarker, HandLandmarker, FaceLandmarker, FilesetResolver } = visionModule;
  const vision = await resolveVisionWasm(FilesetResolver);
  const confidence = config.lenient ? CHOREO_POSE_CONFIDENCE.lenient : CHOREO_POSE_CONFIDENCE.normal;
  const resolvedModel = normalizeChoreoPoseModel(config.modelVariant);
  runningMode = config.runningMode || 'VIDEO';
  const numPoses = Math.max(resolveNumPoses(config.groupMemberCount), (Number(config.groupMemberCount) || 5) + 2);
  const numHands = resolveNumHands(config.groupMemberCount);
  const numFaces = resolveNumFaces(config.groupMemberCount);

  const buildPose = (d: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: CHOREO_POSE_MODEL_URL[resolvedModel], delegate: d },
      runningMode,
      numPoses,
      minPoseDetectionConfidence: confidence.minPoseDetectionConfidence,
      minPosePresenceConfidence: confidence.minPosePresenceConfidence,
      minTrackingConfidence: confidence.minTrackingConfidence,
    });
  const buildHand = (d: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: CHOREO_HAND_MODEL_URL, delegate: d },
      runningMode,
      numHands,
      minHandDetectionConfidence: confidence.minPoseDetectionConfidence,
      minHandPresenceConfidence: confidence.minPosePresenceConfidence,
      minTrackingConfidence: confidence.minTrackingConfidence,
    });
  const buildFace = (d: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: CHOREO_FACE_MODEL_URL, delegate: d },
      runningMode,
      numFaces,
      minFaceDetectionConfidence: confidence.minPoseDetectionConfidence,
      minFacePresenceConfidence: confidence.minPosePresenceConfidence,
      minTrackingConfidence: confidence.minTrackingConfidence,
    });

  const [poseResult, handResult, faceResult] = await Promise.all([
    createLandmarker(vision, buildPose),
    createLandmarker(vision, buildHand),
    createLandmarker(vision, buildFace),
  ]);
  pose = poseResult.instance;
  hand = handResult.instance;
  face = faceResult.instance;
  delegateUsed = poseResult.delegate === 'GPU' || handResult.delegate === 'GPU' || faceResult.delegate === 'GPU'
    ? 'GPU'
    : 'CPU';

  detector = {
    detect(source) {
      const pr = pose!.detect(source) as any;
      const hr = hand!.detect(source) as any;
      const fr = face!.detect(source) as any;
      return normalizeResult(pr, hr, fr);
    },
    detectForVideo(source, timestampMs) {
      const pd = pose!.detectForVideo || pose!.detect;
      const hd = hand!.detectForVideo || hand!.detect;
      const fd = face!.detectForVideo || face!.detect;
      const pr = pd.call(pose, source, timestampMs) as any;
      const hr = hd.call(hand, source, timestampMs) as any;
      const fr = fd.call(face, source, timestampMs) as any;
      return normalizeResult(pr, hr, fr);
    },
    close() {
      pose?.close?.();
      hand?.close?.();
      face?.close?.();
    },
  };

  return { delegate: delegateUsed, runningMode, modelVariant: resolvedModel };
}

self.onmessage = async (event) => {
  const msg = event.data || {};

  if (msg.type === 'INIT') {
    try {
      const info = await initDetector(msg.config || {});
      post('INIT_DONE', { ...info });
    } catch (err: any) {
      post('INIT_ERROR', { error: err?.message || String(err) });
    }
    return;
  }

  if (msg.type === 'PROBE') {
    try {
      const info = await initDetector(msg.config || {});
      detector?.close?.();
      detector = null;
      pose = null;
      hand = null;
      face = null;
      post('PROBE_OK', { ...info });
    } catch (err: any) {
      post('PROBE_FAIL', { error: err?.message || String(err) });
    }
    return;
  }

  if (msg.type === 'DETECT_FRAME') {
    if (!detector) {
      post('DETECT_ERROR', { requestId: msg.requestId, error: 'Detector not initialized' });
      return;
    }
    const startedAt = performance.now();
    try {
      const { bitmap, timestampMs } = msg;
      let results;
      if (runningMode === 'VIDEO' && typeof detector.detectForVideo === 'function') {
        results = detector.detectForVideo(bitmap, timestampMs ?? 0);
      } else {
        results = detector.detect(bitmap);
      }
      bitmap?.close?.();
      post('DETECT_RESULT', {
        requestId: msg.requestId,
        results,
        detectMs: performance.now() - startedAt,
      });
    } catch (err: any) {
      msg.bitmap?.close?.();
      post('DETECT_ERROR', { requestId: msg.requestId, error: err?.message || String(err) });
    }
    return;
  }

  if (msg.type === 'CLOSE') {
    detector?.close?.();
    detector = null;
    post('CLOSED');
  }
};
