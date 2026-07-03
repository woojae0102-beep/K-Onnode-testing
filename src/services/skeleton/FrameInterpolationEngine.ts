// @ts-nocheck
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { computeBoundingBoxFromJoints } from '../../utils/skeletonDataUtils';
import { interpolateJointsHybrid } from '../../utils/quaternionInterpolation';

function interpolateMember(
  prev: SkeletonMemberData,
  next: SkeletonMemberData,
  ratio: number,
): SkeletonMemberData {
  const joints = interpolateJointsHybrid(prev.joints || {}, next.joints || {}, ratio);

  const worldCoordinates: Record<string, JointPoint> = {};
  const worldNames = new Set([
    ...Object.keys(prev.worldCoordinates || {}),
    ...Object.keys(next.worldCoordinates || {}),
  ]);
  worldNames.forEach((name) => {
    const wa = prev.worldCoordinates?.[name];
    const wb = next.worldCoordinates?.[name];
    if (wa && wb) {
      worldCoordinates[name] = interpolateJointsHybrid(
        { [name]: wa as JointPoint },
        { [name]: wb as JointPoint },
        ratio,
      )[name];
    } else if (wb) {
      worldCoordinates[name] = { ...wb };
    } else if (wa) {
      worldCoordinates[name] = { ...wa };
    }
  });

  const confidence =
    ((prev.confidence ?? 1) * (1 - ratio) + (next.confidence ?? 1) * ratio) * 0.85;

  const trackId = prev.trackId ?? next.trackId;

  return {
    ...prev,
    estimatedMemberId: prev.estimatedMemberId ?? next.estimatedMemberId,
    trackId,
    personIndex: trackId,
    joints,
    worldCoordinates: Object.keys(worldCoordinates).length ? worldCoordinates : prev.worldCoordinates,
    boundingBox: computeBoundingBoxFromJoints(joints) ?? prev.boundingBox,
    confidence,
    isEstimated: true,
  };
}

function memberLookupKey(member: SkeletonMemberData): string {
  return String(member.estimatedMemberId ?? member.trackId ?? '');
}

function findMember(frames: SkeletonFrameData[], index: number, key: string): SkeletonMemberData | null {
  const frame = frames[index];
  if (!frame || !key) return null;
  return (
    frame.members.find((m) => memberLookupKey(m) === key)
    ?? frame.members.find((m) => String(m.trackId) === key)
    ?? null
  );
}

function findNeighborWithMember(
  frames: SkeletonFrameData[],
  fromIndex: number,
  key: string,
  direction: -1 | 1,
): { index: number; member: SkeletonMemberData } | null {
  let i = fromIndex + direction;
  while (i >= 0 && i < frames.length) {
    const member = findMember(frames, i, key);
    if (member && !member.isEstimated) return { index: i, member };
    if (member?.isEstimated) {
      const score = member.confidence ?? 0;
      if (score > 0.4) return { index: i, member };
    }
    i += direction;
  }
  return null;
}

/**
 * 프레임 간 멤버 누락 시 Linear + Quaternion 보간.
 * trackId / estimatedMemberId 기준 — personIdx 사용 금지.
 */
export function interpolateSkeletonFrameGaps(
  frames: SkeletonFrameData[],
  memberIds: string[],
): SkeletonFrameData[] {
  if (!frames.length || !memberIds.length) return frames;

  const result = frames.map((frame) => ({
    ...frame,
    members: frame.members.map((m) => ({
      ...m,
      joints: { ...m.joints },
      worldCoordinates: m.worldCoordinates ? { ...m.worldCoordinates } : undefined,
    })),
  }));

  const trackKeys = new Set<string>();
  result.forEach((frame) => {
    frame.members.forEach((m) => {
      const key = memberLookupKey(m);
      if (key) trackKeys.add(key);
    });
  });
  memberIds.forEach((id) => trackKeys.add(id));

  result.forEach((frame, frameIndex) => {
    const byKey = new Map(frame.members.map((m) => [memberLookupKey(m), m]));
    const additions: SkeletonMemberData[] = [];

    trackKeys.forEach((key) => {
      if (!key || byKey.has(key)) return;

      const prev = findNeighborWithMember(result, frameIndex, key, -1);
      const next = findNeighborWithMember(result, frameIndex, key, 1);

      if (prev && next) {
        const t0 = result[prev.index].timestamp;
        const t1 = result[next.index].timestamp;
        const t = frame.timestamp;
        const ratio = t1 > t0 ? (t - t0) / (t1 - t0) : 0.5;
        additions.push(
          interpolateMember(prev.member, next.member, Math.min(1, Math.max(0, ratio))),
        );
        return;
      }

      if (prev) {
        additions.push(cloneEstimatedMember(prev.member, 'forward'));
        return;
      }

      if (next) {
        additions.push(cloneEstimatedMember(next.member, 'backward'));
      }
    });

    if (additions.length) {
      frame.members = [...frame.members, ...additions];
      frame.memberTracks = frame.members.map((m) => ({
        trackId: Number(m.trackId ?? 0),
        memberId: m.estimatedMemberId,
        confidence: (m.confidence ?? 1) * (m.isEstimated ? 0.7 : 1),
      }));
    }
  });

  if (import.meta.env?.DEV) {
    const filled = result.reduce((sum, f, i) => {
      const before = frames[i]?.members?.length ?? 0;
      return sum + Math.max(0, f.members.length - before);
    }, 0);
    if (filled > 0) {
      console.debug('[FrameInterpolationEngine] interpolated members:', filled);
    }
  }

  return result;
}

function cloneEstimatedMember(
  source: SkeletonMemberData,
  mode: 'forward' | 'backward',
): SkeletonMemberData {
  const trackId = source.trackId;
  return {
    ...source,
    trackId,
    personIndex: trackId,
    joints: { ...source.joints },
    worldCoordinates: source.worldCoordinates ? { ...source.worldCoordinates } : undefined,
    boundingBox: source.boundingBox ? { ...source.boundingBox } : undefined,
    isEstimated: true,
    confidence: (source.confidence ?? 1) * (mode === 'forward' ? 0.75 : 0.65),
  };
}

export default interpolateSkeletonFrameGaps;
