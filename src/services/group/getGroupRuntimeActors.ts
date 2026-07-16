// @ts-nocheck
import type { ProductionDanceAsset, GroupRuntimeActors } from '../../types/productionDanceAsset';
import { PRODUCTION_ERRORS } from '../../types/productionDanceAsset';

/**
 * memberId 기준 — index 필터링 금지.
 * 선택 멤버 = userSlot (Avatar 렌더 대상 아님), 나머지 = aiActors.
 */
export function getGroupRuntimeActors(
  asset: ProductionDanceAsset,
  selectedMemberId: string,
): GroupRuntimeActors {
  const userSlot = asset.members.find((m) => m.memberId === selectedMemberId);
  if (!userSlot) {
    throw new Error(
      `${PRODUCTION_ERRORS.PRODUCTION_NOT_READY}: member ${selectedMemberId} not in asset ${asset.id}`,
    );
  }
  const aiActors = asset.members.filter((m) => m.memberId !== selectedMemberId);
  return { userSlot, aiActors, selectedMemberId };
}

export default getGroupRuntimeActors;
