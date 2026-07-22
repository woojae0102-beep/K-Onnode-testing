// @ts-nocheck
/**
 * Production Motion Asset V2 — Group Runtime contract.
 * skeleton / joints / trackId / detection metadata 금지.
 *
 * v2.1 extension (schemaVersion 2 유지):
 * - motion.sourceSkeletonProfile / sourceSkeletonVersion
 * - avatar.avatarSkeletonProfile / avatarSkeletonVersion
 * - assetProvenance (PHASE 9B)
 * Migration boundary: assets without assetProvenance → provenance unknown → real validation blocked.
 */

import type {
  ProductionSkeletonProfileFields,
  SkeletonProfile,
} from './ProductionSkeletonContract';
import type { AssetProvenance } from './AssetProvenance';
import type { TrustedRealProductionProvenance } from '../../gx10/ingest/trustedProvenance';
import type { ProductionAuthorityProof } from '../../gx10/ingest/productionAuthorityProof';
import type { ProductionAuthorityToken } from '../../gx10/ingest/ProductionAuthorityToken';

export type { AssetProvenance };

export type ProductionMotionAssetV2Status = 'draft' | 'processing' | 'ready' | 'error';

export type ProductionMotionMemberV2 = {
  memberId: string;
  memberName: string;
  avatar: {
    avatarAssetId: string;
    glbUrl: string;
  } & Pick<ProductionSkeletonProfileFields, 'avatarSkeletonProfile' | 'avatarSkeletonVersion'>;
  motion: {
    motionAssetId: string;
    motionFormat: 'gltf_animation';
    motionUrl: string;
    durationSec: number;
    animationClipName?: string;
  } & Pick<ProductionSkeletonProfileFields, 'sourceSkeletonProfile' | 'sourceSkeletonVersion'>;
  formation?: {
    keyframes: Array<{
      timeSec: number;
      position: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
    }>;
  };
};

export type ProductionMotionAssetV2 = {
  schemaVersion: 2;
  groupId: string;
  songId: string;
  durationSec: number;
  fps?: number;
  members: ProductionMotionMemberV2[];
  status: ProductionMotionAssetV2Status;
  /** Explicit asset origin — missing = provenance unknown */
  assetProvenance?: AssetProvenance;
  /** GX10 ingest seal — in-memory only, NOT distributed trust proof */
  trustedProvenance?: TrustedRealProductionProvenance;
  /** Serializable server/API authority proof — required for real_production */
  productionAuthorityProof?: ProductionAuthorityProof;
  /** Cryptographically signed authority token — server-issued only */
  productionAuthorityToken?: ProductionAuthorityToken;
  /** Processor-assigned production asset id (real_production ingest output) */
  productionAssetId?: string;
  createdAt: string;
  updatedAt: string;
};

export const PRODUCTION_MOTION_ERRORS = {
  PRODUCTION_ASSET_NOT_FOUND: 'PRODUCTION_ASSET_NOT_FOUND',
  PRODUCTION_ASSET_NOT_READY: 'PRODUCTION_ASSET_NOT_READY',
  PRODUCTION_ASSET_SCHEMA_INVALID: 'PRODUCTION_ASSET_SCHEMA_INVALID',
  MEMBER_MOTION_ASSET_MISSING: 'MEMBER_MOTION_ASSET_MISSING',
  MEMBER_AVATAR_ASSET_MISSING: 'MEMBER_AVATAR_ASSET_MISSING',
  MOTION_FORMAT_UNSUPPORTED: 'MOTION_FORMAT_UNSUPPORTED',
  MOTION_DURATION_INVALID: 'MOTION_DURATION_INVALID',
  INVALID_MOTION_DURATION: 'INVALID_MOTION_DURATION',
  DUPLICATE_MOTION_ASSET_ID: 'DUPLICATE_MOTION_ASSET_ID',
  DUPLICATE_MOTION_URL: 'DUPLICATE_MOTION_URL',
  DUPLICATE_MEMBER_ID: 'DUPLICATE_MEMBER_ID',
  DUPLICATE_AVATAR_ASSET_ID: 'DUPLICATE_AVATAR_ASSET_ID',
  SELECTED_MEMBER_NOT_FOUND: 'SELECTED_MEMBER_NOT_FOUND',
  GROUP_MOTION_ACTOR_COUNT_INVALID: 'GROUP_MOTION_ACTOR_COUNT_INVALID',
  MOTION_CLIP_NOT_FOUND: 'MOTION_CLIP_NOT_FOUND',
  AMBIGUOUS_MOTION_CLIP: 'AMBIGUOUS_MOTION_CLIP',
  PRODUCTION_SKELETON_INVALID: 'PRODUCTION_SKELETON_INVALID',
  PRODUCTION_REQUIRED_BONE_MISSING: 'PRODUCTION_REQUIRED_BONE_MISSING',
  PRODUCTION_BONE_MAPPING_AMBIGUOUS: 'PRODUCTION_BONE_MAPPING_AMBIGUOUS',
  PRODUCTION_SKELETON_PROFILE_UNSUPPORTED: 'PRODUCTION_SKELETON_PROFILE_UNSUPPORTED',
  PRODUCTION_ASSET_PROVENANCE_UNKNOWN: 'PRODUCTION_ASSET_PROVENANCE_UNKNOWN',
  PRODUCTION_ASSET_PROVENANCE_INVALID: 'PRODUCTION_ASSET_PROVENANCE_INVALID',
  PRODUCTION_AUTHORITY_NOT_FOUND: 'PRODUCTION_AUTHORITY_NOT_FOUND',
  PRODUCTION_AUTHORITY_MISMATCH: 'PRODUCTION_AUTHORITY_MISMATCH',
  PRODUCTION_AUTHORITY_REVOKED: 'PRODUCTION_AUTHORITY_REVOKED',
  PRODUCTION_AUTHORITY_VERIFICATION_FAILED: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_SIGNATURE_INVALID: 'PRODUCTION_AUTHORITY_SIGNATURE_INVALID',
  PRODUCTION_AUTHORITY_EXPIRED: 'PRODUCTION_AUTHORITY_EXPIRED',
  PRODUCTION_AUTHORITY_TIMEOUT: 'PRODUCTION_AUTHORITY_TIMEOUT',
  PRODUCTION_AUTHORITY_NETWORK_ERROR: 'PRODUCTION_AUTHORITY_NETWORK_ERROR',
  PRODUCTION_AUTHORITY_SERVER_ERROR: 'PRODUCTION_AUTHORITY_SERVER_ERROR',
  PRODUCTION_AUTHORITY_BAD_RESPONSE: 'PRODUCTION_AUTHORITY_BAD_RESPONSE',
  GX10_PROCESSOR_OUTPUT_INVALID: 'GX10_PROCESSOR_OUTPUT_INVALID',
  GX10_OUTPUT_CHECKSUM_MISMATCH: 'GX10_OUTPUT_CHECKSUM_MISMATCH',
} as const;

export type { SkeletonProfile };

export type ProductionMotionErrorCode = typeof PRODUCTION_MOTION_ERRORS[keyof typeof PRODUCTION_MOTION_ERRORS];

export class ProductionMotionAssetError extends Error {
  code: ProductionMotionErrorCode;

  constructor(code: ProductionMotionErrorCode, message: string) {
    super(message);
    this.name = 'ProductionMotionAssetError';
    this.code = code;
  }
}

export default ProductionMotionAssetV2;
