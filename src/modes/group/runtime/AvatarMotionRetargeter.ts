// @ts-nocheck
/**
 * Avatar Motion Retargeting contract (PHASE 7).
 */
import type { AnimationClip } from 'three';
import type {
  RetargetCapability,
  RetargetOptions,
  RetargetResult,
  SkeletonDefinition,
} from '../types/skeletonRetargeting';
import type { SkeletonRuntime } from './SkeletonRuntime';

export interface AvatarMotionRetargeter {
  canRetarget(
    source: SkeletonDefinition,
    target: SkeletonDefinition,
  ): RetargetCapability;

  retarget(
    sourceSkeleton: SkeletonRuntime,
    targetSkeleton: SkeletonRuntime,
    motionClip: AnimationClip,
    options?: RetargetOptions,
  ): RetargetResult;
}

export default AvatarMotionRetargeter;
