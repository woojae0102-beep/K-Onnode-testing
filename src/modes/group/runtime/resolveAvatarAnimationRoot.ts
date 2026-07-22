// @ts-nocheck
import * as THREE from 'three';
import type { AnimationClip } from 'three';
import { extractRetargetTrackBoneName } from './validateRetargetedClip';

export function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((child) => {
    if (found) return;
    if ((child as THREE.SkinnedMesh).isSkinnedMesh && (child as THREE.SkinnedMesh).skeleton?.bones?.length) {
      found = child as THREE.SkinnedMesh;
    }
  });
  return found;
}

export function clipUsesSkeletonBoneTracks(clip: AnimationClip): boolean {
  return clip.tracks.some((t) => t.name.includes('.bones['));
}

export function resolveAvatarAnimationRoot(
  avatarRoot: THREE.Object3D,
  clip: AnimationClip,
): THREE.Object3D {
  if (clipUsesSkeletonBoneTracks(clip)) {
    return findPrimarySkinnedMesh(avatarRoot) || avatarRoot;
  }
  return avatarRoot;
}

export function collectSampleBoneNames(
  avatarRoot: THREE.Object3D,
  names: string[],
): string[] {
  return names.filter((name) => Boolean(avatarRoot.getObjectByName(name)));
}

export default resolveAvatarAnimationRoot;
