// @ts-nocheck
import * as THREE from 'three';
import type { RetargetTransformProof } from '../types/skeletonRetargeting';
import { snapshotBoneTransforms } from './proveAvatarMotionTransform';

const MIN_POSITION_DELTA = 1e-5;
const MIN_ROTATION_DELTA = 1e-4;

export function proveRetargetTransform(input: {
  avatarRoot: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  sampleBoneNames: string[];
  sampleDeltaSec?: number;
}): RetargetTransformProof {
  const {
    avatarRoot,
    mixer,
    action,
    sampleBoneNames,
    sampleDeltaSec = 0.1,
  } = input;

  const validBones = sampleBoneNames.filter((n) => Boolean(avatarRoot.getObjectByName(n)));
  if (!validBones.length) {
    return {
      sampledBoneCount: 0,
      changedBoneCount: 0,
      maxRotationDelta: 0,
      maxPositionDelta: 0,
      proof: 'not_sampled',
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
    maxRotationDelta,
    maxPositionDelta,
    proof: changedBoneCount > 0 ? 'retarget_motion_detected' : 'retarget_no_transform_change',
  };
}

export default proveRetargetTransform;
