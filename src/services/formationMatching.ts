// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}

/** 트랙 초기 위치 → AI 멤버 ID greedy 매칭 (선택 멤버 제외) */
export function suggestTrackToMemberMap(
  groupId: string,
  myMemberId: string,
  trackIdToInitialPosition: Map<number, { x: number; y: number }>,
): Map<number, string> {
  const group = GROUP_DATA[groupId];
  const result = new Map<number, string>();
  if (!group) return result;

  const aiMembers = group.members.filter((m) => m.id !== myMemberId);
  const usedMembers = new Set<string>();

  const sortedTracks = Array.from(trackIdToInitialPosition.entries()).sort(
    ([, a], [, b]) => a.x - b.x,
  );

  sortedTracks.forEach(([trackId, pos]) => {
    let bestMemberId: string | null = null;
    let bestDist = Infinity;

    aiMembers.forEach((member) => {
      if (usedMembers.has(member.id)) return;
      const d = dist2(pos, { x: member.defaultX, y: member.defaultY });
      if (d < bestDist) {
        bestDist = d;
        bestMemberId = member.id;
      }
    });

    if (bestMemberId) {
      result.set(trackId, bestMemberId);
      usedMembers.add(bestMemberId);
    }
  });

  return result;
}

export default suggestTrackToMemberMap;
