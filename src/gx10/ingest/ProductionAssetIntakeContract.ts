// @ts-nocheck
/**
 * Production Asset Intake Readiness Contract (PHASE 12).
 *
 * Minimum fields required when a real K-POP Production Motion Asset enters the pipeline.
 * Missing fields must block ingest — no inference or defaults for real_production.
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type { ProductionAuthorityProof } from './productionAuthorityProof';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../../modes/group/types/ProductionMotionAssetV2';
import { isValidProductionAuthorityProof } from './productionAuthorityProof';

export type RealProductionIntakeMemberContract = {
  memberId: string;
  memberName: string;
  avatarAssetId: string;
  avatarGlbUrl: string;
  avatarSkeletonProfile: string;
  avatarSkeletonVersion: string;
  motionAssetId: string;
  motionUrl: string;
  motionFormat: 'gltf_animation';
  sourceSkeletonProfile: string;
  sourceSkeletonVersion: string;
  animationClipName: string;
  durationSec: number;
};

export type RealProductionIntakeContract = {
  assetProvenance: 'real_production';
  productionAssetId: string;
  groupId: string;
  songId: string;
  durationSec: number;
  productionAuthorityProof: ProductionAuthorityProof;
  members: RealProductionIntakeMemberContract[];
};

function requireField(value: unknown, label: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      `${label} required for real production intake`,
    );
  }
}

export function validateRealProductionIntakeContract(asset: ProductionMotionAssetV2): RealProductionIntakeContract {
  if (asset.assetProvenance !== 'real_production') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'intake contract requires assetProvenance=real_production',
    );
  }

  requireField(asset.productionAssetId, 'productionAssetId');
  requireField(asset.groupId, 'groupId');
  requireField(asset.songId, 'songId');

  if (!Number.isFinite(asset.durationSec) || asset.durationSec <= 0) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.MOTION_DURATION_INVALID,
      'durationSec required for real production intake',
    );
  }

  if (!isValidProductionAuthorityProof(asset.productionAuthorityProof, asset.productionAssetId)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'productionAuthorityProof missing or invalid for real production intake',
    );
  }

  if (!Array.isArray(asset.members) || !asset.members.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'members required for real production intake',
    );
  }

  const members: RealProductionIntakeMemberContract[] = asset.members.map((member) => {
    requireField(member.memberId, `member ${member.memberId || '?'}.memberId`);
    requireField(member.memberName, `member ${member.memberId}.memberName`);
    requireField(member.avatar?.avatarAssetId, `member ${member.memberId}.avatarAssetId`);
    requireField(member.avatar?.glbUrl, `member ${member.memberId}.avatar glbUrl`);
    requireField(member.avatar?.avatarSkeletonProfile, `member ${member.memberId}.avatarSkeletonProfile`);
    requireField(member.avatar?.avatarSkeletonVersion, `member ${member.memberId}.avatarSkeletonVersion`);
    requireField(member.motion?.motionAssetId, `member ${member.memberId}.motionAssetId`);
    requireField(member.motion?.motionUrl, `member ${member.memberId}.motionUrl`);
    requireField(member.motion?.sourceSkeletonProfile, `member ${member.memberId}.sourceSkeletonProfile`);
    requireField(member.motion?.sourceSkeletonVersion, `member ${member.memberId}.sourceSkeletonVersion`);
    requireField(member.motion?.animationClipName, `member ${member.memberId}.animationClipName`);

    if (member.motion.motionFormat !== 'gltf_animation') {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.MOTION_FORMAT_UNSUPPORTED,
        `member ${member.memberId}: motionFormat must be gltf_animation`,
      );
    }

    if (!Number.isFinite(member.motion.durationSec) || member.motion.durationSec <= 0) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.INVALID_MOTION_DURATION,
        `member ${member.memberId}: durationSec required`,
      );
    }

    if (
      member.motion.sourceSkeletonProfile === 'UNKNOWN'
      || member.avatar.avatarSkeletonProfile === 'UNKNOWN'
    ) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
        `member ${member.memberId}: skeleton profile must be declared`,
      );
    }

    return {
      memberId: member.memberId,
      memberName: member.memberName,
      avatarAssetId: member.avatar.avatarAssetId,
      avatarGlbUrl: member.avatar.glbUrl,
      avatarSkeletonProfile: member.avatar.avatarSkeletonProfile!,
      avatarSkeletonVersion: member.avatar.avatarSkeletonVersion!,
      motionAssetId: member.motion.motionAssetId,
      motionUrl: member.motion.motionUrl,
      motionFormat: 'gltf_animation',
      sourceSkeletonProfile: member.motion.sourceSkeletonProfile!,
      sourceSkeletonVersion: member.motion.sourceSkeletonVersion!,
      animationClipName: member.motion.animationClipName!,
      durationSec: member.motion.durationSec,
    };
  });

  return {
    assetProvenance: 'real_production',
    productionAssetId: asset.productionAssetId!,
    groupId: asset.groupId,
    songId: asset.songId,
    durationSec: asset.durationSec,
    productionAuthorityProof: asset.productionAuthorityProof!,
    members,
  };
}

export default validateRealProductionIntakeContract;
