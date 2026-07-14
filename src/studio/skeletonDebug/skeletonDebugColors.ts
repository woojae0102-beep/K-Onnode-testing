// @ts-nocheck
/** Track ID별 고정 팔레트 — Avatar/Group 데이터와 무관한 디버그 전용 */
export const SKELETON_DEBUG_TRACK_COLORS = [
  '#FF6B9D',
  '#FFD700',
  '#A78BFA',
  '#6EE7B7',
  '#FF6348',
  '#93C5FD',
  '#F87171',
  '#34D399',
  '#FCD34D',
  '#C084FC',
  '#38BDF8',
  '#FB923C',
];

export function getSkeletonDebugTrackColor(trackId: number): string {
  const idx = Math.abs(Math.floor(trackId)) % SKELETON_DEBUG_TRACK_COLORS.length;
  return SKELETON_DEBUG_TRACK_COLORS[idx];
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
