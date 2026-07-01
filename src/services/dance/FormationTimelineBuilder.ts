// @ts-nocheck
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { DetectionFrame } from '../MultiPersonTracker';
import type { FormationKeyframe, FormationTimeline, FormationSlot } from '../../types/danceDatabase';
import { normalizeTrackMemberMap, resolveMemberForTrack } from '../../utils/skeletonDataUtils';

function centerOf(joints: Record<string, { x: number; y: number; z?: number }>) {
  const nose = joints.nose;
  if (nose) return { x: nose.x, y: nose.y, z: nose.z ?? 0 };
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  if (ls && rs) {
    return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2, z: ((ls.z ?? 0) + (rs.z ?? 0)) / 2 };
  }
  return { x: 0.5, y: 0.5, z: 0 };
}

export function buildFormationTimeline({
  groupId,
  songId,
  userMemberId,
  frames,
  trackToMember,
}: {
  groupId: string;
  songId: string;
  userMemberId: string;
  frames: DetectionFrame[];
  trackToMember: Map<number, string>;
}): FormationTimeline {
  const map = normalizeTrackMemberMap(trackToMember);
  const group = GROUP_DATA[groupId];
  const userMember = group?.members.find((m) => m.id === userMemberId);

  const keyframes: FormationKeyframe[] = frames.map((frame) => {
    const slots: FormationSlot[] = [];
    const assignedMemberIds = new Set<string>();

    frame.detectedPeople.forEach((person) => {
      const memberId = resolveMemberForTrack(map, person.trackId, userMemberId);
      if (!memberId) return;
      assignedMemberIds.add(memberId);
      const c = centerOf(person.joints);
      slots.push({
        memberId,
        trackId: person.trackId,
        x: c.x,
        y: c.y,
        z: c.z,
        isUserSlot: false,
        isEmpty: false,
      });
    });

    if (userMember) {
      slots.push({
        memberId: userMemberId,
        trackId: null,
        x: userMember.defaultX,
        y: userMember.defaultY,
        z: 0,
        isUserSlot: true,
        isEmpty: true,
      });
    }

    return { timestamp: frame.timestamp, slots };
  });

  return {
    groupId,
    songId,
    userMemberId,
    defaultFormation: group?.defaultFormation || 'diamond',
    keyframes,
  };
}

export default buildFormationTimeline;
