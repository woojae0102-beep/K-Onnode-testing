// @ts-nocheck
/**
 * Provenance trust boundary validation (PHASE 10/12).
 *
 * real_production requires serializable productionAuthorityProof.
 * Symbol-based trustedProvenance is in-memory only and NOT sufficient alone.
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../../modes/group/types/ProductionMotionAssetV2';
import { isValidProductionAuthorityProof } from './productionAuthorityProof';
import { isTrustedRealProductionProvenance } from './trustedProvenance';

export function validateProvenanceTrustBoundary(asset: ProductionMotionAssetV2): void {
  if (asset.assetProvenance === 'real_production') {
    if (!isValidProductionAuthorityProof(asset.productionAuthorityProof, asset.productionAssetId)) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
        'real_production requires valid productionAuthorityProof',
      );
    }
    if (
      asset.productionAssetId
      && asset.productionAuthorityProof!.productionAssetId !== asset.productionAssetId
    ) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
        'productionAssetId mismatch with authority proof',
      );
    }
    return;
  }

  if (asset.productionAuthorityProof) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'productionAuthorityProof is only valid for real_production assets',
    );
  }

  if (isTrustedRealProductionProvenance(asset.trustedProvenance)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'in-memory Symbol seal alone is not valid distributed production authority',
    );
  }
}

export default validateProvenanceTrustBoundary;
