// @ts-nocheck
import type { GroupMotionContent } from '../../types/groupMotionContent';
import { GROUP_DATA } from '../../data/groupPracticeData';

export type GroupContentValidationResult = {
  valid: boolean;
  issues: string[];
  memberCount: number;
  frameCount: number;
  durationSec: number;
};

export function validateGroupMotionContent(content: GroupMotionContent): GroupContentValidationResult {
  const issues: string[] = [];
  const group = GROUP_DATA[content.groupId];
  const expectedMembers = group?.members?.length ?? 0;

  if (!content.groupId || !content.songId) {
    issues.push('groupId/songId missing');
  }
  if (!content.members?.length) {
    issues.push('members array empty');
  }
  if (!content.frames?.length && !content.members.some((m) => m.motionData?.length)) {
    issues.push('no motion frames');
  }
  if (content.durationSec <= 0) {
    issues.push('invalid durationSec');
  }

  const memberIds = new Set(content.members.map((m) => m.memberId));
  if (memberIds.size !== content.members.length) {
    issues.push('duplicate memberId in members');
  }

  content.members.forEach((m) => {
    if (!m.memberId) issues.push('member without memberId');
    const samples = m.motionData?.length ?? 0;
    if (samples < 2) issues.push(`${m.memberId}: insufficient samples (${samples})`);
  });

  if (expectedMembers > 0 && content.members.length < Math.max(2, expectedMembers - 1)) {
    issues.push(`expected ~${expectedMembers} members, got ${content.members.length}`);
  }

  const frameCount = content.frames?.length
    ?? Math.max(...content.members.map((m) => m.motionData?.length ?? 0), 0);

  return {
    valid: issues.length === 0,
    issues,
    memberCount: content.members.length,
    frameCount,
    durationSec: content.durationSec,
  };
}
