// @ts-nocheck
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarSkeletonRuntimeAudit } from '../types/skeletonRetargeting';

export function auditAvatarSkeletonClone(input: {
  memberId: string;
  sourceScene: THREE.Object3D;
  clonedScene: THREE.Object3D;
}): AvatarSkeletonRuntimeAudit {
  const { memberId, sourceScene, clonedScene } = input;

  const sourceMeshes: THREE.SkinnedMesh[] = [];
  const cloneMeshes: THREE.SkinnedMesh[] = [];

  sourceScene.traverse((c) => {
    if ((c as THREE.SkinnedMesh).isSkinnedMesh) sourceMeshes.push(c as THREE.SkinnedMesh);
  });
  clonedScene.traverse((c) => {
    if ((c as THREE.SkinnedMesh).isSkinnedMesh) cloneMeshes.push(c as THREE.SkinnedMesh);
  });

  if (!sourceMeshes.length) {
    return {
      memberId,
      skinnedMeshCount: 0,
      skeletonCount: 0,
      totalBoneCount: 0,
      validSkeletonReference: false,
      sharesBoneReferenceWithSource: false,
      status: 'not_skinned',
    };
  }

  let totalBoneCount = 0;
  let validSkeletonReference = true;
  let sharesBoneReferenceWithSource = false;

  for (const mesh of cloneMeshes) {
    if (!mesh.skeleton?.bones?.length) {
      validSkeletonReference = false;
      continue;
    }
    totalBoneCount += mesh.skeleton.bones.length;

    for (const bone of mesh.skeleton.bones) {
      let inCloneHierarchy = false;
      clonedScene.traverse((o) => { if (o === bone) inCloneHierarchy = true; });
      if (!inCloneHierarchy) validSkeletonReference = false;
    }

    const sourceMesh = sourceMeshes.find((s) => s.name === mesh.name) || sourceMeshes[0];
    if (sourceMesh?.skeleton) {
      for (let i = 0; i < Math.min(mesh.skeleton.bones.length, sourceMesh.skeleton.bones.length); i++) {
        if (mesh.skeleton.bones[i] === sourceMesh.skeleton.bones[i]) {
          sharesBoneReferenceWithSource = true;
        }
      }
    }
  }

  const status = validSkeletonReference && !sharesBoneReferenceWithSource && cloneMeshes.length > 0
    ? 'valid'
    : 'invalid';

  return {
    memberId,
    skinnedMeshCount: cloneMeshes.length,
    skeletonCount: cloneMeshes.filter((m) => m.skeleton).length,
    totalBoneCount,
    validSkeletonReference,
    sharesBoneReferenceWithSource,
    status,
  };
}

export function cloneAvatarScene(source: THREE.Object3D): THREE.Object3D {
  const hasSkinned = source.children.some?.((c) => (c as THREE.SkinnedMesh).isSkinnedMesh);
  let skinned = false;
  source.traverse((c) => { if ((c as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
  if (skinned) {
    return skeletonClone(source);
  }
  return source.clone(true);
}

export default auditAvatarSkeletonClone;
