// @ts-nocheck
/**
 * Run: npx tsx src/modes/group/runtime/getVisibleGroupMembers.test.ts
 */
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const members = [
  { memberId: 'A', memberName: 'A' },
  { memberId: 'B', memberName: 'B' },
  { memberId: 'C', memberName: 'C' },
  { memberId: 'D', memberName: 'D' },
];

const caseA = getVisibleGroupMembers({ members, selectedMemberId: 'A', mode: 'test' });
assert(caseA.userMember?.memberId === 'A', 'CASE A: userMember should be A');
assert(
  caseA.visibleAiMembers.map((m) => m.memberId).join(',') === 'B,C,D',
  'CASE A: visibleAiMembers should be B,C,D',
);

const caseB = getVisibleGroupMembers({ members, selectedMemberId: 'B', mode: 'test' });
assert(caseB.userMember?.memberId === 'B', 'CASE B: userMember should be B');
assert(
  caseB.visibleAiMembers.map((m) => m.memberId).join(',') === 'A,C,D',
  'CASE B: visibleAiMembers should be A,C,D',
);

const caseC = getVisibleGroupMembers({ members, selectedMemberId: 'D', mode: 'test' });
assert(caseC.userMember?.memberId === 'D', 'CASE C: userMember should be D');
assert(
  caseC.visibleAiMembers.map((m) => m.memberId).join(',') === 'A,B,C',
  'CASE C: visibleAiMembers should be A,B,C',
);

console.log('getVisibleGroupMembers tests: PASS');
