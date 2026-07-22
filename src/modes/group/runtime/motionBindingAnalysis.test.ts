// @ts-nocheck
/**
 * Motion binding + transform proof tests (TEST 23~30)
 * Run: npx tsx src/modes/group/runtime/motionBindingAnalysis.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import * as THREE from 'three';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  analyzeMotionClipBinding,
  extractTrackTargetNodeName,
} from './analyzeMotionClipBinding';
import { proveAvatarMotionTransform } from './proveAvatarMotionTransform';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';
import { MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST } from '../fixtures/productionMotionTestContract';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildAvatar(boneNames: string[]) {
  const root = new THREE.Group();
  root.name = 'TestAvatarRoot';
  for (const name of boneNames) {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
  }
  return root;
}

function buildClip(
  name: string,
  trackDefs: Array<{ target: string; property: 'position' | 'quaternion' }>,
  duration = 1,
) {
  const tracks = trackDefs.map(({ target, property }) => {
    const trackName = `${target}.${property}`;
    if (property === 'position') {
      return new THREE.VectorKeyframeTrack(
        trackName,
        [0, duration],
        [0, 0, 0, 1, 0.5, 0],
      );
    }
    return new THREE.QuaternionKeyframeTrack(
      trackName,
      [0, duration],
      [0, 0, 0, 1, 0, 0.707, 0, 0.707],
    );
  });
  return new THREE.AnimationClip(name, duration, tracks);
}

function test23FullyBindable() {
  const avatar = buildAvatar(['Hips', 'Spine']);
  const clip = buildClip('FullyBindable', [
    { target: 'Hips', property: 'position' },
    { target: 'Spine', property: 'quaternion' },
  ]);
  const result = analyzeMotionClipBinding({ memberId: 't23', avatarRoot: avatar, clip });
  assert(result.bindingStatus === 'fully_bound', `TEST 23: ${result.bindingStatus}`);
  assert(result.motionBindingStrategy === 'DIRECT_BINDING', 'TEST 23 strategy');
  assert(result.bindingRatio === 1, 'TEST 23 ratio');
  console.log('TEST 23: PASS');
}

function test24PartiallyBindable() {
  const avatar = buildAvatar(['Hips', 'Spine']);
  const clip = buildClip('Partial', [
    { target: 'Hips', property: 'position' },
    { target: 'AlienBone', property: 'quaternion' },
    { target: 'OtherBone', property: 'position' },
  ]);
  const result = analyzeMotionClipBinding({ memberId: 't24', avatarRoot: avatar, clip });
  assert(result.bindingStatus === 'partially_bound', `TEST 24: ${result.bindingStatus}`);
  assert(result.motionBindingStrategy === 'PARTIAL_BINDING', 'TEST 24 strategy');
  assert(result.matchedTrackCount === 1 && result.motionTrackCount === 3, 'TEST 24 counts');
  console.log('TEST 24: PASS');
}

function test25Unbound() {
  const avatar = buildAvatar(['Hips', 'Spine']);
  const clip = buildClip('Unbound', [
    { target: 'Xbot_L_Hip', property: 'position' },
    { target: 'Xbot_R_Hip', property: 'quaternion' },
  ]);
  const result = analyzeMotionClipBinding({ memberId: 't25', avatarRoot: avatar, clip });
  assert(result.bindingStatus === 'unbound', `TEST 25: ${result.bindingStatus}`);
  assert(result.motionBindingStrategy === 'RETARGET_REQUIRED', 'TEST 25 strategy');
  assert(result.bindingRatio === 0, 'TEST 25 ratio');
  console.log('TEST 25: PASS');
}

function test26TransformProofMotionDetected() {
  const avatar = buildAvatar(['Hips']);
  const clip = buildClip('Motion', [{ target: 'Hips', property: 'position' }]);
  const mixer = new THREE.AnimationMixer(avatar);
  const action = mixer.clipAction(clip);
  action.play();
  const proof = proveAvatarMotionTransform({
    avatarRoot: avatar,
    mixer,
    action,
    sampleBoneNames: ['Hips'],
    sampleDeltaSec: 0.5,
  });
  assert(proof.transformProof === 'motion_detected', `TEST 26: ${proof.transformProof}`);
  assert(proof.changedBoneCount > 0, 'TEST 26 changed bones');
  console.log('TEST 26: PASS');
}

function test27UnboundTransformProof() {
  const avatar = buildAvatar(['Hips']);
  const clip = buildClip('Unbound', [{ target: 'Alien', property: 'position' }]);
  const binding = analyzeMotionClipBinding({ memberId: 't27', avatarRoot: avatar, clip });
  assert(binding.bindingStatus === 'unbound', 'TEST 27 binding');
  const mixer = new THREE.AnimationMixer(avatar);
  const action = mixer.clipAction(clip);
  action.play();
  const proof = proveAvatarMotionTransform({
    avatarRoot: avatar,
    mixer,
    action,
    sampleBoneNames: [],
    sampleDeltaSec: 0.5,
  });
  assert(
    proof.transformProof === 'not_sampled' || proof.transformProof === 'no_transform_change',
    `TEST 27: ${proof.transformProof}`,
  );
  assert(binding.motionBindingStrategy === 'RETARGET_REQUIRED', 'TEST 27 no direct binding');
  console.log('TEST 27: PASS');
}

function test28MemberIsolation() {
  const motionAsset = productionMotionAssetV2ToGroupMotionAsset(MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST);
  const cases = [
    { selected: 'member_a', visible: ['member_b', 'member_c', 'member_d'] },
    { selected: 'member_b', visible: ['member_a', 'member_c', 'member_d'] },
    { selected: 'member_c', visible: ['member_a', 'member_b', 'member_d'] },
    { selected: 'member_d', visible: ['member_a', 'member_b', 'member_c'] },
  ];
  for (const c of cases) {
    const { userMember, visibleAiMembers } = getVisibleGroupMembers({
      members: motionAsset.members.map((m) => ({ memberId: m.memberId, _motion: m })),
      selectedMemberId: c.selected,
      mode: 'binding-isolation',
    });
    assert(userMember?.memberId === c.selected, `TEST 28 user ${c.selected}`);
    assert(
      visibleAiMembers.map((v) => v.memberId).join(',') === c.visible.join(','),
      `TEST 28 visible ${c.selected}`,
    );
    const userMotionId = motionAsset.members.find((m) => m.memberId === c.selected)?.motionAssetId;
    const visibleMotionIds = visibleAiMembers.map((v) => v._motion.motionAssetId);
    assert(!visibleMotionIds.includes(userMotionId || ''), `TEST 28 user motion excluded ${c.selected}`);
  }
  console.log('TEST 28: PASS');
}

const FORBIDDEN_PATTERNS = [
  '@mediapipe/tasks-vision',
  'MotionExtractionEngine',
  'SkeletonFrameData',
  'skeletonFrames',
  'useSkeletonExtract',
  'useGroupChoreoExtract',
];

const GROUP_RUNTIME_PATHS = [
  'src/modes/group',
  'src/components/group/GroupStudioSession.tsx',
  'src/components/group/three',
  'src/hooks/useGroupStudio.ts',
  'src/hooks/useGroupDanceEngine.ts',
  'src/services/group/GroupDanceSyncEngine.ts',
  'src/services/group/AvatarGroupManager.ts',
];

function collectSourceFiles(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectSourceFiles(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith('.test.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

function countActiveRuntimeImport(pattern: string): number {
  const root = resolve(process.cwd());
  let count = 0;
  for (const rel of GROUP_RUNTIME_PATHS) {
    const abs = join(root, rel);
    let files: string[] = [];
    try {
      const st = statSync(abs);
      files = st.isDirectory() ? collectSourceFiles(abs) : [abs];
    } catch {
      continue;
    }
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        if (!trimmed.includes('import ') && !trimmed.includes('from ')) continue;
        if (line.includes(pattern)) count += 1;
      }
    }
  }
  return count;
}

function test29MediaPipeZero() {
  const count = countActiveRuntimeImport('@mediapipe/tasks-vision');
  assert(count === 0, `TEST 29: @mediapipe import count=${count}`);
  console.log('TEST 29: PASS');
}

function test30SkeletonZero() {
  let total = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract', 'useGroupChoreoExtract']) {
    total += countActiveRuntimeImport(p);
  }
  assert(total === 0, `TEST 30: skeleton/mediapipe runtime import count=${total}`);
  console.log('TEST 30: PASS');
}

function testExtractTrackTarget() {
  assert(extractTrackTargetNodeName('Hips.quaternion') === 'Hips', 'track parse');
  assert(extractTrackTargetNodeName('mixamorigSpine.position') === 'mixamorigSpine', 'track parse 2');
}

async function run() {
  testExtractTrackTarget();
  test23FullyBindable();
  test24PartiallyBindable();
  test25Unbound();
  test26TransformProofMotionDetected();
  test27UnboundTransformProof();
  test28MemberIsolation();
  test29MediaPipeZero();
  test30SkeletonZero();
  console.log('motionBindingAnalysis tests: ALL PASS (TEST 23~30)');
  console.log('TEST 31: run npm run build separately');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
