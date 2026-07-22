// @ts-nocheck
import type { ProductionMotionAssetV2 } from '../types/ProductionMotionAssetV2';
import type { AssetProvenance } from '../types/AssetProvenance';
import { ASSET_PROVENANCE_VALUES } from '../types/AssetProvenance';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { validateProvenanceTrustBoundary } from '../../../gx10/ingest/validateProvenanceTrustBoundary';

export function getAssetProvenance(asset: ProductionMotionAssetV2): AssetProvenance | null {
  if (!asset.assetProvenance) return null;
  return asset.assetProvenance;
}

export function isKnownAssetProvenance(asset: ProductionMotionAssetV2): boolean {
  return ASSET_PROVENANCE_VALUES.includes(asset.assetProvenance as AssetProvenance);
}

export function assertAssetProvenance(
  asset: ProductionMotionAssetV2,
  allowed: AssetProvenance[],
): AssetProvenance {
  if (!asset.assetProvenance) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_UNKNOWN,
      `asset ${asset.groupId}/${asset.songId}: assetProvenance missing`,
    );
  }
  if (!ASSET_PROVENANCE_VALUES.includes(asset.assetProvenance)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      `invalid assetProvenance: ${String(asset.assetProvenance)}`,
    );
  }
  if (!allowed.includes(asset.assetProvenance)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      `assetProvenance=${asset.assetProvenance} not in [${allowed.join(', ')}]`,
    );
  }
  return asset.assetProvenance;
}

export function assertRealProductionAsset(asset: ProductionMotionAssetV2): AssetProvenance {
  const provenance = assertAssetProvenance(asset, ['real_production']);
  validateProvenanceTrustBoundary(asset);
  return provenance;
}

export default assertRealProductionAsset;
