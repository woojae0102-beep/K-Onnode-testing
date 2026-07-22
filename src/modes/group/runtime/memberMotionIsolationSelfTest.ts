// @ts-nocheck
import { buildRealMotionAssetFixture } from '../fixtures/realMotionAssetFixture';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

export function runMemberMotionIsolationSelfTest() {
  const fixture = buildRealMotionAssetFixture({ songId: 'how-you-like-that' });
  const cases = [
    { selected: 'jennie', visible: ['lisa', 'rose', 'jisoo'] },
    { selected: 'lisa', visible: ['jennie', 'rose', 'jisoo'] },
    { selected: 'rose', visible: ['jennie', 'lisa', 'jisoo'] },
    { selected: 'jisoo', visible: ['jennie', 'lisa', 'rose'] },
  ];

  const results = cases.map((c) => {
    const { userMember, visibleAiMembers } = getVisibleGroupMembers({
      members: fixture.members.map((m) => ({ memberId: m.memberId, _motion: m })),
      selectedMemberId: c.selected,
      mode: 'self-test',
    });
    const visibleIds = visibleAiMembers.map((v) => v.memberId);
    const motionIds = visibleAiMembers.map((v) => v._motion.motionAssetId);
    const userMotionId = fixture.members.find((m) => m.memberId === c.selected)?.motionAssetId;
    return {
      selected: c.selected,
      pass: userMember?.memberId === c.selected
        && visibleIds.join(',') === c.visible.join(',')
        && !motionIds.includes(userMotionId || '')
        && new Set(motionIds).size === motionIds.length,
      visibleIds,
      motionIds,
    };
  });

  return {
    pass: results.every((r) => r.pass),
    results,
  };
}

export default runMemberMotionIsolationSelfTest;
