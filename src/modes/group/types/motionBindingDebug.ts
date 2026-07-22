// @ts-nocheck
/**
 * Group Mode — Motion clip ↔ Avatar bone binding debug (skeleton frame data 아님).
 */

export type MotionBindingStatus =
  | 'not_checked'
  | 'fully_bound'
  | 'partially_bound'
  | 'unbound';

export type MotionBindingStrategy =
  | 'DIRECT_BINDING'
  | 'PARTIAL_BINDING'
  | 'RETARGET_REQUIRED';

export type AvatarMotionTransformProofStatus =
  | 'motion_detected'
  | 'no_transform_change'
  | 'not_sampled';

export type MotionBindingDebugSnapshot = {
  memberId: string;
  avatarRootName: string;
  avatarHasSkeleton: boolean;
  avatarBoneNames: string[];
  motionClipName: string;
  motionTrackCount: number;
  motionTrackTargetNames: string[];
  matchedTrackCount: number;
  unmatchedTrackCount: number;
  unmatchedTrackTargets: string[];
  bindingRatio: number;
  bindingStatus: MotionBindingStatus;
  motionBindingStrategy: MotionBindingStrategy;
};

export type AvatarMotionTransformProof = {
  sampledBoneCount: number;
  changedBoneCount: number;
  maxPositionDelta: number;
  maxRotationDelta: number;
  transformProof: AvatarMotionTransformProofStatus;
};

export default MotionBindingDebugSnapshot;
