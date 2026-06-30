// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}

/** 너무 동떨어진 위치는 오매칭으로 간주 (정규화 좌표 기준) */
export const MAX_MATCH_DIST2 = 0.35 * 0.35;

/** 선택 멤버 defaultX/Y에 가장 가까운 트랙 = "내" 트랙 추정 */
export function identifyUserTrackId(
  groupId: string,
  myMemberId: string,
  trackIdToInitialPosition: Map<number, { x: number; y: number }>,
): number | null {
  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === myMemberId);
  const allTracks = Array.from(trackIdToInitialPosition.entries());
  if (!myMember || !allTracks.length) return null;

  let myTrackId: number | null = null;
  let bestDist = Infinity;

  allTracks.forEach(([trackId, pos]) => {
    const d = dist2(pos, { x: myMember.defaultX, y: myMember.defaultY });
    if (d < bestDist) {
      bestDist = d;
      myTrackId = trackId;
    }
  });

  if (import.meta.env?.DEV && myTrackId !== null) {
    console.debug(
      `[FormationMatch] 내 트랙으로 추정: trackId=${myTrackId}, 거리²=${bestDist.toFixed(3)}`,
    );
  }

  return myTrackId;
}

/**
 * 트랙 초기 위치 → AI 멤버 ID greedy 매칭 (선택 멤버 제외).
 * 내 트랙은 identifyUserTrackId로 먼저 식별 후 매칭 풀에서 제외한다.
 */
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
  const allTracks = Array.from(trackIdToInitialPosition.entries());

  const myTrackId = identifyUserTrackId(groupId, myMemberId, trackIdToInitialPosition);

  const remainingTracks = allTracks
    .filter(([trackId]) => trackId !== myTrackId)
    .sort(([, a], [, b]) => a.x - b.x);

  remainingTracks.forEach(([trackId, pos]) => {
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

    if (bestMemberId && bestDist <= MAX_MATCH_DIST2) {
      result.set(trackId, bestMemberId);
      usedMembers.add(bestMemberId);
    } else if (bestMemberId) {
      console.warn(
        `[FormationMatch] trackId=${trackId} ↔ ${bestMemberId} 매칭 거리(${Math.sqrt(bestDist).toFixed(3)})가 ` +
          `임계값(${Math.sqrt(MAX_MATCH_DIST2).toFixed(2)})을 초과해 매칭을 보류합니다.`,
      );
    }
  });

  const unmatchedMembers = aiMembers.filter((m) => !usedMembers.has(m.id));
  if (unmatchedMembers.length) {
    console.warn(
      `[FormationMatch] 매칭 실패한 AI 멤버: ${unmatchedMembers.map((m) => m.id).join(', ')} ` +
        '— 영상에서 해당 멤버가 충분히 인식되지 않았을 수 있습니다.',
    );
  }

  if (import.meta.env?.DEV) {
    console.debug(
      `[FormationMatch] 최종 AI 매칭 ${result.size}개 (기대 ${aiMembers.length}개), myTrackId=${myTrackId}`,
    );
  }

  return result;
}

export default suggestTrackToMemberMap;
