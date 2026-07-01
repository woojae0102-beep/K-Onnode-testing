// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';
import { normalizePositionMap } from '../utils/skeletonDataUtils';

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  return dx * dx + dy * dy;
}

/** strict 매칭 임계값 (정규화 좌표) */
export const MAX_MATCH_DIST2 = 0.35 * 0.35;
/** fallback: 이 값까지는 최근접 강제 매칭 허용 */
export const FALLBACK_MATCH_DIST2 = 0.55 * 0.55;

/** 선택 멤버 defaultX/Y에 가장 가까운 트랙 = "내" 트랙 추정 */
export function identifyUserTrackId(
  groupId: string,
  myMemberId: string,
  trackIdToInitialPosition: Map<number, { x: number; y: number }> | Record<string, { x: number; y: number }>,
): number | null {
  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === myMemberId);
  const positions = normalizePositionMap(trackIdToInitialPosition);
  const allTracks = Array.from(positions.entries());
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
 * 트랙 초기 위치 → AI 멤버 ID 매칭 (선택 멤버 제외).
 * 1) 내 트랙 식별 후 제외  2) X정렬 greedy  3) 미매칭은 fallback 강제 할당
 */
export function suggestTrackToMemberMap(
  groupId: string,
  myMemberId: string,
  trackIdToInitialPosition: Map<number, { x: number; y: number }> | Record<string, { x: number; y: number }>,
): Map<number, string> {
  const group = GROUP_DATA[groupId];
  const result = new Map<number, string>();
  if (!group) return result;

  const positions = normalizePositionMap(trackIdToInitialPosition);

  const aiMembers = group.members.filter((m) => m.id !== myMemberId);
  const usedMembers = new Set<string>();
  const usedTracks = new Set<number>();

  const myTrackId = identifyUserTrackId(groupId, myMemberId, positions);

  const aiTracks = Array.from(positions.entries())
    .filter(([trackId]) => trackId !== myTrackId)
    .sort(([, a], [, b]) => a.x - b.x);

  const sortedAiMembers = [...aiMembers].sort((a, b) => a.defaultX - b.defaultX);

  // 1차: X정렬 + 임계값 내 매칭
  aiTracks.forEach(([trackId, pos]) => {
    let bestMemberId: string | null = null;
    let bestDist = Infinity;

    sortedAiMembers.forEach((member) => {
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
      usedTracks.add(trackId);
    }
  });

  // 2차: fallback — 남은 트랙/멤버 최근접 강제 매칭
  aiTracks.forEach(([trackId, pos]) => {
    if (usedTracks.has(trackId)) return;

    let bestMemberId: string | null = null;
    let bestDist = Infinity;

    sortedAiMembers.forEach((member) => {
      if (usedMembers.has(member.id)) return;
      const d = dist2(pos, { x: member.defaultX, y: member.defaultY });
      if (d < bestDist) {
        bestDist = d;
        bestMemberId = member.id;
      }
    });

    if (bestMemberId && bestDist <= FALLBACK_MATCH_DIST2) {
      result.set(trackId, bestMemberId);
      usedMembers.add(bestMemberId);
      usedTracks.add(trackId);
      if (bestDist > MAX_MATCH_DIST2) {
        console.warn(
          `[FormationMatch] fallback 매칭: trackId=${trackId} → ${bestMemberId} (거리 ${Math.sqrt(bestDist).toFixed(3)})`,
        );
      }
    }
  });

  // 3차: 거리 제한 없이 남은 트랙/멤버 강제 할당 (0명 추출 방지)
  aiTracks.forEach(([trackId, pos]) => {
    if (usedTracks.has(trackId)) return;

    let bestMemberId: string | null = null;
    let bestDist = Infinity;

    sortedAiMembers.forEach((member) => {
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
      usedTracks.add(trackId);
      if (bestDist > FALLBACK_MATCH_DIST2) {
        console.warn(
          `[FormationMatch] 강제 매칭: trackId=${trackId} → ${bestMemberId} (거리 ${Math.sqrt(bestDist).toFixed(3)})`,
        );
      }
    }
  });

  const unmatchedMembers = aiMembers.filter((m) => !usedMembers.has(m.id));
  if (unmatchedMembers.length) {
    console.warn(
      `[FormationMatch] 매칭 실패한 AI 멤버: ${unmatchedMembers.map((m) => m.id).join(', ')}`,
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
