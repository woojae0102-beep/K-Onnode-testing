// @ts-nocheck
/**
 * Group Mode — skeleton retargeting types (SkeletonFrameData 아님).
 */
import type { AnimationClip } from 'three';

export type SkeletonBoneEntry = {
  name: string;
  parentName: string | null;
  isBone: true;
  localPosition: [number, number, number];
  localQuaternion: [number, number, number, number];
};

export type SkeletonDefinition = {
  skeletonId: string;
  rootBoneName: string;
  bones: SkeletonBoneEntry[];
};

export type SkeletonBoneMapping = {
  sourceBoneName: string;
  targetBoneName: string;
  confidence: number;
  mappingMethod: 'EXACT_NAME' | 'NORMALIZED_NAME' | 'PROFILE' | 'MANUAL_PROFILE';
};

export type RetargetCapability = {
  canRetarget: boolean;
  reason: string;
  estimatedMappingRatio: number;
};

export type RetargetOptions = {
  minMappingRatio?: number;
  minTransformChangedBones?: number;
  hipBoneName?: string;
  manualMappings?: SkeletonBoneMapping[];
};

export type RetargetResultStatus =
  | 'retargeted'
  | 'mapping_failed'
  | 'source_skeleton_invalid'
  | 'target_skeleton_invalid';

export type RetargetResult = {
  status: RetargetResultStatus;
  retargetedClip?: AnimationClip;
  sourceBoneCount: number;
  targetBoneCount: number;
  mappedBoneCount: number;
  mappingRatio: number;
  mapping: SkeletonBoneMapping[];
};

export type RetargetTransformProofStatus =
  | 'retarget_motion_detected'
  | 'retarget_no_transform_change'
  | 'not_sampled';

export type RetargetTransformProof = {
  sampledBoneCount: number;
  changedBoneCount: number;
  maxRotationDelta: number;
  maxPositionDelta: number;
  proof: RetargetTransformProofStatus;
};

export type AvatarSkeletonRuntimeAuditStatus = 'valid' | 'invalid' | 'not_skinned';

export type AvatarSkeletonRuntimeAudit = {
  memberId: string;
  skinnedMeshCount: number;
  skeletonCount: number;
  totalBoneCount: number;
  validSkeletonReference: boolean;
  sharesBoneReferenceWithSource: boolean;
  status: AvatarSkeletonRuntimeAuditStatus;
};

export default SkeletonDefinition;
