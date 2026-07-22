// @ts-nocheck
/**
 * A/B/C/D member isolation — ProductionMotionAssetV2 (TEST 19~22)
 * Run: npx tsx src/modes/group/runtime/memberMotionIsolationV2.test.ts
 */
import { getVisibleGroupMembers } from './getVisibleGroupMembers';
import { PRODUCTION_MOTION_TEST_CONTRACT } from '../fixtures/productionMotionTestContract';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const motionAsset = productionMotionAssetV2ToGroupMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);

const CASES = [
  { selected: 'member_a', label: 'A', expectVisible: ['member_b', 'member_c', 'member_d'], expectMotionIds: ['contract-motion-b', 'contract-motion-c', 'contract-motion-d'] },
  { selected: 'member_b', label: 'B', expectVisible: ['member_a', 'member_c', 'member_d'], expectMotionIds: ['contract-motion-a', 'contract-motion-c', 'contract-motion-d'] },
  { selected: 'member_c', label: 'C', expectVisible: ['member_a', 'member_b', 'member_d'], expectMotionIds: ['contract-motion-a', 'contract-motion-b', 'contract-motion-d'] },
  { selected: 'member_d', label: 'D', expectVisible: ['member_a', 'member_b', 'member_c'], expectMotionIds: ['contract-motion-a', 'contract-motion-b', 'contract-motion-c'] },
];

for (const c of CASES) {
  const { userMember, visibleAiMembers } = getVisibleGroupMembers({
    members: motionAsset.members.map((m) => ({ memberId: m.memberId, _motion: m })),
    selectedMemberId: c.selected,
    mode: `isolation-v2-${c.label}`,
  });

  assert(userMember?.memberId === c.selected, `TEST ${c.label}: user slot`);
  assert(
    visibleAiMembers.map((v) => v.memberId).join(',') === c.expectVisible.join(','),
    `TEST ${c.label}: visible members`,
  );

  const userMotionId = motionAsset.members.find((m) => m.memberId === c.selected)?.motionAssetId;
  const visibleMotionIds = visibleAiMembers.map((v) => v._motion.motionAssetId);
  assert(!visibleMotionIds.includes(userMotionId || ''), `TEST ${c.label}: user motion not loaded`);

  assert(
    visibleMotionIds.join(',') === c.expectMotionIds.join(','),
    `TEST ${c.label}: motionAssetIds`,
  );

  const urls = visibleAiMembers.map((v) => v._motion.motionUrl);
  assert(new Set(urls).size === urls.length, `TEST ${c.label}: distinct motionUrl`);

  console.log(`TEST ${c.label} (19~22 subset): PASS`);
}

console.log('memberMotionIsolationV2 tests: ALL PASS');
