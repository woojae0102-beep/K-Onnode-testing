// @ts-nocheck
/** 그룹 모드 안무 추출 성능/품질 설정 */

/** 분석할 최대 길이(초). 대부분의 안무 연습은 3분 이내로 충분 */
export const CHOREO_MAX_DURATION_SEC = 180;

/** 초당 샘플 프레임. 10fps면 연습용 스켈레톤에 충분 */
export const CHOREO_SAMPLE_FPS = 10;

/** 재분석 시 더 촘촘한 샘플링 (순간 등장 멤버 포착) */
export const CHOREO_RETRY_SAMPLE_FPS = 15;

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

/** 트래커: 가려짐 유지 시간(초) — 10fps 기준 약 30프레임 */
export const CHOREO_MAX_OCCLUSION_SEC = 3;

/** lite: 빠름(권장) / heavy: 정밀하지만 2~3배 느림 */
export const CHOREO_POSE_MODEL = 'lite' as const;

export const CHOREO_POSE_MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};

/** 그룹 정원 + 5 여유 (최소 10). 잘못된 입력(NaN/0)은 5명 그룹으로 폴백 */
export function resolveNumPoses(groupMemberCount: number): number {
  const count = Math.max(1, Number(groupMemberCount) || 5);
  const target = count + 5;
  return Math.min(Math.max(target, 10), CHOREO_MAX_POSES_CAP);
}

export function estimateExtractSeconds(durationSec: number) {
  const d = Math.min(durationSec || 180, CHOREO_MAX_DURATION_SEC);
  const frames = Math.ceil(d * CHOREO_SAMPLE_FPS) + CHOREO_MEMBER_PROBE_SAMPLES;
  return Math.round(frames * 0.06 + 8);
}
