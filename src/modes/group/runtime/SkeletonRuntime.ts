// @ts-nocheck
import * as THREE from 'three';
import type { SkeletonDefinition } from '../types/skeletonRetargeting';
import { extractSkeletonDefinitionFromSkeleton, extractSkeletonDefinitionFromBones } from './extractSkeletonDefinition';

export type SkeletonRuntime = {
  root: THREE.Object3D;
  skinnedMeshes: THREE.SkinnedMesh[];
  skeleton: THREE.Skeleton;
  bones: THREE.Bone[];
  definition: SkeletonDefinition;
  /** retargetClip target/source — skeleton property holder */
  skeletonRoot: THREE.Object3D;
};

function createSkeletonRoot(skinnedMesh: THREE.SkinnedMesh): THREE.Object3D {
  const holder = new THREE.Group();
  holder.name = `SkeletonRoot_${skinnedMesh.name || 'mesh'}`;
  holder.skeleton = skinnedMesh.skeleton;
  return holder;
}

function createSkeletonRootFromSkeleton(name: string, skeleton: THREE.Skeleton): THREE.Object3D {
  const holder = new THREE.Group();
  holder.name = `SkeletonRoot_${name}`;
  holder.skeleton = skeleton;
  return holder;
}

function collectSceneBones(scene: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
  });
  return bones;
}

export function extractSkeletonRuntimeFromScene(
  scene: THREE.Object3D,
  skeletonId: string,
): SkeletonRuntime | null {
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes.push(child as THREE.SkinnedMesh);
    }
  });

  const primary = skinnedMeshes.find((m) => m.skeleton?.bones?.length) || null;
  if (primary?.skeleton) {
    const definition = extractSkeletonDefinitionFromSkeleton(skeletonId, primary.skeleton);
    if (!definition) return null;

    return {
      root: scene,
      skinnedMeshes,
      skeleton: primary.skeleton,
      bones: primary.skeleton.bones.filter((b) => b.isBone),
      definition,
      skeletonRoot: primary,
    };
  }

  const sceneBones = collectSceneBones(scene);
  if (!sceneBones.length) return null;

  const skeleton = new THREE.Skeleton(sceneBones);
  const definition = extractSkeletonDefinitionFromBones(skeletonId, sceneBones);
  if (!definition) return null;

  const holder = createSkeletonRootFromSkeleton(skeletonId, skeleton);
  return {
    root: scene,
    skinnedMeshes: [],
    skeleton,
    bones: sceneBones,
    definition,
    skeletonRoot: holder,
  };
}

export default extractSkeletonRuntimeFromScene;
