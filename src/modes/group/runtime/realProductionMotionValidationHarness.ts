// @ts-nocheck
/**
 * Real Production Motion validation harness (PHASE 9B).
 *
 * Separate from productionMotionValidationHarness (synthetic/pre-loaded scene).
 * Accepts ONLY assetProvenance = real_production.
 *
 * K-ONNODE owns: validation, skeleton contract, retarget gate, transform proof.
 * Does NOT perform motion extraction or GX10 processing.
 */
import * as THREE from 'three';
import type { ProductionMotionAssetV2 } from '../types/ProductionMotionAssetV2';
import type {
  ProductionMotionFinalStatus,
  SkeletonProfile,
} from '../types/ProductionSkeletonContract';
import type { AssetProvenance } from '../types/AssetProvenance';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { validateProductionMotionAssetV2 } from '../services/ProductionMotionAssetLoader';
import { assertRealProductionAsset } from './validateAssetProvenance';
import { validateRealProductionIntakeContract } from '../../../gx10/ingest/ProductionAssetIntakeContract';
import {
  assertAuthorityVerificationMatchesAsset,
  type ProductionAuthorityVerification,
} from '../../../gx10/ingest/verifyProductionAuthority';
import { resolveMotionAnimationClip } from './resolveMotionAnimationClip';
import { validateProductionMotionPair } from './productionMotionValidationHarness';

export type RealProductionMotionValidationInput = {
  asset: ProductionMotionAssetV2;
  /** Required — from verifyProductionAuthority() server round-trip */
  authorityVerification: ProductionAuthorityVerification;
  memberId: string;
  avatarRoot: THREE.Object3D;
  motionScene: THREE.Object3D;
  motionClips: THREE.AnimationClip[];
  sourceAvatarScene?: THREE.Object3D;
};

export type RealProductionMotionValidationReport = {
  assetProvenance: AssetProvenance;
  groupId: string;
  songId: string;
  memberId: string;
  avatarSkeletonProfile: SkeletonProfile;
  sourceSkeletonProfile: SkeletonProfile;
  selectedClipName: string;
  motionTrackCount: number;
  mappedSemanticBones: Partial<Record<string, string>>;
  mappingRatio: number;
  requiredBoneValidation?: ReturnType<typeof validateProductionMotionPair>['requiredBoneValidation'];
  retargetStatus?: string;
  retargetedClipValid: boolean;
  retargetedTrackCount: number;
  changedBoneCount: number;
  transformProof: string;
  finalStatus: ProductionMotionFinalStatus;
  playbackPath: 'direct' | 'retargeted' | 'failed';
};

export function validateRealProductionMotionAsset(input: RealProductionMotionValidationInput): RealProductionMotionValidationReport {
  const { asset, authorityVerification, memberId, avatarRoot, motionScene, motionClips, sourceAvatarScene } = input;

  assertRealProductionAsset(asset);
  assertAuthorityVerificationMatchesAsset(asset, authorityVerification);
  validateProductionMotionAssetV2(asset);
  validateRealProductionIntakeContract(asset);

  const member = asset.members.find((m) => m.memberId === memberId);
  if (!member) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.SELECTED_MEMBER_NOT_FOUND,
      `member ${memberId} not in asset`,
    );
  }

  if (!member.motion.sourceSkeletonProfile || member.motion.sourceSkeletonProfile === 'UNKNOWN') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
      `member ${memberId}: sourceSkeletonProfile missing`,
    );
  }
  if (!member.avatar.avatarSkeletonProfile || member.avatar.avatarSkeletonProfile === 'UNKNOWN') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
      `member ${memberId}: avatarSkeletonProfile missing`,
    );
  }

  const resolved = resolveMotionAnimationClip(
    motionClips,
    member.motion.animationClipName,
    memberId,
  );

  const pairReport = validateProductionMotionPair({
    memberId,
    avatarRoot,
    motionScene,
    sourceClip: resolved.clip,
    sourceAvatarScene,
    declaredMotionProfile: member.motion.sourceSkeletonProfile,
    declaredAvatarProfile: member.avatar.avatarSkeletonProfile,
    requireDeclaredProfiles: true,
  });

  return {
    assetProvenance: 'real_production',
    groupId: asset.groupId,
    songId: asset.songId,
    memberId,
    avatarSkeletonProfile: member.avatar.avatarSkeletonProfile,
    sourceSkeletonProfile: member.motion.sourceSkeletonProfile,
    selectedClipName: resolved.selectedClipName,
    motionTrackCount: resolved.clip.tracks.length,
    mappedSemanticBones: pairReport.mappedSemanticBones,
    mappingRatio: pairReport.mappingRatio,
    requiredBoneValidation: pairReport.requiredBoneValidation,
    retargetStatus: pairReport.retargetResult?.status,
    retargetedClipValid: pairReport.retargetedClipValid,
    retargetedTrackCount: pairReport.retargetedTrackCount,
    changedBoneCount: pairReport.changedBoneCount,
    transformProof: pairReport.transformProof,
    finalStatus: pairReport.finalStatus,
    playbackPath: pairReport.playbackPath,
  };
}

export default validateRealProductionMotionAsset;
