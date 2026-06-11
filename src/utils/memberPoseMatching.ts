// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

function dist2(a, b) {
  if (!a || !b) return Infinity;
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}

function noseOf(member) {
  return member?.joints?.nose;
}

/** 첫 프레임: 무대 X 위치와 그룹 defaultX로 멤버 ID 할당 */
export function assignMembersSpatial(members, groupId) {
  const group = GROUP_DATA[groupId];
  if (!group || !members?.length) return members;

  const sortedSlots = group.members.slice().sort((a, b) => a.defaultX - b.defaultX);
  const sortedPoses = members.slice().sort((a, b) => (noseOf(a)?.x || 0) - (noseOf(b)?.x || 0));

  return sortedPoses.map((pose, i) => ({
    ...pose,
    estimatedMemberId: sortedSlots[i]?.id || sortedSlots[sortedSlots.length - 1]?.id || null,
  }));
}

/** 이전 프레임 추적 ID와 거리 기반 매칭 (단순 greedy) */
export function assignMembersTracked(currentMembers, previousMembers, groupId) {
  const group = GROUP_DATA[groupId];
  if (!group || !currentMembers?.length) return currentMembers;
  if (!previousMembers?.length) return assignMembersSpatial(currentMembers, groupId);

  const used = new Set();
  const prevById = Object.fromEntries(
    previousMembers.filter((m) => m.estimatedMemberId).map((m) => [m.estimatedMemberId, m]),
  );

  return currentMembers.map((pose) => {
    let bestId = null;
    let bestDist = Infinity;

    group.members.forEach((member) => {
      if (used.has(member.id)) return;
      const prev = prevById[member.id];
      const ref = prev ? noseOf(prev) : { x: member.defaultX, y: member.defaultY };
      const d = dist2(noseOf(pose), ref);
      if (d < bestDist) {
        bestDist = d;
        bestId = member.id;
      }
    });

    if (bestId) used.add(bestId);
    return { ...pose, estimatedMemberId: bestId };
  });
}

/** 1인 안무 영상: 선택 멤버에 실제 포즈, 나머지는 포메이션 오프셋 적용 */
export function expandSingleDancerToGroup(members, groupId, focusMemberId) {
  const group = GROUP_DATA[groupId];
  if (!group || members.length !== 1) return members;

  const source = members[0];
  const focus = group.members.find((m) => m.id === focusMemberId) || group.members[0];
  const srcNose = noseOf(source);
  if (!srcNose) return assignMembersSpatial(members, groupId);

  return group.members.map((member) => {
    if (member.id === focusMemberId) {
      return { ...source, estimatedMemberId: member.id };
    }
    const dx = member.defaultX - focus.defaultX;
    const dy = member.defaultY - focus.defaultY;
    const joints = {};
    Object.entries(source.joints || {}).forEach(([name, joint]) => {
      joints[name] = {
        ...joint,
        x: (joint.x || 0) + dx,
        y: (joint.y || 0) + dy,
      };
    });
    return {
      personIndex: source.personIndex,
      estimatedMemberId: member.id,
      joints,
    };
  });
}

export function postProcessFrame(frame, groupId, previousFrame, focusMemberId, detectedCount) {
  let members = frame.members || [];
  if (detectedCount <= 1 && focusMemberId) {
    members = expandSingleDancerToGroup(members, groupId, focusMemberId);
  } else if (previousFrame?.members?.length) {
    members = assignMembersTracked(members, previousFrame.members, groupId);
  } else {
    members = assignMembersSpatial(members, groupId);
  }
  return { ...frame, members };
}
