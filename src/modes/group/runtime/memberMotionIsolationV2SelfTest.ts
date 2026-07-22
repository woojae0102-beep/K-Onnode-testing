// @ts-nocheck
import { PRODUCTION_MOTION_TEST_CONTRACT } from '../fixtures/productionMotionTestContract';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

export function runMemberMotionIsolationV2SelfTest() {
  const motionAsset = productionMotionAssetV2ToGroupMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);
  const cases = [
    { selected: 'member_a', visible: ['member_b', 'member_c', 'member_d'] },
    { selected: 'member_b', visible: ['member_a', 'member_c', 'member_d'] },
    { selected: 'member_c', visible: ['member_a', 'member_b', 'member_d'] },
    { selected: 'member_d', visible: ['member_a', 'member_b', 'member_c'] },
  ];

  const results = cases.map((c) => {
    const { userMember, visibleAiMembers } = getVisibleGroupMembers({
      members: motionAsset.members.map((m) => ({ memberId: m.memberId, _motion: m })),
      selectedMemberId: c.selected,
      mode: 'v2-self-test',
    });
    const userMotionId = motionAsset.members.find((m) => m.memberId === c.selected)?.motionAssetId;
    const motionIds = visibleAiMembers.map((v) => v._motion.motionAssetId);
    return {
      selected: c.selected,
      pass: userMember?.memberId === c.selected
        && visibleAiMembers.map((v) => v.memberId).join(',') === c.visible.join(',')
        && !motionIds.includes(userMotionId || ''),
      visibleIds: visibleAiMembers.map((v) => v.memberId),
      motionIds,
    };
  });

  return { pass: results.every((r) => r.pass), results };
}

export default runMemberMotionIsolationV2SelfTest;
