// @ts-nocheck
/**
 * Motion retargeting tests (TEST 31~36)
 * Run: npx tsx src/modes/group/runtime/motionRetargeting.test.ts
 */
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { auditAvatarSkeletonClone, cloneAvatarScene } from './auditAvatarSkeleton';
import { computeSkeletonBoneMapping } from './computeSkeletonBoneMapping';
import { extractSkeletonDefinitionFromBones } from './extractSkeletonDefinition';
import { extractSkeletonRuntimeFromScene } from './SkeletonRuntime';
import { DefaultAvatarMotionRetargeter } from './DefaultAvatarMotionRetargeter';
import { validateRetargetedClip } from './validateRetargetedClip';
import { proveRetargetTransform } from './proveRetargetTransform';
import { sidesCompatible, detectBoneSide } from './normalizeBoneName';
import { resolveAvatarMotionClip } from './resolveAvatarMotionClip';
import { resolveAvatarAnimationRoot } from './resolveAvatarAnimationRoot';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildSkinnedRig(boneNames: string[]) {
  const bones: THREE.Bone[] = boneNames.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    return bone;
  });
  for (let i = 1; i < bones.length; i++) {
    bones[i - 1].add(bones[i]);
    bones[i].position.y = 0.25;
  }

  const skeleton = new THREE.Skeleton(bones);
  const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const mat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = `Skinned_${boneNames[0]}`;
  mesh.add(bones[0]);
  mesh.bind(skeleton, new THREE.Matrix4());

  const root = new THREE.Group();
  root.name = 'RigRoot';
  root.add(mesh);
  return { root, mesh, skeleton, bones };
}

function buildMotionClip(sourceBoneName: string, duration = 1) {
  return new THREE.AnimationClip('MotionClip', duration, [
    new THREE.VectorKeyframeTrack(
      `${sourceBoneName}.position`,
      [0, duration],
      [0, 0, 0, 0, 0.8, 0],
    ),
    new THREE.QuaternionKeyframeTrack(
      `${sourceBoneName}.quaternion`,
      [0, duration],
      [0, 0, 0, 1, 0, 0.5, 0, 0.866],
    ),
  ]);
}

function test31SkeletonCloneAudit() {
  const { root, mesh } = buildSkinnedRig(['Hips', 'Spine']);
  const cloned = cloneAvatarScene(root);
  const audit = auditAvatarSkeletonClone({
    memberId: 't31',
    sourceScene: root,
    clonedScene: cloned,
  });
  assert(audit.skinnedMeshCount === 1, 'TEST 31 skinned mesh count');
  assert(audit.totalBoneCount >= 2, 'TEST 31 bone count');
  assert(audit.validSkeletonReference, 'TEST 31 valid skeleton ref');
  assert(!audit.sharesBoneReferenceWithSource, 'TEST 31 no shared bones');
  assert(audit.status === 'valid', `TEST 31 status=${audit.status}`);

  let cloneMesh: THREE.SkinnedMesh | null = null;
  cloned.traverse((c) => { if ((c as THREE.SkinnedMesh).isSkinnedMesh) cloneMesh = c as THREE.SkinnedMesh; });
  assert(cloneMesh?.skeleton !== mesh.skeleton, 'TEST 31 skeleton instance differs');
  console.log('TEST 31: PASS');
}

function test32NormalizedMappingNoSideFlip() {
  const srcLeft = new THREE.Bone();
  srcLeft.name = 'mixamorig:LeftArm';
  const srcRight = new THREE.Bone();
  srcRight.name = 'mixamorig:RightArm';
  const tgtLeft = new THREE.Bone();
  tgtLeft.name = 'Arm_L';
  const tgtRight = new THREE.Bone();
  tgtRight.name = 'Arm_R';

  const source = extractSkeletonDefinitionFromBones('src', [srcLeft, srcRight]);
  const target = extractSkeletonDefinitionFromBones('tgt', [tgtLeft, tgtRight]);

  const mapping = computeSkeletonBoneMapping(source!, target!);
  const leftMap = mapping.find((m) => m.targetBoneName === 'Arm_L');
  const rightMap = mapping.find((m) => m.targetBoneName === 'Arm_R');
  assert(leftMap?.sourceBoneName === 'mixamorig:LeftArm', 'TEST 32 left map');
  assert(rightMap?.sourceBoneName === 'mixamorig:RightArm', 'TEST 32 right map');
  assert(!sidesCompatible(detectBoneSide('LeftArm'), detectBoneSide('RightArm')), 'TEST 32 side guard');
  console.log('TEST 32: PASS');
}

function test33RetargetClipGeneration() {
  const sourceRig = buildSkinnedRig(['mixamorig:Hips', 'mixamorig:Spine']);
  const targetRig = buildSkinnedRig(['Hips', 'Spine']);
  const clip = buildMotionClip('mixamorig:Hips');

  const sourceRuntime = extractSkeletonRuntimeFromScene(sourceRig.root, 'src')!;
  const targetRuntime = extractSkeletonRuntimeFromScene(targetRig.root, 'tgt')!;
  const retargeter = new DefaultAvatarMotionRetargeter();

  const capability = retargeter.canRetarget(sourceRuntime.definition, targetRuntime.definition);
  assert(capability.canRetarget, 'TEST 33 canRetarget');

  const result = retargeter.retarget(sourceRuntime, targetRuntime, clip, { minMappingRatio: 0.2 });
  assert(result.status === 'retargeted', `TEST 33 status=${result.status}`);
  assert(result.retargetedClip && result.retargetedClip.tracks.length > 0, 'TEST 33 tracks');
  assert(result.retargetedClip.duration > 0, 'TEST 33 duration');

  const validation = validateRetargetedClip({
    retargetedClip: result.retargetedClip!,
    sourceClip: clip,
    targetBoneNames: targetRuntime.definition.bones.map((b) => b.name),
    mapping: result.mapping,
  });
  assert(validation.valid, `TEST 33 validation: ${validation.reasons.join(', ')}`);
  console.log('TEST 33: PASS');
}

function test34RetargetTransformProof() {
  const sourceRig = buildSkinnedRig(['mixamorig:Hips', 'mixamorig:Spine']);
  const targetRig = buildSkinnedRig(['Hips', 'Spine']);
  const clip = buildMotionClip('mixamorig:Hips');

  const sourceRuntime = extractSkeletonRuntimeFromScene(sourceRig.root, 'src')!;
  const targetRuntime = extractSkeletonRuntimeFromScene(targetRig.root, 'tgt')!;
  const retargeter = new DefaultAvatarMotionRetargeter();
  const result = retargeter.retarget(sourceRuntime, targetRuntime, clip, { minMappingRatio: 0.2 });
  assert(result.status === 'retargeted', `TEST 34 retarget ${result.status}`);

  const avatarRoot = skeletonClone(targetRig.root);
  const mixerRoot = resolveAvatarAnimationRoot(avatarRoot, result.retargetedClip!);
  const mixer = new THREE.AnimationMixer(mixerRoot);
  const action = mixer.clipAction(result.retargetedClip!, mixerRoot);
  const proof = proveRetargetTransform({
    avatarRoot,
    mixer,
    action,
    sampleBoneNames: ['Hips', 'Spine'],
    sampleDeltaSec: 0.5,
  });

  assert(proof.proof === 'retarget_motion_detected', `TEST 34 proof=${proof.proof}`);
  assert(proof.changedBoneCount > 0, 'TEST 34 changed bones');
  console.log('TEST 34: PASS');
}

function test35InvalidSkeletonBlocksRetarget() {
  const sourceRig = buildSkinnedRig(['mixamorig:Hips']);
  const targetRig = buildSkinnedRig(['Hips']);
  const clip = buildMotionClip('mixamorig:Hips');

  const badAudit = {
    memberId: 't35',
    skinnedMeshCount: 1,
    skeletonCount: 1,
    totalBoneCount: 1,
    validSkeletonReference: false,
    sharesBoneReferenceWithSource: true,
    status: 'invalid' as const,
  };

  const resolved = resolveAvatarMotionClip({
    memberId: 't35',
    avatarRoot: targetRig.root,
    motionScene: sourceRig.root,
    sourceClip: clip,
    skeletonAudit: badAudit,
    requireDeclaredProfiles: false,
  });
  assert(resolved.playbackPath === 'failed', 'TEST 35 blocked');
  assert(resolved.error?.includes('invalid'), 'TEST 35 invalid audit');
  console.log('TEST 35: PASS');
}

function test36MappingFailedLowRatio() {
  const sourceRig = buildSkinnedRig(['X_A', 'X_B']);
  const targetRig = buildSkinnedRig(['Y_1', 'Y_2', 'Y_3', 'Y_4']);
  const clip = buildMotionClip('X_A');

  const sourceRuntime = extractSkeletonRuntimeFromScene(sourceRig.root, 'src')!;
  const targetRuntime = extractSkeletonRuntimeFromScene(targetRig.root, 'tgt')!;
  const retargeter = new DefaultAvatarMotionRetargeter();
  const result = retargeter.retarget(sourceRuntime, targetRuntime, clip, { minMappingRatio: 0.5 });
  assert(result.status === 'mapping_failed', `TEST 36 status=${result.status}`);
  console.log('TEST 36: PASS');
}

async function run() {
  test31SkeletonCloneAudit();
  test32NormalizedMappingNoSideFlip();
  test33RetargetClipGeneration();
  test34RetargetTransformProof();
  test35InvalidSkeletonBlocksRetarget();
  test36MappingFailedLowRatio();
  console.log('motionRetargeting tests: ALL PASS (TEST 31~36)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
