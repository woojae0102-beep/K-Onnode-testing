// @ts-nocheck
/**
 * Cache layer benchmark (PHASE 17 — read-only wraps, no runtime mutation).
 */
import * as THREE from 'three';
import {
  boneMappingCacheKey,
  getOrCacheBoneMapping,
  getOrCacheMotionClipResolve,
  getOrCacheRetargetResult,
  getOrCacheSkeletonDefinition,
  getProductionMotionRuntimeMetrics,
  motionClipCacheKey,
  resetProductionMotionRuntimeCacheForTests,
  retargetCacheKey,
  skeletonDefinitionKey,
} from '../runtime/productionMotionRuntimeCache';
import { resolveMotionAnimationClip } from '../runtime/resolveMotionAnimationClip';
import { computeSkeletonBoneMapping } from '../runtime/computeSkeletonBoneMapping';
import { extractSkeletonDefinitionFromBones } from '../runtime/extractSkeletonDefinition';
import { DefaultAvatarMotionRetargeter } from '../runtime/DefaultAvatarMotionRetargeter';
import { extractSkeletonRuntimeFromScene } from '../runtime/SkeletonRuntime';
import { buildMotionClip, buildSkinnedRig, buildAvatarRig } from './groupMotionSyntheticRuntime';

export type CacheLayerBenchmark = {
  layer: 'gltf' | 'motionClip' | 'retarget' | 'skeleton' | 'boneMapping';
  hits: number;
  misses: number;
  hitRatio: number | null;
  averageLookupTimeMs: number | null;
  averageBuildTimeMs: number | null;
};

export type CacheBenchmarkReport = {
  layers: CacheLayerBenchmark[];
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function ratio(hits: number, misses: number): number | null {
  const total = hits + misses;
  return total > 0 ? hits / total : null;
}

export function runGroupMotionCacheBenchmark(): CacheBenchmarkReport {
  resetProductionMotionRuntimeCacheForTests();

  const motionClipBuildTimes: number[] = [];
  const motionClipLookupTimes: number[] = [];
  const clip = buildMotionClip('mixamorig:Hips');
  const key = motionClipCacheKey('https://bench/cache-motion.glb', 'Dance', 'bench');
  let t0 = now();
  getOrCacheMotionClipResolve(key, () => {
    motionClipBuildTimes.push(now() - t0);
    return resolveMotionAnimationClip([clip], 'Dance', 'bench');
  });
  t0 = now();
  getOrCacheMotionClipResolve(key, () => {
    motionClipBuildTimes.push(now() - t0);
    return resolveMotionAnimationClip([clip], 'Dance', 'bench');
  });

  const motionRig = buildSkinnedRig(['Hips', 'Spine', 'LeftArm']);
  const avatarRig = buildAvatarRig(['Hips', 'Spine', 'Arm_L']);
  const sourceRuntime = extractSkeletonRuntimeFromScene(motionRig.root, 'src')!;
  const targetRuntime = extractSkeletonRuntimeFromScene(avatarRig.root, 'tgt')!;

  const skeletonBuildTimes: number[] = [];
  const skeletonLookupTimes: number[] = [];
  const skKey = `motion:${skeletonDefinitionKey(sourceRuntime.definition)}`;
  t0 = now();
  getOrCacheSkeletonDefinition(skKey, () => {
    skeletonBuildTimes.push(now() - t0);
    return sourceRuntime.definition;
  });
  t0 = now();
  getOrCacheSkeletonDefinition(skKey, () => {
    skeletonBuildTimes.push(now() - t0);
    return sourceRuntime.definition;
  });

  const mappingBuildTimes: number[] = [];
  const mappingLookupTimes: number[] = [];
  const mapKey = boneMappingCacheKey(sourceRuntime.definition, targetRuntime.definition);
  t0 = now();
  getOrCacheBoneMapping(mapKey, () => {
    mappingBuildTimes.push(now() - t0);
    return computeSkeletonBoneMapping(sourceRuntime.definition, targetRuntime.definition);
  });
  t0 = now();
  getOrCacheBoneMapping(mapKey, () => {
    mappingBuildTimes.push(now() - t0);
    return computeSkeletonBoneMapping(sourceRuntime.definition, targetRuntime.definition);
  });

  const retargetBuildTimes: number[] = [];
  const retargetLookupTimes: number[] = [];
  const retargeter = new DefaultAvatarMotionRetargeter();
  const rtKey = retargetCacheKey(sourceRuntime.definition, targetRuntime.definition, clip);
  t0 = now();
  getOrCacheRetargetResult(rtKey, () => {
    retargetBuildTimes.push(now() - t0);
    return retargeter.retarget(sourceRuntime, targetRuntime, clip);
  });
  t0 = now();
  getOrCacheRetargetResult(rtKey, () => {
    retargetBuildTimes.push(now() - t0);
    return retargeter.retarget(sourceRuntime, targetRuntime, clip);
  });

  const metrics = getProductionMotionRuntimeMetrics();
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return {
    layers: [
      {
        layer: 'gltf',
        hits: metrics.cachedGltfHits,
        misses: metrics.cachedGltfMisses,
        hitRatio: ratio(metrics.cachedGltfHits, metrics.cachedGltfMisses),
        averageLookupTimeMs: null,
        averageBuildTimeMs: null,
      },
      {
        layer: 'motionClip',
        hits: metrics.cachedMotionClipHits,
        misses: metrics.cachedMotionClipMisses,
        hitRatio: ratio(metrics.cachedMotionClipHits, metrics.cachedMotionClipMisses),
        averageLookupTimeMs: avg(motionClipLookupTimes),
        averageBuildTimeMs: avg(motionClipBuildTimes),
      },
      {
        layer: 'retarget',
        hits: metrics.cachedRetargetHits,
        misses: metrics.cachedRetargetMisses,
        hitRatio: ratio(metrics.cachedRetargetHits, metrics.cachedRetargetMisses),
        averageLookupTimeMs: avg(retargetLookupTimes),
        averageBuildTimeMs: avg(retargetBuildTimes),
      },
      {
        layer: 'skeleton',
        hits: metrics.cachedSkeletonRuntimeHits,
        misses: metrics.cachedSkeletonRuntimeMisses,
        hitRatio: ratio(metrics.cachedSkeletonRuntimeHits, metrics.cachedSkeletonRuntimeMisses),
        averageLookupTimeMs: avg(skeletonLookupTimes),
        averageBuildTimeMs: avg(skeletonBuildTimes),
      },
      {
        layer: 'boneMapping',
        hits: metrics.cachedBoneMappingHits,
        misses: metrics.cachedBoneMappingMisses,
        hitRatio: ratio(metrics.cachedBoneMappingHits, metrics.cachedBoneMappingMisses),
        averageLookupTimeMs: avg(mappingLookupTimes),
        averageBuildTimeMs: avg(mappingBuildTimes),
      },
    ],
  };
}

export default runGroupMotionCacheBenchmark;
