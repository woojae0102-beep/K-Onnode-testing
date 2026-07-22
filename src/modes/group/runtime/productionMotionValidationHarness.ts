// @ts-nocheck
/**
 * Real Production Motion pair validation harness (PHASE 8).
 * fake asset 생성 금지 — caller가 실제 GLB scene/clip 제공.
 */
import * as THREE from 'three';
import type {
  ProductionMotionFinalStatus,
  SkeletonProfile,
  SkeletonValidationResult,
} from '../types/ProductionSkeletonContract';
import type { MotionBindingDebugSnapshot } from '../types/motionBindingDebug';
import type { AvatarSkeletonRuntimeAudit, RetargetResult } from '../types/skeletonRetargeting';
import { auditAvatarSkeletonClone } from './auditAvatarSkeleton';
import {
  runProductionMotionRetargetGate,
  computeProductionMotionFinalStatus,
  type MotionClipAudit,
} from './runProductionMotionRetargetGate';
import { runMotionPlaybackProof } from './resolveAvatarMotionClip';
import { extractTrackTargetNodeName, nodeExistsInHierarchy } from './analyzeMotionClipBinding';

export type ProductionMotionValidationInput = {
  memberId: string;
  avatarRoot: THREE.Object3D;
  motionScene: THREE.Object3D;
  sourceClip: THREE.AnimationClip;
  sourceAvatarScene?: THREE.Object3D;
  animationClipName?: string;
  declaredMotionProfile?: SkeletonProfile;
  declaredAvatarProfile?: SkeletonProfile;
  requireDeclaredProfiles?: boolean;
};

export type ProductionMotionValidationReport = {
  avatarSkeletonProfile: SkeletonProfile;
  motionSkeletonProfile: SkeletonProfile;
  bindingStatus: MotionBindingDebugSnapshot['bindingStatus'];
  motionBindingStrategy: MotionBindingDebugSnapshot['motionBindingStrategy'];
  requiredBoneValidation?: SkeletonValidationResult;
  mappingRatio: number;
  mappedSemanticBones: Partial<Record<string, string>>;
  missingRequiredBones: string[];
  retargetedClipValid: boolean;
  retargetedTrackCount: number;
  changedBoneCount: number;
  transformProof: string;
  finalStatus: ProductionMotionFinalStatus;
  motionClipAudit: MotionClipAudit;
  skeletonAudit?: AvatarSkeletonRuntimeAudit;
  retargetResult?: RetargetResult;
  playbackPath: 'direct' | 'retargeted' | 'failed';
};

export function validateProductionMotionPair(
  input: ProductionMotionValidationInput,
): ProductionMotionValidationReport {
  const {
    memberId,
    avatarRoot,
    motionScene,
    sourceClip,
    sourceAvatarScene,
    declaredMotionProfile,
    declaredAvatarProfile,
    requireDeclaredProfiles = true,
  } = input;

  const skeletonAudit = sourceAvatarScene
    ? auditAvatarSkeletonClone({
      memberId,
      sourceScene: sourceAvatarScene,
      clonedScene: avatarRoot,
    })
    : undefined;

  const gate = runProductionMotionRetargetGate({
    memberId,
    avatarRoot,
    motionScene,
    sourceClip,
    skeletonAudit,
    declaredMotionProfile,
    declaredAvatarProfile,
    requireDeclaredProfiles,
  });

  let transformProofValue = 'not_sampled';
  let changedBoneCount = 0;

  if (gate.playbackPath !== 'failed') {
    const sampleBoneNames = gate.playbackPath === 'retargeted'
      ? (gate.retargetResult?.mapping.map((m) => m.targetBoneName) || [])
      : [...new Set(
        sourceClip.tracks
          .map((t) => extractTrackTargetNodeName(t.name))
          .filter((n) => n && nodeExistsInHierarchy(avatarRoot, n)),
      )];

    const proof = runMotionPlaybackProof({
      avatarRoot,
      clip: gate.clip,
      sampleBoneNames,
      isRetargeted: gate.playbackPath === 'retargeted',
    });

    changedBoneCount = proof.changedBoneCount;
    transformProofValue = 'proof' in proof ? proof.proof : proof.transformProof;
  }

  const finalStatus = computeProductionMotionFinalStatus({
    playbackPath: gate.playbackPath,
    binding: gate.binding,
    skeletonValidation: gate.skeletonValidation,
    motionClipAudit: gate.motionClipAudit,
    retargetResult: gate.retargetResult,
    retargetedClipValid: gate.retargetedClipValid,
    transformProof: {
      proof: transformProofValue,
      transformProof: transformProofValue,
      changedBoneCount,
    },
    gateError: gate.error,
  });

  return {
    avatarSkeletonProfile: gate.avatarSkeletonProfile,
    motionSkeletonProfile: gate.motionSkeletonProfile,
    bindingStatus: gate.binding.bindingStatus,
    motionBindingStrategy: gate.binding.motionBindingStrategy,
    requiredBoneValidation: gate.skeletonValidation,
    mappingRatio: gate.mappingRatio,
    mappedSemanticBones: gate.mappedSemanticBones,
    missingRequiredBones: gate.skeletonValidation?.missingRequiredBones || [],
    retargetedClipValid: gate.retargetedClipValid,
    retargetedTrackCount: gate.retargetResult?.retargetedClip?.tracks.length ?? 0,
    changedBoneCount,
    transformProof: transformProofValue,
    finalStatus,
    motionClipAudit: gate.motionClipAudit,
    skeletonAudit,
    retargetResult: gate.retargetResult,
    playbackPath: gate.playbackPath,
  };
}

export default validateProductionMotionPair;
