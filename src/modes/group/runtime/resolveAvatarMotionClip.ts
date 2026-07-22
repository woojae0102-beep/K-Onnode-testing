// @ts-nocheck
/**
 * Direct binding vs Retargeting pipeline (PHASE 8 gate).
 */
import * as THREE from 'three';
import type { AnimationClip } from 'three';
import { proveRetargetTransform } from './proveRetargetTransform';
import { proveAvatarMotionTransform } from './proveAvatarMotionTransform';
import { resolveAvatarAnimationRoot } from './resolveAvatarAnimationRoot';
import {
  runProductionMotionRetargetGate,
  computeProductionMotionFinalStatus,
} from './runProductionMotionRetargetGate';
import type {
  ProductionMotionFinalStatus,
  SkeletonProfile,
  SkeletonValidationResult,
} from '../types/ProductionSkeletonContract';
import type {
  RetargetResult,
  RetargetTransformProof,
  AvatarSkeletonRuntimeAudit,
} from '../types/skeletonRetargeting';
import type { MotionBindingDebugSnapshot, AvatarMotionTransformProof } from '../types/motionBindingDebug';

export type ResolvedAvatarMotionClip = {
  clip: AnimationClip;
  binding: MotionBindingDebugSnapshot;
  retargetResult?: RetargetResult;
  skeletonAudit?: AvatarSkeletonRuntimeAudit;
  skeletonValidation?: SkeletonValidationResult;
  avatarSkeletonProfile?: SkeletonProfile;
  motionSkeletonProfile?: SkeletonProfile;
  mappedSemanticBones?: Partial<Record<string, string>>;
  retargetedClipValid?: boolean;
  transformProof?: AvatarMotionTransformProof | RetargetTransformProof;
  playbackPath: 'direct' | 'retargeted' | 'failed';
  finalStatus: ProductionMotionFinalStatus;
  error?: string;
};

export function resolveAvatarMotionClip(input: {
  memberId: string;
  avatarRoot: THREE.Object3D;
  motionScene: THREE.Object3D;
  sourceClip: AnimationClip;
  skeletonAudit?: AvatarSkeletonRuntimeAudit;
  declaredMotionProfile?: SkeletonProfile;
  declaredAvatarProfile?: SkeletonProfile;
  requireDeclaredProfiles?: boolean;
}): ResolvedAvatarMotionClip {
  const gate = runProductionMotionRetargetGate(input);

  if (gate.playbackPath === 'failed') {
    return {
      clip: input.sourceClip,
      binding: gate.binding,
      skeletonAudit: gate.skeletonAudit,
      skeletonValidation: gate.skeletonValidation,
      avatarSkeletonProfile: gate.avatarSkeletonProfile,
      motionSkeletonProfile: gate.motionSkeletonProfile,
      mappedSemanticBones: gate.mappedSemanticBones,
      retargetResult: gate.retargetResult,
      retargetedClipValid: gate.retargetedClipValid,
      playbackPath: 'failed',
      finalStatus: gate.finalStatus,
      error: gate.error || gate.finalStatus,
    };
  }

  return {
    clip: gate.clip,
    binding: gate.binding,
    skeletonAudit: gate.skeletonAudit,
    skeletonValidation: gate.skeletonValidation,
    avatarSkeletonProfile: gate.avatarSkeletonProfile,
    motionSkeletonProfile: gate.motionSkeletonProfile,
    mappedSemanticBones: gate.mappedSemanticBones,
    retargetResult: gate.retargetResult,
    retargetedClipValid: gate.retargetedClipValid,
    playbackPath: gate.playbackPath,
    finalStatus: gate.finalStatus,
  };
}

export function runMotionPlaybackProof(input: {
  avatarRoot: THREE.Object3D;
  clip: AnimationClip;
  sampleBoneNames: string[];
  isRetargeted: boolean;
}): AvatarMotionTransformProof | RetargetTransformProof {
  const mixerRoot = resolveAvatarAnimationRoot(input.avatarRoot, input.clip);
  const mixer = new THREE.AnimationMixer(mixerRoot);
  const action = mixer.clipAction(input.clip, mixerRoot);
  action.play();
  action.paused = true;

  if (input.isRetargeted) {
    return proveRetargetTransform({
      avatarRoot: input.avatarRoot,
      mixer,
      action,
      sampleBoneNames: input.sampleBoneNames,
    });
  }

  return proveAvatarMotionTransform({
    avatarRoot: input.avatarRoot,
    mixer,
    action,
    sampleBoneNames: input.sampleBoneNames,
  });
}

export function finalizeAvatarMotionPlayback(input: {
  gateResult: ResolvedAvatarMotionClip;
  transformProof: AvatarMotionTransformProof | RetargetTransformProof;
}): ProductionMotionFinalStatus {
  return computeProductionMotionFinalStatus({
    playbackPath: input.gateResult.playbackPath,
    binding: input.gateResult.binding,
    skeletonValidation: input.gateResult.skeletonValidation,
    motionClipAudit: { valid: true, trackCount: input.gateResult.clip.tracks.length, durationSec: input.gateResult.clip.duration, reasons: [] },
    retargetResult: input.gateResult.retargetResult,
    retargetedClipValid: input.gateResult.retargetedClipValid ?? false,
    transformProof: input.transformProof,
    gateError: input.gateResult.error,
  });
}

export default resolveAvatarMotionClip;
