// @ts-nocheck
/** 영상 분석 실패 시 사용자 안내 */
export const VIDEO_REQUIREMENTS_MESSAGE = `영상 분석이 어렵습니다. 아래 조건의 영상을 사용해주세요:

✓ 해상도: 720p (1280×720) 이상
✓ 조명: 밝은 실내 또는 외부 (어두운 영상은 감지율 낮음)
✓ 멤버 모두 화면에 보여야 함 (일부 잘리면 안 됨)
✓ 카메라 고정 또는 최소 움직임
✓ 영상 길이: 30초 ~ 3분 권장
✗ 역광, 무대 조명만 있는 영상은 어려움
✗ 카메라가 심하게 흔들리는 영상`;

/** MediaPipe WASM — 로컬 우선, 없으면 CDN */
export const MEDIAPIPE_WASM_BASE = '/mediapipe/wasm';
export const MEDIAPIPE_WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
