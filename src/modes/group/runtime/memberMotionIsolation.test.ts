// @ts-nocheck
/**
 * Run: npx tsx src/modes/group/runtime/memberMotionIsolation.test.ts
 */
import { getVisibleGroupMembers } from './getVisibleGroupMembers';
import { buildRealMotionAssetFixture } from '../fixtures/realMotionAssetFixture';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const FIXTURE = buildRealMotionAssetFixture({ songId: 'how-you-like-that' });
const ALL_IDS = FIXTURE.members.map((m) => m.memberId);

const CASES = [
  { selected: 'jennie', label: 'A/jennie', expectUser: 'jennie', expectVisible: ['lisa', 'rose', 'jisoo'] },
  { selected: 'lisa', label: 'B/lisa', expectUser: 'lisa', expectVisible: ['jennie', 'rose', 'jisoo'] },
  { selected: 'rose', label: 'C/rose', expectUser: 'rose', expectVisible: ['jennie', 'lisa', 'jisoo'] },
  { selected: 'jisoo', label: 'D/jisoo', expectUser: 'jisoo', expectVisible: ['jennie', 'lisa', 'rose'] },
];

for (const c of CASES) {
  const { userMember, visibleAiMembers } = getVisibleGroupMembers({
    members: FIXTURE.members.map((m) => ({ memberId: m.memberId, _motion: m })),
    selectedMemberId: c.selected,
    mode: 'isolation-test',
  });

  assert(userMember?.memberId === c.expectUser, `${c.label}: user slot`);
  assert(
    visibleAiMembers.map((v) => v.memberId).join(',') === c.expectVisible.join(','),
    `${c.label}: visible members`,
  );

  const visibleMotionIds = visibleAiMembers.map((v) => v._motion.motionAssetId);
  const userMotion = FIXTURE.members.find((m) => m.memberId === c.selected);
  assert(!visibleMotionIds.includes(userMotion?.motionAssetId || ''), `${c.label}: user motion not in visible`);

  const uniqueMotionIds = new Set(visibleMotionIds);
  assert(uniqueMotionIds.size === visibleMotionIds.length, `${c.label}: motionAssetId unique`);

  for (const vis of visibleAiMembers) {
    assert(vis._motion.motionUrl !== '', `${c.label}: ${vis.memberId} has motionUrl`);
    assert(vis._motion.motionFormat === 'gltf_animation', `${c.label}: gltf_animation only`);
  }
}

assert(new Set(FIXTURE.members.map((m) => m.motionUrl)).size === ALL_IDS.length, 'all motion URLs distinct');

console.log('memberMotionIsolation tests: PASS');
