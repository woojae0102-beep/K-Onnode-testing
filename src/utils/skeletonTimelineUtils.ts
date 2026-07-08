// @ts-nocheck
import type { SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';
import { interpolateJointsHybrid } from './quaternionInterpolation';

/** memberId / trackId 기준 Linear + Quaternion 보간 (personIdx 사용 금지) */
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

    const joints = interpolateJointsHybrid(
      prevMember.joints || {},
      nextMember.joints || {},
      ratio,
    );

    members.push({
      ...nextMember,
      trackId: nextMember.trackId ?? prevMember.trackId,
      personIndex: nextMember.trackId ?? prevMember.trackId,
      isEstimated: prevMember.isEstimated || nextMember.isEstimated,
      joints,
    });
  });

  prev.members.forEach((prevMember) => {
    if (members.some((m) => m.estimatedMemberId === prevMember.estimatedMemberId)) return;
    members.push({
      ...prevMember,
      isEstimated: true,
    });
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

/**
 * Binary Search — timestamp 배열에서 timeSec 구간 시작 인덱스.
 * 마지막 timestamp 초과 시 -1 (freeze 금지).
 */
export function findFrameIndexByTimestamp(
  frames: SkeletonFrameData[] | null | undefined,
  timeSec: number,
): number {
  if (!frames?.length) return -1;

  const t = Number(timeSec);
  if (!Number.isFinite(t)) return -1;

  const first = frames[0];
  const lastIdx = frames.length - 1;
  const last = frames[lastIdx];

  if (t < first.timestamp) return 0;
  if (t > last.timestamp) return -1;
  if (t === last.timestamp) return lastIdx;

  let lo = 0;
  let hi = lastIdx;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (frames[mid].timestamp <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Practice 프레임 — Binary Search + 보간. 마지막 skeleton 이후 null (freeze 금지).
 */
export function resolvePracticeFrameAtTime(
  frames: SkeletonFrameData[] | null | undefined,
  timeSec: number,
): SkeletonFrameData | null {
  if (!frames?.length) return null;

  const t = Math.max(0, Number(timeSec));
  if (!Number.isFinite(t)) return null;

  const first = frames[0];
  const last = frames[frames.length - 1];

  if (t < first.timestamp) return null;
  if (t > last.timestamp) return null;

  if (t <= first.timestamp) {
    return { ...first, timestamp: t, timestampMs: Math.round(t * 1000) };
  }

  const lo = findFrameIndexByTimestamp(frames, t);
  if (lo < 0) return null;

  const prev = frames[lo];
  const next = frames[lo + 1] ?? prev;

  if (prev === next || next.timestamp <= prev.timestamp) {
    return { ...prev, timestamp: t, timestampMs: Math.round(t * 1000) };
  }

  const delta = next.timestamp - prev.timestamp;
  const ratio = Math.min(1, Math.max(0, (t - prev.timestamp) / delta));
  return interpolateSkeletonFrame(prev, next, ratio);
}

/** findFrameAtTime — resolvePracticeFrameAtTime 별칭 */
export function findFrameAtTime(frames: SkeletonFrameData[], time: number): SkeletonFrameData | null {
  return resolvePracticeFrameAtTime(frames, time);
}

/** findFrameAtTime과 동일 시점의 프레임 인덱스 — 마지막 초과 시 -1 */
export function findFrameIndexAtTime(frames: SkeletonFrameData[], time: number): number {
  return findFrameIndexByTimestamp(frames, time);
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
