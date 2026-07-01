// @ts-nocheck
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';

function interpolateJoint(a: JointPoint, b: JointPoint, ratio: number): JointPoint {
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
    z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * ratio,
    visibility: a.visibility ?? b.visibility,
  };
}

/** memberId 기준으로 두 프레임 사이 보간 (인덱스 순서 의존 제거) */
export function interpolateSkeletonFrame(
  prev: SkeletonFrameData,
  next: SkeletonFrameData,
  ratio: number,
): SkeletonFrameData {
  const prevByMember = new Map(prev.members.map((m) => [m.estimatedMemberId, m]));
  const members: SkeletonMemberData[] = [];

  next.members.forEach((nextMember) => {
    const prevMember = prevByMember.get(nextMember.estimatedMemberId);
    if (!prevMember) {
      members.push(nextMember);
      return;
    }

    const joints: Record<string, JointPoint> = {};
    const jointNames = new Set([
      ...Object.keys(prevMember.joints || {}),
      ...Object.keys(nextMember.joints || {}),
    ]);

    jointNames.forEach((name) => {
      const ja = prevMember.joints[name];
      const jb = nextMember.joints[name];
      if (ja && jb) joints[name] = interpolateJoint(ja, jb, ratio);
      else if (jb) joints[name] = jb;
      else if (ja) joints[name] = ja;
    });

    members.push({
      ...nextMember,
      isEstimated: prevMember.isEstimated || nextMember.isEstimated,
      joints,
    });
  });

  prev.members.forEach((prevMember) => {
    if (members.some((m) => m.estimatedMemberId === prevMember.estimatedMemberId)) return;
    members.push(prevMember);
  });

  return {
    timestamp: prev.timestamp + (next.timestamp - prev.timestamp) * ratio,
    timestampMs: Math.round(
      (prev.timestampMs ?? prev.timestamp * 1000) +
        ((next.timestampMs ?? next.timestamp * 1000) - (prev.timestampMs ?? prev.timestamp * 1000)) * ratio,
    ),
    videoWidth: next.videoWidth ?? prev.videoWidth,
    videoHeight: next.videoHeight ?? prev.videoHeight,
    members,
  };
}

/** 이진 탐색 + memberId 보간 — 10fps 추출 데이터를 부드럽게 재생 */
export function findFrameAtTime(frames: SkeletonFrameData[], time: number): SkeletonFrameData | null {
  if (!frames?.length) return null;
  if (time <= frames[0].timestamp) return frames[0];
  const last = frames[frames.length - 1];
  if (time >= last.timestamp) return last;

  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (frames[mid].timestamp <= time) lo = mid;
    else hi = mid;
  }

  const prev = frames[lo];
  const next = frames[hi];
  const delta = next.timestamp - prev.timestamp;
  if (delta <= 1e-6) return prev;

  const ratio = (time - prev.timestamp) / delta;
  return interpolateSkeletonFrame(prev, next, ratio);
}

/** 프레임마다 모든 AI 멤버가 항상 존재하도록 forward-fill (트랙 일시 소실 대비) */
export function fillMemberGapsInSkeletonFrames(
  frames: SkeletonFrameData[],
  memberIds: string[],
): SkeletonFrameData[] {
  if (!frames.length || !memberIds.length) return frames;

  const lastKnown = new Map<string, SkeletonMemberData>();

  return frames.map((frame) => {
    const byMember = new Map(frame.members.map((m) => [m.estimatedMemberId, m]));
    const members: SkeletonMemberData[] = [];

    memberIds.forEach((memberId) => {
      const current = byMember.get(memberId);
      if (current) {
        lastKnown.set(memberId, current);
        members.push(current);
        return;
      }
      const cached = lastKnown.get(memberId);
      if (cached) {
        members.push({
          ...cached,
          isEstimated: true,
          joints: cached.joints,
        });
      }
    });

    return { ...frame, members };
  });
}

export default findFrameAtTime;
