// @ts-nocheck
/**
 * Group Mode runtime actor filtering — TEST 1~4 검증용.
 */
import { getGroupRuntimeActors } from '../../services/group/getGroupRuntimeActors';
import type { ProductionDanceAsset } from '../../types/productionDanceAsset';

export function validateGroupRuntimeActorSelection(
  asset: ProductionDanceAsset,
  selectedMemberId: string,
) {
  const { userSlot, aiActors } = getGroupRuntimeActors(asset, selectedMemberId);
  const aiIds = aiActors.map((a) => a.memberId);
  const errors: string[] = [];

  if (userSlot.memberId !== selectedMemberId) {
    errors.push(`userSlot mismatch: expected ${selectedMemberId}, got ${userSlot.memberId}`);
  }
  if (aiIds.includes(selectedMemberId)) {
    errors.push(`selected member ${selectedMemberId} must not appear in aiActors`);
  }
  asset.members.forEach((m) => {
    if (m.memberId === selectedMemberId) return;
    if (!aiIds.includes(m.memberId)) {
      errors.push(`AI actor missing: ${m.memberId}`);
    }
  });

  return { valid: errors.length === 0, userSlot, aiActors, errors };
}

export default validateGroupRuntimeActorSelection;
