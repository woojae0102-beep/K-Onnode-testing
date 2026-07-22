// @ts-nocheck
/**
 * Formation timeline interpolation (skeleton 무관).
 */
import type { GroupFormationKeyframe } from '../types/GroupMotionAsset';

export function resolveFormationAtTime(
  timeline: GroupFormationKeyframe[] | null | undefined,
  timeSec: number,
): { x: number; y: number; z: number } | null {
  if (!timeline?.length) return null;
  if (timeline.length === 1) return timeline[0].position;

  const t = Math.max(0, timeSec);
  let prev = timeline[0];
  for (let i = 1; i < timeline.length; i += 1) {
    const next = timeline[i];
    if (t <= next.timeSec) {
      const span = next.timeSec - prev.timeSec;
      const ratio = span > 0 ? (t - prev.timeSec) / span : 0;
      return {
        x: prev.position.x + (next.position.x - prev.position.x) * ratio,
        y: prev.position.y + (next.position.y - prev.position.y) * ratio,
        z: (prev.position.z ?? 0) + ((next.position.z ?? 0) - (prev.position.z ?? 0)) * ratio,
      };
    }
    prev = next;
  }
  return timeline[timeline.length - 1].position;
}

export default resolveFormationAtTime;
