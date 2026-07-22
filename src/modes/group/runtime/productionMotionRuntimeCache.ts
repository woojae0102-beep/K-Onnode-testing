// @ts-nocheck
/**
 * Production Group Motion Runtime cache layer (PHASE 16).
 * Same URL / same mapping / same retarget key — compute once, reuse read-only results.
 */
import type { AnimationClip } from 'three';
import type { SkeletonDefinition, SkeletonBoneMapping, RetargetResult } from '../types/skeletonRetargeting';
import type { ResolveMotionClipResult } from './resolveMotionAnimationClip';

export type ProductionMotionRuntimeMetrics = {
  avatarCount: number;
  mixerCount: number;
  activeActionCount: number;
  loadedGltfUrls: number;
  cachedGltfHits: number;
  cachedGltfMisses: number;
  cachedMotionClipHits: number;
  cachedMotionClipMisses: number;
  cachedRetargetHits: number;
  cachedRetargetMisses: number;
  cachedBoneMappingHits: number;
  cachedBoneMappingMisses: number;
  cachedSkeletonRuntimeHits: number;
  cachedSkeletonRuntimeMisses: number;
  averageUpdateTimeMs: number;
  peakUpdateTimeMs: number;
  memoryObjectCount: number;
  disposedMixerCount: number;
  failedLoadCount: number;
};

const gltfUrlRefCounts = new Map<string, number>();
const motionClipCache = new Map<string, ResolveMotionClipResult>();
const boneMappingCache = new Map<string, SkeletonBoneMapping[]>();
const skeletonDefinitionCache = new Map<string, SkeletonDefinition>();
const retargetResultCache = new Map<string, RetargetResult>();
const inflightRetarget = new Map<string, Promise<RetargetResult>>();

let cachedGltfHits = 0;
let cachedGltfMisses = 0;
let cachedMotionClipHits = 0;
let cachedMotionClipMisses = 0;
let cachedRetargetHits = 0;
let cachedRetargetMisses = 0;
let cachedBoneMappingHits = 0;
let cachedBoneMappingMisses = 0;
let cachedSkeletonRuntimeHits = 0;
let cachedSkeletonRuntimeMisses = 0;

let activeMixerCount = 0;
let activeActionCount = 0;
let disposedMixerCount = 0;
let failedLoadCount = 0;
let mountedAvatarCount = 0;

const updateTimeSamples: number[] = [];
const MAX_UPDATE_SAMPLES = 256;

export function skeletonDefinitionKey(def: SkeletonDefinition): string {
  return def.bones.map((b) => b.name).sort().join('|');
}

export function boneMappingCacheKey(source: SkeletonDefinition, target: SkeletonDefinition): string {
  return `${skeletonDefinitionKey(source)}::${skeletonDefinitionKey(target)}`;
}

export function retargetCacheKey(
  source: SkeletonDefinition,
  target: SkeletonDefinition,
  clip: AnimationClip,
): string {
  return `${skeletonDefinitionKey(source)}::${skeletonDefinitionKey(target)}::${clip.name}::${clip.duration}::${clip.tracks.length}`;
}

export function motionClipCacheKey(motionUrl: string, clipName: string | undefined, memberId: string): string {
  return `${motionUrl}::${clipName || ''}::${memberId}`;
}

export function recordGltfUrlAccess(url: string, fromCache: boolean): void {
  if (!url?.trim()) return;
  const key = url.trim();
  if (fromCache) {
    cachedGltfHits += 1;
  } else {
    cachedGltfMisses += 1;
  }
  gltfUrlRefCounts.set(key, (gltfUrlRefCounts.get(key) || 0) + 1);
}

export function releaseGltfUrlAccess(url: string): void {
  if (!url?.trim()) return;
  const key = url.trim();
  const next = (gltfUrlRefCounts.get(key) || 0) - 1;
  if (next <= 0) gltfUrlRefCounts.delete(key);
  else gltfUrlRefCounts.set(key, next);
}

export function getOrCacheMotionClipResolve(
  key: string,
  compute: () => ResolveMotionClipResult,
): ResolveMotionClipResult {
  if (motionClipCache.has(key)) {
    cachedMotionClipHits += 1;
    return motionClipCache.get(key)!;
  }
  cachedMotionClipMisses += 1;
  const result = compute();
  motionClipCache.set(key, result);
  return result;
}

export function getOrCacheSkeletonDefinition(
  key: string,
  compute: () => SkeletonDefinition | null,
): SkeletonDefinition | null {
  if (skeletonDefinitionCache.has(key)) {
    cachedSkeletonRuntimeHits += 1;
    return skeletonDefinitionCache.get(key)!;
  }
  cachedSkeletonRuntimeMisses += 1;
  const result = compute();
  if (result) skeletonDefinitionCache.set(key, result);
  return result;
}

export function getOrCacheBoneMapping(
  key: string,
  compute: () => SkeletonBoneMapping[],
): SkeletonBoneMapping[] {
  if (boneMappingCache.has(key)) {
    cachedBoneMappingHits += 1;
    return boneMappingCache.get(key)!;
  }
  cachedBoneMappingMisses += 1;
  const result = compute();
  boneMappingCache.set(key, result);
  return result;
}

export function getOrCacheRetargetResult(
  key: string,
  compute: () => RetargetResult,
): RetargetResult {
  if (retargetResultCache.has(key)) {
    cachedRetargetHits += 1;
    return retargetResultCache.get(key)!;
  }
  cachedRetargetMisses += 1;
  const result = compute();
  if (result.status === 'retargeted' && result.retargetedClip) {
    retargetResultCache.set(key, result);
  }
  return result;
}

export async function getOrCacheRetargetResultAsync(
  key: string,
  compute: () => RetargetResult | Promise<RetargetResult>,
): Promise<RetargetResult> {
  if (retargetResultCache.has(key)) {
    cachedRetargetHits += 1;
    return retargetResultCache.get(key)!;
  }
  if (inflightRetarget.has(key)) {
    cachedRetargetHits += 1;
    return inflightRetarget.get(key)!;
  }
  cachedRetargetMisses += 1;
  const promise = Promise.resolve(compute()).then((result) => {
    if (result.status === 'retargeted' && result.retargetedClip) {
      retargetResultCache.set(key, result);
    }
    inflightRetarget.delete(key);
    return result;
  });
  inflightRetarget.set(key, promise);
  return promise;
}

export function recordMixerCreated(actionCount = 1): void {
  activeMixerCount += 1;
  activeActionCount += actionCount;
}

export function recordMixerDisposed(actionCount = 1): void {
  activeMixerCount = Math.max(0, activeMixerCount - 1);
  activeActionCount = Math.max(0, activeActionCount - actionCount);
  disposedMixerCount += 1;
}

export function recordFailedLoad(): void {
  failedLoadCount += 1;
}

export function recordAvatarMounted(): void {
  mountedAvatarCount += 1;
}

export function recordAvatarUnmounted(): void {
  mountedAvatarCount = Math.max(0, mountedAvatarCount - 1);
}

export function recordMixerUpdateTimeMs(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  updateTimeSamples.push(ms);
  if (updateTimeSamples.length > MAX_UPDATE_SAMPLES) updateTimeSamples.shift();
}

export function getProductionMotionRuntimeMetrics(): ProductionMotionRuntimeMetrics {
  const sum = updateTimeSamples.reduce((a, b) => a + b, 0);
  const avg = updateTimeSamples.length ? sum / updateTimeSamples.length : 0;
  const peak = updateTimeSamples.length ? Math.max(...updateTimeSamples) : 0;

  return {
    avatarCount: mountedAvatarCount,
    mixerCount: activeMixerCount,
    activeActionCount,
    loadedGltfUrls: gltfUrlRefCounts.size,
    cachedGltfHits,
    cachedGltfMisses,
    cachedMotionClipHits,
    cachedMotionClipMisses,
    cachedRetargetHits,
    cachedRetargetMisses,
    cachedBoneMappingHits,
    cachedBoneMappingMisses,
    cachedSkeletonRuntimeHits,
    cachedSkeletonRuntimeMisses,
    averageUpdateTimeMs: avg,
    peakUpdateTimeMs: peak,
    memoryObjectCount:
      gltfUrlRefCounts.size
      + motionClipCache.size
      + boneMappingCache.size
      + skeletonDefinitionCache.size
      + retargetResultCache.size,
    disposedMixerCount,
    failedLoadCount,
  };
}

export function resetProductionMotionRuntimeCacheForTests(): void {
  gltfUrlRefCounts.clear();
  motionClipCache.clear();
  boneMappingCache.clear();
  skeletonDefinitionCache.clear();
  retargetResultCache.clear();
  inflightRetarget.clear();
  cachedGltfHits = 0;
  cachedGltfMisses = 0;
  cachedMotionClipHits = 0;
  cachedMotionClipMisses = 0;
  cachedRetargetHits = 0;
  cachedRetargetMisses = 0;
  cachedBoneMappingHits = 0;
  cachedBoneMappingMisses = 0;
  cachedSkeletonRuntimeHits = 0;
  cachedSkeletonRuntimeMisses = 0;
  activeMixerCount = 0;
  activeActionCount = 0;
  disposedMixerCount = 0;
  failedLoadCount = 0;
  mountedAvatarCount = 0;
  updateTimeSamples.length = 0;
}

export default getProductionMotionRuntimeMetrics;
