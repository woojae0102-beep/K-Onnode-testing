// @ts-nocheck
import type { ProductionDanceAsset, GroupRuntimeActors } from '../../types/productionDanceAsset';
import { PRODUCTION_ERRORS } from '../../types/productionDanceAsset';
import { getVisibleGroupMembers } from '../../modes/group/runtime/getVisibleGroupMembers';

/**
 * Production asset member visibility — getVisibleGroupMembers 위임.
 */
export function getGroupRuntimeActors(
  asset: ProductionDanceAsset,
  selectedMemberId: string,
): GroupRuntimeActors {
  const { userMember, visibleAiMembers } = getVisibleGroupMembers({
    members: asset.members.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      _src: m,
    })),
    selectedMemberId,
    mode: 'production-runtime',
  });

  if (!userMember) {
    throw new Error(
      `${PRODUCTION_ERRORS.PRODUCTION_NOT_READY}: member ${selectedMemberId} not in asset ${asset.id}`,
    );
  }

  const userSlot = userMember._src;
  const aiActors = visibleAiMembers.map((m) => m._src);

  return { userSlot, aiActors, selectedMemberId };
}

export default getGroupRuntimeActors;
