// @ts-nocheck
/**
 * Synthetic Group Motion runtime slot for benchmark/stress (PHASE 17).
 * Does NOT modify production runtime — standalone simulation using existing gate APIs.
 */
import * as THREE from 'three';
import { cloneAvatarScene } from '../runtime/auditAvatarSkeleton';
import { runProductionMotionRetargetGate } from '../runtime/runProductionMotionRetargetGate';
import { resolveAvatarAnimationRoot } from '../runtime/resolveAvatarAnimationRoot';
import { disposeProductionMotionMixer } from '../runtime/disposeProductionMotionMixer';
import {
  getOrCacheMotionClipResolve,
  motionClipCacheKey,
  recordAvatarMounted,
  recordAvatarUnmounted,
  recordGltfUrlAccess,
  recordMixerCreated,
  releaseGltfUrlAccess,
} from '../runtime/productionMotionRuntimeCache';
import { resolveMotionAnimationClip } from '../runtime/resolveMotionAnimationClip';

export function buildSkinnedRig(boneNames: string[], prefix = 'mixamorig') {
  const bones: THREE.Bone[] = boneNames.map((name) => {
    const bone = new THREE.Bone();
    bone.name = `${prefix}:${name}`;
    return bone;
  });
  for (let i = 1; i < bones.length; i++) {
    bones[i - 1].add(bones[i]);
    bones[i].position.y = 0.25;
  }
  const skeleton = new THREE.Skeleton(bones);
  const mesh = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshBasicMaterial(),
  );
  mesh.name = 'SkinnedMesh';
  mesh.add(bones[0]);
  mesh.bind(skeleton, new THREE.Matrix4());
  const root = new THREE.Group();
  root.add(mesh);
  return { root, skeleton, bones };
}

export function buildAvatarRig(boneNames: string[]) {
  return buildSkinnedRig(boneNames, 'Avatar');
}

export function buildMotionClip(boneName: string, name = 'Dance', duration = 2) {
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack(`${boneName}.position`, [0, duration], [0, 0, 0, 0, 0.5, 0]),
  ]);
}

export type SyntheticAvatarRuntimeSlot = {
  memberId: string;
  mixer: THREE.AnimationMixer;
  action: THREE.AnimationAction;
  mixerRoot: THREE.Object3D;
  playbackClip: THREE.AnimationClip;
  motionResolveMs: number;
  retargetMs: number;
  dispose: () => void;
};

export function createSyntheticAvatarRuntimeSlot(
  memberId: string,
  motionUrl: string,
  avatarUrl: string,
): SyntheticAvatarRuntimeSlot {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  recordGltfUrlAccess(avatarUrl, false);
  recordGltfUrlAccess(motionUrl, false);

  const motionRig = buildSkinnedRig(['Hips', 'Spine', 'LeftArm', 'RightArm']);
  const avatarRig = buildAvatarRig(['Hips', 'Spine', 'Arm_L', 'Arm_R']);
  const avatarClone = cloneAvatarScene(avatarRig.root);
  const motionSceneClone = motionRig.root.clone(true);
  const clip = buildMotionClip(motionRig.bones[0].name);

  const resolveStart = now();
  const resolved = getOrCacheMotionClipResolve(
    motionClipCacheKey(motionUrl, clip.name, memberId),
    () => resolveMotionAnimationClip([clip], clip.name, memberId),
  );
  const motionResolveMs = now() - resolveStart;

  const retargetStart = now();
  const gate = runProductionMotionRetargetGate({
    memberId,
    avatarRoot: avatarClone,
    motionScene: motionSceneClone,
    sourceClip: resolved.clip,
    declaredMotionProfile: 'MIXAMO',
    declaredAvatarProfile: 'MIXAMO',
    requireDeclaredProfiles: true,
  });
  const retargetMs = now() - retargetStart;

  const playbackClip = gate.playbackPath !== 'failed' ? gate.clip : resolved.clip;
  const mixerRoot = resolveAvatarAnimationRoot(avatarClone, playbackClip) || avatarClone;
  const mixer = new THREE.AnimationMixer(mixerRoot);
  const action = mixer.clipAction(playbackClip, mixerRoot);
  action.play();
  action.paused = true;
  recordMixerCreated(1);
  recordAvatarMounted();

  return {
    memberId,
    mixer,
    action,
    mixerRoot,
    playbackClip,
    motionResolveMs,
    retargetMs,
    dispose() {
      disposeProductionMotionMixer({
        mixer,
        root: mixerRoot,
        clip: playbackClip,
        actionCount: 1,
      });
      releaseGltfUrlAccess(avatarUrl);
      releaseGltfUrlAccess(motionUrl);
      recordAvatarUnmounted();
    },
  };
}

export default createSyntheticAvatarRuntimeSlot;
