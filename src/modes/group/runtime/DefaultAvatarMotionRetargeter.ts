// @ts-nocheck
/**
 * SkeletonUtils.retargetClip 기반 Avatar Motion Retargeter.
 */
import * as THREE from 'three';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarMotionRetargeter } from './AvatarMotionRetargeter';
import type {
  RetargetCapability,
  RetargetOptions,
  RetargetResult,
  SkeletonDefinition,
} from '../types/skeletonRetargeting';
import type { SkeletonRuntime } from './SkeletonRuntime';
import { computeSkeletonBoneMapping, mappingToRetargetNames } from './computeSkeletonBoneMapping';
import { validateRetargetedClip } from './validateRetargetedClip';
import { convertClipToSkeletonBoneTracks } from './convertClipToSkeletonBoneTracks';
import {
  boneMappingCacheKey,
  getOrCacheBoneMapping,
} from './productionMotionRuntimeCache';

const DEFAULT_MIN_MAPPING_RATIO = 0.2;

export class DefaultAvatarMotionRetargeter implements AvatarMotionRetargeter {
  canRetarget(source: SkeletonDefinition, target: SkeletonDefinition): RetargetCapability {
    const mapping = computeSkeletonBoneMapping(source, target);
    const ratio = target.bones.length > 0 ? mapping.length / target.bones.length : 0;
    return {
      canRetarget: mapping.length > 0,
      reason: mapping.length > 0 ? 'mapping available' : 'no bone mapping',
      estimatedMappingRatio: ratio,
    };
  }

  retarget(
    sourceSkeleton: SkeletonRuntime,
    targetSkeleton: SkeletonRuntime,
    motionClip: THREE.AnimationClip,
    options: RetargetOptions = {},
  ): RetargetResult {
    const minRatio = options.minMappingRatio ?? DEFAULT_MIN_MAPPING_RATIO;
    const sourceDef = sourceSkeleton.definition;
    const targetDef = targetSkeleton.definition;

    if (!sourceDef?.bones?.length) {
      return this.fail('source_skeleton_invalid', sourceDef, targetDef, []);
    }
    if (!targetDef?.bones?.length) {
      return this.fail('target_skeleton_invalid', sourceDef, targetDef, []);
    }

    const mapping = getOrCacheBoneMapping(
      boneMappingCacheKey(sourceDef, targetDef),
      () => computeSkeletonBoneMapping(sourceDef, targetDef, options.manualMappings || []),
    );
    const mappedBoneCount = mapping.length;
    const mappingRatio = targetDef.bones.length > 0
      ? mappedBoneCount / targetDef.bones.length
      : 0;

    if (mappedBoneCount === 0 || mappingRatio < minRatio) {
      return {
        status: 'mapping_failed',
        sourceBoneCount: sourceDef.bones.length,
        targetBoneCount: targetDef.bones.length,
        mappedBoneCount,
        mappingRatio,
        mapping,
      };
    }

    const names = mappingToRetargetNames(mapping);
    const sourceRoot = sourceSkeleton.skinnedMeshes[0] || sourceSkeleton.skeletonRoot;
    const targetRoot = targetSkeleton.skinnedMeshes[0] || targetSkeleton.skeletonRoot;
    const sourceBoneNames = sourceSkeleton.definition.bones.map((b) => b.name);
    const playbackClip = convertClipToSkeletonBoneTracks(motionClip, sourceBoneNames);

    let retargetedClip: THREE.AnimationClip;
    try {
      retargetedClip = retargetClip(
        targetRoot,
        sourceRoot,
        playbackClip,
        { names, hip: mapping.find((m) => /hip|pelvis/i.test(m.targetBoneName))?.targetBoneName },
      );
    } catch (err) {
      return {
        status: 'mapping_failed',
        sourceBoneCount: sourceDef.bones.length,
        targetBoneCount: targetDef.bones.length,
        mappedBoneCount,
        mappingRatio,
        mapping,
      };
    }

    const validation = validateRetargetedClip({
      retargetedClip,
      sourceClip: motionClip,
      targetBoneNames: targetDef.bones.map((b) => b.name),
      mapping,
    });

    if (!validation.valid || !retargetedClip.tracks.length) {
      return {
        status: 'mapping_failed',
        sourceBoneCount: sourceDef.bones.length,
        targetBoneCount: targetDef.bones.length,
        mappedBoneCount,
        mappingRatio,
        mapping,
      };
    }

    return {
      status: 'retargeted',
      retargetedClip,
      sourceBoneCount: sourceDef.bones.length,
      targetBoneCount: targetDef.bones.length,
      mappedBoneCount,
      mappingRatio,
      mapping,
    };
  }

  private fail(
    status: RetargetResult['status'],
    source: SkeletonDefinition | null,
    target: SkeletonDefinition | null,
    mapping: RetargetResult['mapping'],
  ): RetargetResult {
    return {
      status,
      sourceBoneCount: source?.bones.length ?? 0,
      targetBoneCount: target?.bones.length ?? 0,
      mappedBoneCount: 0,
      mappingRatio: 0,
      mapping,
    };
  }
}

export default DefaultAvatarMotionRetargeter;
