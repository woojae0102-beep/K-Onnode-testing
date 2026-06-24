// @ts-nocheck
import * as THREE from 'three';
import type { ChoreographyJoint } from '../../types/groupChoreography';

/** MediaPipe 관절 → Mixamo/RPM 본 이름 매핑 */
const BONE_MAP: Record<string, string[]> = {
  hips: ['left_hip', 'right_hip'],
  spine: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
  leftArm: ['left_shoulder', 'left_elbow'],
  leftForeArm: ['left_elbow', 'left_wrist'],
  rightArm: ['right_shoulder', 'right_elbow'],
  rightForeArm: ['right_elbow', 'right_wrist'],
  leftUpLeg: ['left_hip', 'left_knee'],
  leftLeg: ['left_knee', 'left_ankle'],
  rightUpLeg: ['right_hip', 'right_knee'],
  rightLeg: ['right_knee', 'right_ankle'],
  head: ['nose', 'left_shoulder', 'right_shoulder'],
};

function jointVec(a: ChoreographyJoint, b: ChoreographyJoint) {
  return new THREE.Vector3(b.x - a.x, -(b.y - a.y), (b.z ?? 0) - (a.z ?? 0));
}

function applyBoneRotation(
  skeleton: THREE.Skeleton,
  boneName: string,
  fromJoint: ChoreographyJoint,
  toJoint: ChoreographyJoint,
) {
  const bone = skeleton.bones.find(
    (b) => b.name.toLowerCase().includes(boneName.toLowerCase()) || b.name === boneName,
  );
  if (!bone) return;

  const dir = jointVec(fromJoint, toJoint);
  if (dir.lengthSq() < 1e-6) return;
  dir.normalize();

  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  bone.quaternion.slerp(quat, 0.85);
}

/**
 * Skeleton 관절 좌표를 humanoid GLB 본 회전에 적용 (기본 리타겟)
 * Foot sliding 완화: 발목 y를 바닥(y=0)에 클램프
 */
export function applyJointsToSkeleton(
  root: THREE.Object3D,
  joints: Record<string, ChoreographyJoint>,
  stageScale = { width: 4, height: 3, depth: 2 },
) {
  let skinned: THREE.SkinnedMesh | null = null;
  root.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh && !skinned) {
      skinned = child as THREE.SkinnedMesh;
    }
  });
  if (!skinned?.skeleton) return;

  const normalized: Record<string, ChoreographyJoint> = {};
  Object.entries(joints).forEach(([name, j]) => {
    normalized[name] = {
      x: (j.x - 0.5) * stageScale.width,
      y: -(j.y - 0.5) * stageScale.height,
      z: (j.z ?? 0) * stageScale.depth,
      visibility: j.visibility,
    };
  });

  Object.entries(BONE_MAP).forEach(([boneKey, [fromName, toName]]) => {
    const from = normalized[fromName];
    const to = normalized[toName];
    if (from && to) applyBoneRotation(skinned!.skeleton, boneKey, from, to);
  });

  ['left_ankle', 'right_ankle'].forEach((ankleName) => {
    const ankle = normalized[ankleName];
    if (ankle && ankle.y < -stageScale.height * 0.45) {
      ankle.y = -stageScale.height * 0.45;
    }
  });

  skinned.skeleton.update();
}

export function normalizedJointsToWorld(
  joints: Record<string, ChoreographyJoint>,
  stageScale = { width: 4, height: 3, depth: 2 },
) {
  const out: Record<string, ChoreographyJoint> = {};
  Object.entries(joints).forEach(([name, j]) => {
    out[name] = {
      x: (j.x - 0.5) * stageScale.width,
      y: -(j.y - 0.5) * stageScale.height,
      z: (j.z ?? 0) * stageScale.depth,
      visibility: j.visibility,
    };
  });
  return out;
}

export default { applyJointsToSkeleton, normalizedJointsToWorld };
