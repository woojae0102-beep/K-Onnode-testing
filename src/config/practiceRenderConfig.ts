/** Practice 렌더링 전용 — 추출 FPS(30)와 무관 */
export const PRACTICE_RENDER_FPS = 60;
/** Joint BBox 주변 여백 (auto-fit 전 확장 비율) */
export const PRACTICE_RENDER_PADDING = 0.12;
/** Canvas 중앙 스켈레톤 뷰포트 — 전체의 80% (상하좌우 10% letterbox) */
export const SKELETON_VIEWPORT_RATIO = 0.8;
/** Auto Fit — 머리~발끝 BBox 우선 관절 */
export const FULL_BODY_BBOX_JOINTS = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;

export default PRACTICE_RENDER_FPS;
