// @ts-nocheck
/** 그룹 모드 안무 추출 성능/품질 설정 */

/** 트래커: 가려짐 유지 시간(초) — 추적 슬롯을 삭제하지 않고 보강 유지 */
export const CHOREO_MAX_OCCLUSION_SEC = 12;

/** Motion Extraction 샘플 FPS — 추출 단계 고정 30fps (timestamp = frameIndex / 30) */
export const CHOREO_MIN_SAMPLE_FPS = 30;
export const CHOREO_MAX_SAMPLE_FPS = 60;
export const CHOREO_DEFAULT_SAMPLE_FPS = 30;
/** @deprecated 추출은 항상 CHOREO_DEFAULT_SAMPLE_FPS(30) 사용 */
export const CHOREO_EXTRACTION_SAMPLE_FPS = CHOREO_DEFAULT_SAMPLE_FPS;

/** @deprecated CHOREO_DEFAULT_SAMPLE_FPS 사용 */
export const CHOREO_SAMPLE_FPS = CHOREO_DEFAULT_SAMPLE_FPS;

/** 재분석도 동일 FPS (lenient 모드만 변경, 프레임 스킵 없음) */
export const CHOREO_RETRY_SAMPLE_FPS = CHOREO_DEFAULT_SAMPLE_FPS;

/** 멤버 수 사전 감지 샘플 수 */
export const CHOREO_MEMBER_PROBE_SAMPLES = 12;

/** 동시 추적 인원 상한 (그룹 정원+5 미만일 때 폴백) */
export const CHOREO_MAX_POSES_CAP = 15;

/** MediaPipe 감지 신뢰도 (IMAGE 모드) */
export const CHOREO_POSE_CONFIDENCE = {
  normal: {
    minPoseDetectionConfidence: 0.3,
    minPosePresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  },
  lenient: {
    minPoseDetectionConfidence: 0.15,
    minPosePresenceConfidence: 0.15,
    minTrackingConfidence: 0.15,
  },
} as const;

/** 트래커: 감지 제외 최소 신뢰도 */
export const CHOREO_MIN_PERSON_CONFIDENCE = 0.15;

/** Joint confidence — visibility·presence ≤ 0.6 → interpolation, ≤ 0.3 → discard */
export const CHOREO_JOINT_CONFIDENCE_INTERPOLATE_MAX = 0.6;
export const CHOREO_JOINT_CONFIDENCE_DISCARD_MAX = 0.3;

/** lite: 빠름(권장) / heavy: 정밀하지만 2~3배 느림 */
export const CHOREO_POSE_MODEL = 'lite' as const;

export const CHOREO_POSE_MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};

/** Hand + Face Landmarker (K-POP 손·얼굴 포인트) */
export const CHOREO_HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const CHOREO_FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** 그룹 안무: 멤버당 2손 + 여유 */
export function resolveNumHands(groupMemberCount: number): number {
  const count = Math.max(1, Number(groupMemberCount) || 5);
  return Math.min(Math.max(count * 2 + 4, 10), 20);
}

/** 그룹 안무: 멤버 수 + 여유 */
export function resolveNumFaces(groupMemberCount: number): number {
  const count = Math.max(1, Number(groupMemberCount) || 5);
  return Math.min(Math.max(count + 3, 8), CHOREO_MAX_POSES_CAP);
}

/** 그룹 정원 + 5 여유 (최소 10). 잘못된 입력(NaN/0)은 5명 그룹으로 폴백 */
export function resolveNumPoses(groupMemberCount: number): number {
  const count = Math.max(1, Number(groupMemberCount) || 5);
  const target = count + 5;
  return Math.min(Math.max(target, 10), CHOREO_MAX_POSES_CAP);
}

export function estimateExtractSeconds(durationSec: number, sampleFps = CHOREO_DEFAULT_SAMPLE_FPS) {
  const d = Number(durationSec);
  if (!Number.isFinite(d) || d <= 0) return 60;
  const frames = Math.ceil(d * sampleFps) + CHOREO_MEMBER_PROBE_SAMPLES;
  return Math.round(frames * 0.06 + 8);
}

/** 영상에서 읽은 native FPS → 추출 샘플 FPS (30~60 clamp, 미확인 시 30) */
export function resolveVideoSampleFps(nativeFps: number | null | undefined): number {
  const raw = Number(nativeFps);
  if (!Number.isFinite(raw) || raw <= 0) return CHOREO_DEFAULT_SAMPLE_FPS;
  return Math.min(CHOREO_MAX_SAMPLE_FPS, Math.max(CHOREO_MIN_SAMPLE_FPS, Math.round(raw)));
}

/**
 * HTMLVideoElement.duration — 영상 전체 길이(초).
 * 30/60/120/180초 상한·폴백 없음. 유효하지 않으면 null.
 */
export function resolveVideoDurationSec(videoDurationSec: number | null | undefined): number | null {
  const raw = Number(videoDurationSec);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}
