// @ts-nocheck
import * as THREE from 'three';
import type { AvatarMotionTransformProof } from '../types/motionBindingDebug';

const MIN_POSITION_DELTA = 1e-5;
const MIN_ROTATION_DELTA = 1e-4;

export type BoneTransformSample = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
};

export function snapshotBoneTransforms(
  root: THREE.Object3D,
  boneNames: string[],
): Map<string, BoneTransformSample> {
  const out = new Map<string, BoneTransformSample>();
  for (const name of boneNames) {
    const obj = root.getObjectByName(name);
    if (!obj) continue;
    out.set(name, {
      position: obj.position.clone(),
      quaternion: obj.quaternion.clone(),
      scale: obj.scale.clone(),
    });
  }
  return out;
}

export function proveAvatarMotionTransform(input: {
  avatarRoot: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  sampleBoneNames: string[];
  sampleDeltaSec?: number;
}): AvatarMotionTransformProof {
  const {
    avatarRoot,
    mixer,
    action,
    sampleBoneNames,
    sampleDeltaSec = 0.5,
  } = input;

  const validBones = sampleBoneNames.filter((n) => Boolean(avatarRoot.getObjectByName(n)));
  if (!validBones.length) {
    return {
      sampledBoneCount: 0,
      changedBoneCount: 0,
      maxPositionDelta: 0,
      maxRotationDelta: 0,
      transformProof: 'not_sampled',
    };
  }

  action.reset();
  action.play();
  action.paused = false;
  action.time = 0;
  mixer.update(0);
  const before = snapshotBoneTransforms(avatarRoot, validBones);

  action.time = sampleDeltaSec;
  mixer.update(0);
  const after = snapshotBoneTransforms(avatarRoot, validBones);

  let changedBoneCount = 0;
  let maxPositionDelta = 0;
  let maxRotationDelta = 0;

  for (const name of validBones) {
    const a = before.get(name);
    const b = after.get(name);
    if (!a || !b) continue;

    const posDelta = a.position.distanceTo(b.position);
    const rotDelta = 1 - Math.abs(a.quaternion.dot(b.quaternion));
    maxPositionDelta = Math.max(maxPositionDelta, posDelta);
    maxRotationDelta = Math.max(maxRotationDelta, rotDelta);

    if (posDelta > MIN_POSITION_DELTA || rotDelta > MIN_ROTATION_DELTA) {
      changedBoneCount += 1;
    }
  }

  return {
    sampledBoneCount: validBones.length,
    changedBoneCount,
    maxPositionDelta,
    maxRotationDelta,
    transformProof: changedBoneCount > 0 ? 'motion_detected' : 'no_transform_change',
  };
}

export default proveAvatarMotionTransform;
