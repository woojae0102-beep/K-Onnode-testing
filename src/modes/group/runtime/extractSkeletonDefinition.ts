// @ts-nocheck
import * as THREE from 'three';
import type { SkeletonDefinition, SkeletonBoneEntry } from '../types/skeletonRetargeting';

export function boneToEntry(bone: THREE.Bone): SkeletonBoneEntry {
  return {
    name: bone.name,
    parentName: bone.parent?.isBone ? bone.parent.name : (bone.parent?.name || null),
    isBone: true,
    localPosition: bone.position.toArray() as [number, number, number],
    localQuaternion: bone.quaternion.toArray() as [number, number, number, number],
  };
}

/** 실제 THREE.Bone / Skeleton.bones 기준 — Object3D 이름만으로 bone 판정하지 않음 */
export function extractSkeletonDefinitionFromBones(
  skeletonId: string,
  bones: THREE.Bone[],
): SkeletonDefinition | null {
  const realBones = bones.filter((b) => b.isBone);
  if (!realBones.length) return null;

  const rootBone = realBones.find((b) => !b.parent?.isBone) || realBones[0];
  return {
    skeletonId,
    rootBoneName: rootBone.name,
    bones: realBones.map(boneToEntry),
  };
}

export function extractSkeletonDefinitionFromSkeleton(
  skeletonId: string,
  skeleton: THREE.Skeleton,
): SkeletonDefinition | null {
  if (!skeleton?.bones?.length) return null;
  return extractSkeletonDefinitionFromBones(skeletonId, skeleton.bones);
}

export default extractSkeletonDefinitionFromSkeleton;
