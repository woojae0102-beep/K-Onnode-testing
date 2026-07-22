// @ts-nocheck
import { GROUP_DATA } from '../../data/groupPracticeData';
import type {
  GroupMotionContent,
  GroupPracticeRuntimeState,
  GroupUserSlot,
} from '../../types/groupMotionContent';
import { rebuildFormationHoleForMember } from './GroupMotionContentAdapter';
import { getVisibleGroupMembers } from '../../modes/group/runtime/getVisibleGroupMembers';

/**
 * 멤버 선택 런타임 — selectedMember motion 보존, AI만 필터링.
 */
export function buildGroupPracticeRuntime(
  content: GroupMotionContent,
  selectedMemberId: string,
): GroupPracticeRuntimeState {
  const group = GROUP_DATA[content.groupId];
  if (!group) {
    throw new Error(`Unknown group: ${content.groupId}`);
  }

  const { userMember, visibleAiMembers } = getVisibleGroupMembers({
    members: content.members.map((m) => ({ memberId: m.memberId, memberName: m.memberName, _motion: m })),
    selectedMemberId,
    mode: 'group-practice-runtime',
  });

  if (!userMember) {
    throw new Error(
      `Member ${selectedMemberId} not found in pre-built content (${content.id})`,
    );
  }

  const memberMotion = userMember._motion;

  const userSlot: GroupUserSlot = {
    memberId: selectedMemberId,
    memberName: memberMotion.memberName,
    referenceMotion: memberMotion,
    formationAnchor: memberMotion.formationAnchor
      || memberMotion.formationTimeline?.[0]?.position,
  };

  const aiAvatarMembers = visibleAiMembers.map((v) => v._motion);

  return {
    selectedMemberId,
    userSlot,
    aiAvatarMembers,
  };
}

export function buildPositionMapFromRuntime(
  runtime: GroupPracticeRuntimeState,
  groupId: string,
) {
  const group = GROUP_DATA[groupId];
  const aiMemberIds = runtime.aiAvatarMembers.map((m) => m.memberId);
  const memberToTrack: Record<string, number> = {};
  const trackToMember: Record<number, string> = {};
  let trackId = 1;
  [runtime.selectedMemberId, ...aiMemberIds].forEach((id) => {
    memberToTrack[id] = trackId;
    trackToMember[trackId] = id;
    trackId += 1;
  });
  return {
    userMemberId: runtime.selectedMemberId,
    aiMemberIds,
    trackToMember,
    memberToTrack,
  };
}

export function applyRuntimeToContent(
  content: GroupMotionContent,
  runtime: GroupPracticeRuntimeState,
): GroupMotionContent {
  const formationHole = rebuildFormationHoleForMember(content, runtime.selectedMemberId);
  return {
    ...content,
    formation: content.formation
      ? { ...content.formation, userMemberId: runtime.selectedMemberId }
      : content.formation,
    formationHole: formationHole ?? content.formationHole,
  };
}
