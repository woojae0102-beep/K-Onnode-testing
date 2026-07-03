// @ts-nocheck
/**
 * Avatar Retarget Engine — Quaternion 기반 GLB 본 회전 적용.
 * 좌표만으로는 GLB가 움직이지 않음 → boneRotations 필수.
 */
import * as THREE from 'three';
import type { ChoreographyJoint } from '../../types/groupChoreography';
import type { BoneQuaternion } from '../../utils/quaternionInterpolation';
import { RETARGET_BONE_SEGMENTS } from '../../utils/quaternionInterpolation';
import { applyJointsToSkeleton } from '../avatar/MotionRetargetingService';

function toThreeQuat(q: BoneQuaternion): THREE.Quaternion {
  return new THREE.Quaternion(q.x, q.y, q.z, q.w);
}

/**
 * 저장된 boneRotations → SkinnedMesh 본 quaternion SLERP.
 */
export function applyBoneRotationsToSkeleton(
  root: THREE.Object3D,
  boneRotations: Record<string, BoneQuaternion>,
  blend = 0.88,
) {
  if (!boneRotations || !Object.keys(boneRotations).length) return false;

  let skinned: THREE.SkinnedMesh | null = null;
  root.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh && !skinned) {
      skinned = child as THREE.SkinnedMesh;
    }
  });
  if (!skinned?.skeleton) return false;

  Object.entries(boneRotations).forEach(([boneKey, quat]) => {
    const bone = skinned!.skeleton.bones.find(
      (b) => b.name.toLowerCase().includes(boneKey.toLowerCase()) || b.name === boneKey,
    );
    if (!bone || !quat) return;
    bone.quaternion.slerp(toThreeQuat(quat), blend);
  });

  skinned.skeleton.update();
  return true;
}

/**
 * Quaternion 우선 · 좌표 폴백 GLB 리타겟.
 */
export function applyAvatarRetarget(
  root: THREE.Object3D,
  joints: Record<string, ChoreographyJoint>,
  boneRotations?: Record<string, BoneQuaternion> | null,
  stageScale = { width: 4, height: 3, depth: 2 },
) {
  if (boneRotations && applyBoneRotationsToSkeleton(root, boneRotations)) {
    applyJointsToSkeleton(root, joints, stageScale);
    return;
  }
  applyJointsToSkeleton(root, joints, stageScale);
}

export default applyAvatarRetarget;
