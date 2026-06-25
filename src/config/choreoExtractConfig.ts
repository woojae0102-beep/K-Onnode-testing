// @ts-nocheck
/** 그룹 모드 안무 추출 성능/품질 설정 */

/** 분석할 최대 길이(초). 대부분의 안무 연습은 3분 이내로 충분 */
export const CHOREO_MAX_DURATION_SEC = 180;

/** 초당 샘플 프레임. 10fps면 연습용 스켈레톤에 충분하고 15fps 대비 ~33% 단축 */
export const CHOREO_SAMPLE_FPS = 10;

/** 멤버 수 사전 감지 샘플 수 (20→8로 초기 구간 단축) */
export const CHOREO_MEMBER_PROBE_SAMPLES = 8;

/** 동시 추적 인원 상한 */
export const CHOREO_MAX_POSES = 8;

/** lite: 빠름(권장) / heavy: 정밀하지만 2~3배 느림 */
export const CHOREO_POSE_MODEL = 'lite' as const;

export const CHOREO_POSE_MODEL_URL = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  heavy: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
};

export function estimateExtractSeconds(durationSec: number) {
  const d = Math.min(durationSec || 180, CHOREO_MAX_DURATION_SEC);
  const frames = Math.ceil(d * CHOREO_SAMPLE_FPS) + CHOREO_MEMBER_PROBE_SAMPLES;
  // lite + GPU 기준 대략 프레임당 40~80ms
  return Math.round(frames * 0.06 + 8);
}
