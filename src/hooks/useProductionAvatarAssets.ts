// @ts-nocheck
/**
 * Production member avatar assets — avatarAssetId + avatarAssetUrl (RPM/demo GLB 금지).
 */
import { useMemo } from 'react';
import type { ProductionDanceAsset } from '../types/productionDanceAsset';
import { PRODUCTION_ERRORS } from '../types/productionDanceAsset';

export type ProductionAvatarAssetEntry = {
  memberId: string;
  avatarAssetId: string | null;
  avatarAssetUrl: string | null;
  missing: boolean;
  errorCode?: string;
};

function resolveMemberAvatarUrl(
  member: ProductionDanceAsset['members'][0] | undefined,
): string | null {
  if (!member) return null;
  const url = member.avatarAssetUrl?.trim();
  if (url) return url;
  return null;
}

export function resolveProductionAvatarAssets(
  asset: ProductionDanceAsset | null | undefined,
  memberIds: string[],
): Record<string, ProductionAvatarAssetEntry> {
  const map: Record<string, ProductionAvatarAssetEntry> = {};
  memberIds.forEach((memberId) => {
    const member = asset?.members?.find((m) => m.memberId === memberId);
    const url = resolveMemberAvatarUrl(member);
    const avatarAssetId = member?.avatarAssetId || null;
    map[memberId] = {
      memberId,
      avatarAssetId,
      avatarAssetUrl: url,
      missing: !url || !avatarAssetId,
      errorCode: url && avatarAssetId ? undefined : PRODUCTION_ERRORS.AVATAR_ASSET_MISSING,
    };
  });
  return map;
}

export function useProductionAvatarAssets(
  productionAsset: ProductionDanceAsset | null | undefined,
  aiMemberIds: string[],
) {
  return useMemo(
    () => resolveProductionAvatarAssets(productionAsset, aiMemberIds),
    [productionAsset, aiMemberIds.join(',')],
  );
}

export default useProductionAvatarAssets;
