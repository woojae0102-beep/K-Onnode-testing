// @ts-nocheck
/**
 * Member Identification Engine — trackId ↔ memberId 매핑 검증·강화.
 */
import type { SkeletonFrameData } from '../../types/groupPractice';
import type { MemberTrackMeta } from '../../types/danceDatabase';
import { normalizeTrackMemberMap } from '../../utils/skeletonDataUtils';

export interface MemberIdentificationResult {
  trackToMember: Record<number, string>;
  memberToTrack: Record<string, number>;
  memberTracks: MemberTrackMeta[];
  identifiedCount: number;
  coverageByMember: Record<string, number>;
  ambiguousTracks: number[];
}

export function identifyMembersFromTracks(
  frames: SkeletonFrameData[],
  trackToMember: Map<number, string> | Record<string | number, string>,
  allMemberIds: string[],
  userMemberId: string,
): MemberIdentificationResult {
  const map = normalizeTrackMemberMap(trackToMember);
  const aiIds = allMemberIds.filter((id) => id && id !== userMemberId);

  const appearanceCount = new Map<string, number>();
  const trackConfidence = new Map<number, { sum: number; count: number }>();
  const trackPositions = new Map<number, { x: number; y: number; count: number }>();

  frames.forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const tid = Number(member.trackId ?? member.personIndex ?? -1);
      const mid = member.estimatedMemberId || map.get(tid);
      if (!mid || mid === userMemberId) return;

      appearanceCount.set(mid, (appearanceCount.get(mid) ?? 0) + 1);

      const conf = member.confidence ?? 0.5;
      const cur = trackConfidence.get(tid) || { sum: 0, count: 0 };
      trackConfidence.set(tid, { sum: cur.sum + conf, count: cur.count + 1 });

      const nose = member.joints?.nose;
      if (nose && tid >= 0) {
        const pos = trackPositions.get(tid) || { x: 0, y: 0, count: 0 };
        trackPositions.set(tid, {
          x: pos.x + nose.x,
          y: pos.y + nose.y,
          count: pos.count + 1,
        });
      }
    });
  });

  const trackToMemberOut: Record<number, string> = {};
  const memberToTrackOut: Record<string, number> = {};
  const ambiguousTracks: number[] = [];

  map.forEach((memberId, trackId) => {
    if (memberId === userMemberId) return;
    trackToMemberOut[trackId] = memberId;
    if (memberToTrackOut[memberId] != null && memberToTrackOut[memberId] !== trackId) {
      ambiguousTracks.push(trackId);
    }
    memberToTrackOut[memberId] = trackId;
  });

  const memberTracks: MemberTrackMeta[] = [...trackPositions.entries()].map(([trackId, pos]) => {
    const stats = trackConfidence.get(trackId);
    return {
      trackId,
      memberId: trackToMemberOut[trackId] ?? map.get(trackId) ?? null,
      initialPosition: { x: pos.x / pos.count, y: pos.y / pos.count },
      avgConfidence: stats ? stats.sum / stats.count : 0,
    };
  });

  const totalFrames = Math.max(1, frames.length);
  const coverageByMember: Record<string, number> = {};
  aiIds.forEach((id) => {
    coverageByMember[id] = (appearanceCount.get(id) ?? 0) / totalFrames;
  });

  return {
    trackToMember: trackToMemberOut,
    memberToTrack: memberToTrackOut,
    memberTracks,
    identifiedCount: Object.keys(memberToTrackOut).length,
    coverageByMember,
    ambiguousTracks,
  };
}

export default identifyMembersFromTracks;
