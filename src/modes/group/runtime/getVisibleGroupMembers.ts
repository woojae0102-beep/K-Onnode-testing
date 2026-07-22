// @ts-nocheck
/**
 * Group Mode — member visibility (순수 도메인 함수).
 * selectedMemberId = user slot, 나머지 = visible AI members.
 * trackId를 member identity로 사용하지 않는다.
 */

export type GroupMemberIdentity = {
  memberId: string;
  memberName?: string;
};

export type GetVisibleGroupMembersInput<T extends GroupMemberIdentity> = {
  members: T[];
  selectedMemberId: string;
  mode?: string;
};

export type VisibleGroupMembersResult<T extends GroupMemberIdentity> = {
  userMember: T | null;
  visibleAiMembers: T[];
  hiddenMemberId: string | null;
};

export function getVisibleGroupMembers<T extends GroupMemberIdentity>(
  input: GetVisibleGroupMembersInput<T>,
): VisibleGroupMembersResult<T> {
  const { members, selectedMemberId } = input;
  const selected = String(selectedMemberId || '').trim();
  if (!selected) {
    return { userMember: null, visibleAiMembers: [...members], hiddenMemberId: null };
  }

  let userMember: T | null = null;
  const visibleAiMembers: T[] = [];

  for (const member of members) {
    const id = String(member.memberId || '').trim();
    if (!id) continue;
    if (id === selected) {
      userMember = member;
    } else {
      visibleAiMembers.push(member);
    }
  }

  return {
    userMember,
    visibleAiMembers,
    hiddenMemberId: userMember ? selected : null,
  };
}

export default getVisibleGroupMembers;
