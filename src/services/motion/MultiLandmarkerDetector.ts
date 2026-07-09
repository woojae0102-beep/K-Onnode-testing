// @ts-nocheck
/**
 * Pose + Hand + Face Landmarker 동시 추출 — K-POP 안무용 Holistic Motion Detection.
 * RVFC 연속 재생 분석은 VIDEO 모드 + detectForVideo()를 사용한다.
 */
import {
  CHOREO_FACE_MODEL_URL,
  CHOREO_HAND_MODEL_URL,
  CHOREO_POSE_MODEL,
  CHOREO_POSE_CONFIDENCE,
  CHOREO_POSE_MODEL_URL,
  normalizeChoreoPoseModel,
  resolveNumFaces,
  resolveNumHands,
  resolveNumPoses,
  type ChoreoPoseModel,
} from '../../config/choreoExtractConfig';
import { MEDIAPIPE_WASM_BASE, MEDIAPIPE_WASM_CDN } from '../../config/groupChoreoConstants';

export interface DetectedHand {
  landmarks: unknown[];
  worldLandmarks?: unknown[];
  handedness: 'Left' | 'Right';
  score: number;
}

export interface DetectedFace {
  landmarks: unknown[];
  score: number;
}

export interface MultiLandmarkerDetectResult {
  landmarks?: unknown[][];
  worldLandmarks?: unknown[][];
  hands: DetectedHand[];
  faces: DetectedFace[];
}

export interface MultiLandmarkerDetector {
  detect: (source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap) => MultiLandmarkerDetectResult;
  detectForVideo?: (
    source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
    timestampMs: number,
  ) => MultiLandmarkerDetectResult;
  delegate?: 'GPU' | 'CPU';
  runningMode?: 'IMAGE' | 'VIDEO';
  modelVariant?: ChoreoPoseModel;
  close?: () => void;
}

async function resolveVisionWasm(FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> }) {
  try {
    return await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
  } catch (localErr) {
    console.warn('[MultiLandmarker] 로컬 WASM 실패, CDN 폴백', localErr);
    return FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN);
  }
}

async function createLandmarker(
  vision: unknown,
  factory: (vision: unknown, delegate: 'GPU' | 'CPU') => Promise<{ detect: (src: unknown) => unknown; close?: () => void }>,
  label: string,
) {
  try {
    return { instance: await factory(vision, 'GPU'), delegate: 'GPU' as const };
  } catch (gpuErr) {
    console.warn(`[MultiLandmarker] ${label} GPU 실패, CPU 폴백`, gpuErr);
    return { instance: await factory(vision, 'CPU'), delegate: 'CPU' as const };
  }
}

export async function createMultiLandmarkerDetector(
  groupMemberCount: number,
  onStatus?: (msg: string) => void,
  { lenient = false, runningMode = 'VIDEO', modelVariant = CHOREO_POSE_MODEL } = {},
): Promise<MultiLandmarkerDetector> {
  onStatus?.('Holistic AI 모듈 로드 중 (Pose+Hand+Face)...');
  const visionModule = await import('@mediapipe/tasks-vision');
  const { PoseLandmarker, HandLandmarker, FaceLandmarker, FilesetResolver } = visionModule;

  onStatus?.('Holistic AI 엔진 초기화 중...');
  const vision = await resolveVisionWasm(FilesetResolver);

  const confidence = lenient ? CHOREO_POSE_CONFIDENCE.lenient : CHOREO_POSE_CONFIDENCE.normal;
  const resolvedModel = normalizeChoreoPoseModel(modelVariant);
  const numPoses = Math.max(resolveNumPoses(groupMemberCount), (Number(groupMemberCount) || 5) + 2);
  const numHands = resolveNumHands(groupMemberCount);
  const numFaces = resolveNumFaces(groupMemberCount);

  const buildPose = async (delegate: 'GPU' | 'CPU') => {
    onStatus?.(delegate === 'GPU' ? 'Pose 모델 로드 (GPU)...' : 'Pose 모델 로드 (CPU)...');
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: CHOREO_POSE_MODEL_URL[resolvedModel],
        delegate,
      },
      runningMode,
      numPoses,
      minPoseDetectionConfidence: confidence.minPoseDetectionConfidence,
      minPosePresenceConfidence: confidence.minPosePresenceConfidence,
      minTrackingConfidence: confidence.minTrackingConfidence,
    });
  };

  const buildHand = async (delegate: 'GPU' | 'CPU') => {
    onStatus?.(delegate === 'GPU' ? 'Hand 모델 로드 (GPU)...' : 'Hand 모델 로드 (CPU)...');
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: CHOREO_HAND_MODEL_URL,
        delegate,
      },
      runningMode,
      numHands,
      minHandDetectionConfidence: confidence.minPoseDetectionConfidence,
      minHandPresenceConfidence: confidence.minPosePresenceConfidence,
      minTrackingConfidence: confidence.minTrackingConfidence,
    });
  };

  const buildFace = async (delegate: 'GPU' | 'CPU') => {
    onStatus?.(delegate === 'GPU' ? 'Face 모델 로드 (GPU)...' : 'Face 모델 로드 (CPU)...');
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: CHOREO_FACE_MODEL_URL,
        delegate,
      },
      runningMode,
      numFaces,
      minFaceDetectionConfidence: confidence.minPoseDetectionConfidence,
      minFacePresenceConfidence: confidence.minPosePresenceConfidence,
      minTrackingConfidence: confidence.minTrackingConfidence,
    });
  };

  const [poseResult, handResult, faceResult] = await Promise.all([
    createLandmarker(vision, buildPose, 'Pose'),
    createLandmarker(vision, buildHand, 'Hand'),
    createLandmarker(vision, buildFace, 'Face'),
  ]);
  const pose = poseResult.instance;
  const hand = handResult.instance;
  const face = faceResult.instance;
  const delegate = poseResult.delegate === 'GPU' || handResult.delegate === 'GPU' || faceResult.delegate === 'GPU'
    ? 'GPU'
    : 'CPU';

  console.info('[MultiLandmarker] MediaPipe delegate', {
    delegate,
    poseDelegate: poseResult.delegate,
    handDelegate: handResult.delegate,
    faceDelegate: faceResult.delegate,
    runningMode,
    modelVariant: resolvedModel,
  });
  onStatus?.(`Holistic Motion Detection 준비 완료 (${delegate}, ${resolvedModel}, ${runningMode})`);

  const normalizeResult = (poseRaw, handRaw, faceRaw): MultiLandmarkerDetectResult => {
    const hands: DetectedHand[] = (handRaw.landmarks || []).map((lm, i) => ({
      landmarks: lm,
      worldLandmarks: handRaw.worldLandmarks?.[i],
      handedness: handRaw.handedness?.[i]?.[0]?.categoryName === 'Right' ? 'Right' : 'Left',
      score: Number(handRaw.handedness?.[i]?.[0]?.score ?? 0.5),
    }));

    const faces: DetectedFace[] = (faceRaw.faceLandmarks || []).map((lm) => ({
      landmarks: lm,
      score: 0.8,
    }));

    return {
      landmarks: poseRaw.landmarks,
      worldLandmarks: poseRaw.worldLandmarks,
      hands,
      faces,
    };
  };

  return {
    delegate,
    runningMode,
    modelVariant: resolvedModel,
    detect(source) {
      const poseResult = pose.detect(source) as {
        landmarks?: unknown[][];
        worldLandmarks?: unknown[][];
      };
      const handResult = hand.detect(source) as {
        landmarks?: unknown[][];
        worldLandmarks?: unknown[][];
        handedness?: Array<Array<{ categoryName?: string; score?: number }>>;
      };
      const faceResult = face.detect(source) as {
        faceLandmarks?: unknown[][];
      };

      return normalizeResult(poseResult, handResult, faceResult);
    },
    detectForVideo(source, timestampMs) {
      const poseResult = (pose.detectForVideo || pose.detect).call(pose, source, timestampMs) as {
        landmarks?: unknown[][];
        worldLandmarks?: unknown[][];
      };
      const handResult = (hand.detectForVideo || hand.detect).call(hand, source, timestampMs) as {
        landmarks?: unknown[][];
        worldLandmarks?: unknown[][];
        handedness?: Array<Array<{ categoryName?: string; score?: number }>>;
      };
      const faceResult = (face.detectForVideo || face.detect).call(face, source, timestampMs) as {
        faceLandmarks?: unknown[][];
      };

      return normalizeResult(poseResult, handResult, faceResult);
    },
    close() {
      pose.close?.();
      hand.close?.();
      face.close?.();
    },
  };
}

/** Pose-only 결과와 호환 — landmarks/worldLandmarks만 필요한 레거시 경로 */
export function detectPoseOnly(
  detector: MultiLandmarkerDetector,
  source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap,
) {
  const r = detector.detect(source);
  return {
    landmarks: r.landmarks,
    worldLandmarks: r.worldLandmarks,
  };
}
