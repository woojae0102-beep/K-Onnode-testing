// @ts-nocheck
/**
 * Production motion retarget gate — PHASE 8 ordered pipeline.
 */
import type { AnimationClip } from 'three';
import type { Object3D } from 'three';
import { analyzeMotionClipBinding } from './analyzeMotionClipBinding';
import { extractSkeletonRuntimeFromScene } from './SkeletonRuntime';
import { computeSkeletonBoneMapping } from './computeSkeletonBoneMapping';
import { DefaultAvatarMotionRetargeter } from './DefaultAvatarMotionRetargeter';
import { validateRetargetedClip } from './validateRetargetedClip';
import { detectSkeletonProfile, resolveDeclaredSkeletonProfile } from './detectSkeletonProfile';
import { validateProductionSkeleton } from './validateProductionSkeleton';
import type {
  ProductionMotionFinalStatus,
  SkeletonProfile,
  SkeletonValidationResult,
} from '../types/ProductionSkeletonContract';
import type {
  AvatarSkeletonRuntimeAudit,
  RetargetResult,
} from '../types/skeletonRetargeting';
import type { MotionBindingDebugSnapshot } from '../types/motionBindingDebug';
import {
  getOrCacheRetargetResult,
  retargetCacheKey,
  getOrCacheSkeletonDefinition,
  skeletonDefinitionKey,
} from './productionMotionRuntimeCache';

export type MotionClipAudit = {
  valid: boolean;
  trackCount: number;
  durationSec: number;
  reasons: string[];
};

export type ProductionMotionRetargetGateResult = {
  binding: MotionBindingDebugSnapshot;
  skeletonAudit?: AvatarSkeletonRuntimeAudit;
  motionClipAudit: MotionClipAudit;
  avatarSkeletonProfile: SkeletonProfile;
  motionSkeletonProfile: SkeletonProfile;
  skeletonValidation?: SkeletonValidationResult;
  mappingRatio: number;
  mappedSemanticBones: Partial<Record<string, string>>;
  retargetResult?: RetargetResult;
  retargetedClipValid: boolean;
  playbackPath: 'direct' | 'retargeted' | 'failed';
  clip: AnimationClip;
  error?: string;
  errorCode?: string;
  finalStatus: ProductionMotionFinalStatus;
};

export function auditMotionClip(clip: AnimationClip): MotionClipAudit {
  const reasons: string[] = [];
  if (!clip.tracks.length) reasons.push('clip has zero tracks');
  if (!Number.isFinite(clip.duration) || clip.duration <= 0) reasons.push('clip duration <= 0');
  return {
    valid: reasons.length === 0,
    trackCount: clip.tracks.length,
    durationSec: clip.duration,
    reasons,
  };
}

export function computeProductionMotionFinalStatus(input: {
  playbackPath: 'direct' | 'retargeted' | 'failed';
  binding: MotionBindingDebugSnapshot;
  skeletonValidation?: SkeletonValidationResult;
  motionClipAudit: MotionClipAudit;
  retargetResult?: RetargetResult;
  retargetedClipValid: boolean;
  transformProof?: { proof?: string; transformProof?: string; changedBoneCount?: number };
  gateError?: string;
  authorityBlockedStatus?: ProductionMotionFinalStatus;
}): ProductionMotionFinalStatus {
  if (input.authorityBlockedStatus) {
    return input.authorityBlockedStatus;
  }

  const {
    playbackPath,
    binding,
    skeletonValidation,
    motionClipAudit,
    retargetResult,
    retargetedClipValid,
    transformProof,
    gateError,
  } = input;

  if (!motionClipAudit.valid) return 'BLOCKED_CLIP_INVALID';
  if (gateError?.includes('profile')) return 'BLOCKED_SKELETON_PROFILE_UNSUPPORTED';
  if (skeletonValidation?.status === 'unsupported') return 'BLOCKED_SKELETON_PROFILE_UNSUPPORTED';
  if (skeletonValidation?.duplicateSemanticBones?.length) {
    return 'BLOCKED_REQUIRED_BONE_MISSING';
  }
  if (skeletonValidation?.missingRequiredBones?.length) {
    return skeletonValidation.status === 'incomplete'
      ? 'BLOCKED_INCOMPLETE'
      : 'BLOCKED_REQUIRED_BONE_MISSING';
  }
  if (skeletonValidation && skeletonValidation.status !== 'valid') {
    return 'BLOCKED_SKELETON_INVALID';
  }

  if (playbackPath === 'direct') {
    if (binding.bindingStatus !== 'fully_bound') return 'BLOCKED_BINDING_FAILED';
    const proof = transformProof?.transformProof;
    if (proof !== 'motion_detected') return 'BLOCKED_TRANSFORM_NOT_CHANGED';
    return 'VERIFIED_DIRECT_PLAYBACK';
  }

  if (playbackPath === 'retargeted') {
    if (retargetResult?.status !== 'retargeted') return 'BLOCKED_MAPPING_FAILED';
    if (!retargetedClipValid) return 'BLOCKED_CLIP_INVALID';
    const proof = transformProof?.proof;
    if (proof !== 'retarget_motion_detected') return 'BLOCKED_TRANSFORM_NOT_CHANGED';
    if ((transformProof?.changedBoneCount ?? 0) <= 0) return 'BLOCKED_TRANSFORM_NOT_CHANGED';
    return 'VERIFIED_RETARGET_PLAYBACK';
  }

  if (retargetResult?.status === 'mapping_failed') return 'BLOCKED_MAPPING_FAILED';
  if (gateError?.includes('audit')) return 'BLOCKED_SKELETON_INVALID';
  return 'BLOCKED_MAPPING_FAILED';
}

export function runProductionMotionRetargetGate(input: {
  memberId: string;
  avatarRoot: Object3D;
  motionScene: Object3D;
  sourceClip: AnimationClip;
  skeletonAudit?: AvatarSkeletonRuntimeAudit;
  declaredMotionProfile?: SkeletonProfile;
  declaredAvatarProfile?: SkeletonProfile;
  requireDeclaredProfiles?: boolean;
}): ProductionMotionRetargetGateResult {
  const {
    memberId,
    avatarRoot,
    motionScene,
    sourceClip,
    skeletonAudit,
    declaredMotionProfile,
    declaredAvatarProfile,
    requireDeclaredProfiles = true,
  } = input;

  const binding = analyzeMotionClipBinding({ memberId, avatarRoot, clip: sourceClip });
  const motionClipAudit = auditMotionClip(sourceClip);

  const baseFail = (
    playbackPath: 'direct' | 'retargeted' | 'failed',
    finalStatus: ProductionMotionFinalStatus,
    error?: string,
    extra: Partial<ProductionMotionRetargetGateResult> = {},
  ): ProductionMotionRetargetGateResult => ({
    binding,
    skeletonAudit,
    motionClipAudit,
    avatarSkeletonProfile: 'UNKNOWN',
    motionSkeletonProfile: 'UNKNOWN',
    mappingRatio: binding.bindingRatio,
    mappedSemanticBones: {},
    retargetedClipValid: false,
    playbackPath,
    clip: sourceClip,
    error,
    finalStatus,
    ...extra,
  });

  if (!motionClipAudit.valid) {
    return baseFail('failed', 'BLOCKED_CLIP_INVALID', motionClipAudit.reasons.join('; '));
  }

  if (binding.bindingStatus === 'fully_bound') {
    return {
      binding,
      skeletonAudit,
      motionClipAudit,
      avatarSkeletonProfile: declaredAvatarProfile || 'UNKNOWN',
      motionSkeletonProfile: declaredMotionProfile || 'UNKNOWN',
      mappingRatio: binding.bindingRatio,
      mappedSemanticBones: {},
      retargetedClipValid: false,
      playbackPath: 'direct',
      clip: sourceClip,
      finalStatus: 'BLOCKED_TRANSFORM_NOT_CHANGED',
    };
  }

  if (skeletonAudit?.status === 'invalid' || skeletonAudit?.status === 'not_skinned') {
    return baseFail(
      'failed',
      'BLOCKED_SKELETON_INVALID',
      `avatar skeleton audit: ${skeletonAudit?.status}`,
    );
  }

  const sourceRuntime = extractSkeletonRuntimeFromScene(motionScene, `${memberId}:motion`);
  const targetRuntime = extractSkeletonRuntimeFromScene(avatarRoot, `${memberId}:avatar`);

  if (sourceRuntime?.definition) {
    getOrCacheSkeletonDefinition(
      `motion:${skeletonDefinitionKey(sourceRuntime.definition)}`,
      () => sourceRuntime.definition,
    );
  }
  if (targetRuntime?.definition) {
    getOrCacheSkeletonDefinition(
      `avatar:${skeletonDefinitionKey(targetRuntime.definition)}`,
      () => targetRuntime.definition,
    );
  }

  if (!sourceRuntime || !targetRuntime) {
    return baseFail(
      'failed',
      'BLOCKED_SKELETON_INVALID',
      !sourceRuntime ? 'source_skeleton_invalid' : 'target_skeleton_invalid',
    );
  }

  const detectedMotionProfile = detectSkeletonProfile(sourceRuntime.definition);
  const detectedAvatarProfile = detectSkeletonProfile(targetRuntime.definition);

  const motionProfileResolved = resolveDeclaredSkeletonProfile({
    declared: declaredMotionProfile,
    detected: detectedMotionProfile,
    requireDeclaration: requireDeclaredProfiles,
  });
  const avatarProfileResolved = resolveDeclaredSkeletonProfile({
    declared: declaredAvatarProfile,
    detected: detectedAvatarProfile,
    requireDeclaration: requireDeclaredProfiles,
  });

  if (!motionProfileResolved.supported || !avatarProfileResolved.supported) {
    return baseFail(
      'failed',
      'BLOCKED_SKELETON_PROFILE_UNSUPPORTED',
      motionProfileResolved.reason || avatarProfileResolved.reason,
      {
        avatarSkeletonProfile: avatarProfileResolved.profile,
        motionSkeletonProfile: motionProfileResolved.profile,
      },
    );
  }

  const mapping = computeSkeletonBoneMapping(
    sourceRuntime.definition,
    targetRuntime.definition,
  );
  const mappingRatio = targetRuntime.definition.bones.length > 0
    ? mapping.length / targetRuntime.definition.bones.length
    : 0;

  const skeletonValidation = validateProductionSkeleton({
    targetDefinition: targetRuntime.definition,
    sourceDefinition: sourceRuntime.definition,
    mapping,
    profile: avatarProfileResolved.profile,
    mappingRatio,
  });

  if (skeletonValidation.status !== 'valid') {
    const finalStatus = skeletonValidation.status === 'unsupported'
      ? 'BLOCKED_SKELETON_PROFILE_UNSUPPORTED'
      : skeletonValidation.missingRequiredBones.length
        ? 'BLOCKED_REQUIRED_BONE_MISSING'
        : 'BLOCKED_SKELETON_INVALID';
    return baseFail('failed', finalStatus, skeletonValidation.blockingReasons.join('; '), {
      avatarSkeletonProfile: avatarProfileResolved.profile,
      motionSkeletonProfile: motionProfileResolved.profile,
      skeletonValidation,
      mappingRatio,
      mappedSemanticBones: skeletonValidation.mappedSemanticBones,
    });
  }

  const retargeter = new DefaultAvatarMotionRetargeter();
  const retargetResult = getOrCacheRetargetResult(
    retargetCacheKey(sourceRuntime.definition, targetRuntime.definition, sourceClip),
    () => retargeter.retarget(
      sourceRuntime,
      targetRuntime,
      sourceClip,
      { minMappingRatio: 0.15 },
    ),
  );

  if (retargetResult.status !== 'retargeted' || !retargetResult.retargetedClip) {
    return baseFail('failed', 'BLOCKED_MAPPING_FAILED', retargetResult.status, {
      avatarSkeletonProfile: avatarProfileResolved.profile,
      motionSkeletonProfile: motionProfileResolved.profile,
      skeletonValidation,
      mappingRatio: retargetResult.mappingRatio,
      mappedSemanticBones: skeletonValidation.mappedSemanticBones,
      retargetResult,
    });
  }

  const clipValidation = validateRetargetedClip({
    retargetedClip: retargetResult.retargetedClip,
    sourceClip,
    targetBoneNames: targetRuntime.definition.bones.map((b) => b.name),
    mapping,
  });

  if (!clipValidation.valid) {
    return baseFail('failed', 'BLOCKED_CLIP_INVALID', clipValidation.reasons.join('; '), {
      avatarSkeletonProfile: avatarProfileResolved.profile,
      motionSkeletonProfile: motionProfileResolved.profile,
      skeletonValidation,
      mappingRatio: retargetResult.mappingRatio,
      mappedSemanticBones: skeletonValidation.mappedSemanticBones,
      retargetResult,
      retargetedClipValid: false,
      clip: retargetResult.retargetedClip,
    });
  }

  return {
    binding,
    skeletonAudit,
    motionClipAudit,
    avatarSkeletonProfile: avatarProfileResolved.profile,
    motionSkeletonProfile: motionProfileResolved.profile,
    skeletonValidation,
    mappingRatio: retargetResult.mappingRatio,
    mappedSemanticBones: skeletonValidation.mappedSemanticBones,
    retargetResult,
    retargetedClipValid: true,
    playbackPath: 'retargeted',
    clip: retargetResult.retargetedClip,
    finalStatus: 'BLOCKED_TRANSFORM_NOT_CHANGED',
  };
}

export default runProductionMotionRetargetGate;
