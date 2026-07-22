// @ts-nocheck
/**
 * Production Skeleton Contract tests (TEST 37~48)
 * Run: npx tsx src/modes/group/runtime/productionSkeletonContract.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import * as THREE from 'three';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { extractSkeletonDefinitionFromBones } from './extractSkeletonDefinition';
import { validateProductionSkeleton, resolveSemanticBoneMap } from './validateProductionSkeleton';
import { computeSkeletonBoneMapping } from './computeSkeletonBoneMapping';
import { validateProductionMotionPair } from './productionMotionValidationHarness';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';
import { MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST } from '../fixtures/productionMotionTestContract';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { resolveAvatarAnimationRoot } from './resolveAvatarAnimationRoot';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildSkinnedRig(boneNames: string[]) {
  const bones = boneNames.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    return b;
  });
  for (let i = 1; i < bones.length; i++) {
    bones[i - 1].add(bones[i]);
    bones[i].position.y = 0.1;
  }
  const skeleton = new THREE.Skeleton(bones);
  const mesh = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshBasicMaterial(),
  );
  mesh.add(bones[0]);
  mesh.bind(skeleton, new THREE.Matrix4());
  const root = new THREE.Group();
  root.add(mesh);
  return { root, bones };
}

const RPM_FULL = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot',
  'RightUpLeg', 'RightLeg', 'RightFoot',
];

const MIXAMO_FULL = [
  'mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Neck', 'mixamorig:Head',
  'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand',
  'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
  'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot',
  'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot',
];

function buildMotionClip(sourceBoneName: string, duration = 1, animated = true) {
  if (!animated) {
    return new THREE.AnimationClip('Static', duration, [
      new THREE.QuaternionKeyframeTrack(
        `${sourceBoneName}.quaternion`,
        [0, duration],
        [0, 0, 0, 1, 0, 0, 0, 1],
      ),
    ]);
  }
  return new THREE.AnimationClip('Motion', duration, [
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

function test37AllRequiredMappedValid() {
  const rig = buildSkinnedRig(RPM_FULL);
  const def = extractSkeletonDefinitionFromBones('rpm', rig.bones)!;
  const semantic = resolveSemanticBoneMap(def);
  assert(semantic.size >= 17, 'TEST 37 semantic coverage');
  const result = validateProductionSkeleton({
    targetDefinition: def,
    profile: 'RPM',
    mappingRatio: 0.2,
  });
  assert(result.status === 'valid', `TEST 37 status=${result.status}`);
  assert(result.matchedRequiredBoneCount === result.requiredBoneCount, 'TEST 37 all required');
  console.log('TEST 37: PASS');
}

function test38MissingRequiredInvalid() {
  const missingHand = RPM_FULL.filter((n) => n !== 'LeftHand');
  const rig = buildSkinnedRig(missingHand);
  const def = extractSkeletonDefinitionFromBones('rpm', rig.bones)!;
  const result = validateProductionSkeleton({
    targetDefinition: def,
    profile: 'RPM',
    mappingRatio: 0.9,
  });
  assert(result.status !== 'valid', `TEST 38 must not be valid: ${result.status}`);
  assert(result.missingRequiredBones.includes('leftHand'), 'TEST 38 missing leftHand');
  console.log('TEST 38: PASS');
}

function test39SideFlipFails() {
  const sourceRig = buildSkinnedRig(['mixamorig:LeftArm', ...MIXAMO_FULL.filter((n) => n !== 'mixamorig:LeftArm')]);
  const targetRig = buildSkinnedRig(RPM_FULL);
  const sourceDef = extractSkeletonDefinitionFromBones('s', sourceRig.bones)!;
  const targetDef = extractSkeletonDefinitionFromBones('t', targetRig.bones)!;
  const mapping = computeSkeletonBoneMapping(sourceDef, targetDef);
  const flipped = mapping.map((m) => (
    m.targetBoneName === 'LeftArm'
      ? { ...m, targetBoneName: 'RightArm', sourceBoneName: 'mixamorig:LeftArm' }
      : m
  ));
  const result = validateProductionSkeleton({
    targetDefinition: targetDef,
    sourceDefinition: sourceDef,
    mapping: flipped,
    profile: 'RPM',
    mappingRatio: 1,
  });
  assert(result.status !== 'valid', 'TEST 39 flip must fail');
  assert(
    result.blockingReasons.some((r) => r.includes('leftUpperArm') || r.includes('semantic') || r.includes('L/R')),
    `TEST 39 blocking: ${result.blockingReasons.join(',')}`,
  );
  console.log('TEST 39: PASS');
}

function test40DuplicateSemanticAmbiguous() {
  const dup = ['Hips', 'Pelvis', ...RPM_FULL.filter((n) => n !== 'Hips')];
  const rig = buildSkinnedRig(dup);
  const def = extractSkeletonDefinitionFromBones('rpm', rig.bones)!;
  const result = validateProductionSkeleton({
    targetDefinition: def,
    profile: 'RPM',
    mappingRatio: 0.95,
  });
  assert(result.duplicateSemanticBones.includes('hips'), 'TEST 40 duplicate hips');
  assert(result.status !== 'valid', 'TEST 40 not valid');
  console.log('TEST 40: PASS');
}

function test41HighRatioMissingRequiredNotValid() {
  const partial = RPM_FULL.slice(0, 10);
  const rig = buildSkinnedRig(partial);
  const def = extractSkeletonDefinitionFromBones('rpm', rig.bones)!;
  const result = validateProductionSkeleton({
    targetDefinition: def,
    profile: 'RPM',
    mappingRatio: 0.95,
  });
  assert(result.status !== 'valid', 'TEST 41 high ratio still invalid');
  assert(result.missingRequiredBones.length > 0, 'TEST 41 missing bones');
  console.log('TEST 41: PASS');
}

function test42VerifiedRetargetPlayback() {
  const sourceRig = buildSkinnedRig(MIXAMO_FULL);
  const targetRig = buildSkinnedRig(RPM_FULL);
  const clip = buildMotionClip('mixamorig:Hips');
  const report = validateProductionMotionPair({
    memberId: 't42',
    avatarRoot: skeletonClone(targetRig.root),
    motionScene: sourceRig.root,
    sourceClip: clip,
    declaredMotionProfile: 'MIXAMO',
    declaredAvatarProfile: 'RPM',
    requireDeclaredProfiles: true,
  });
  assert(report.finalStatus === 'VERIFIED_RETARGET_PLAYBACK', `TEST 42 ${report.finalStatus}`);
  assert(report.changedBoneCount > 0, 'TEST 42 changed bones');
  console.log('TEST 42: PASS');
}

function test43BlockedTransformNotChanged() {
  const sourceRig = buildSkinnedRig(MIXAMO_FULL);
  const targetRig = buildSkinnedRig(RPM_FULL);
  const clip = buildMotionClip('mixamorig:Hips', 1, false);
  const report = validateProductionMotionPair({
    memberId: 't43',
    avatarRoot: skeletonClone(targetRig.root),
    motionScene: sourceRig.root,
    sourceClip: clip,
    declaredMotionProfile: 'MIXAMO',
    declaredAvatarProfile: 'RPM',
    requireDeclaredProfiles: true,
  });
  assert(report.finalStatus === 'BLOCKED_TRANSFORM_NOT_CHANGED', `TEST 43 ${report.finalStatus}`);
  console.log('TEST 43: PASS');
}

function test44UnknownProfileBlocked() {
  const sourceRig = buildSkinnedRig(MIXAMO_FULL);
  const targetRig = buildSkinnedRig(RPM_FULL);
  const clip = buildMotionClip('mixamorig:Hips');
  const report = validateProductionMotionPair({
    memberId: 't44',
    avatarRoot: skeletonClone(targetRig.root),
    motionScene: sourceRig.root,
    sourceClip: clip,
    declaredMotionProfile: 'UNKNOWN',
    declaredAvatarProfile: 'RPM',
    requireDeclaredProfiles: true,
  });
  assert(report.finalStatus === 'BLOCKED_SKELETON_PROFILE_UNSUPPORTED', `TEST 44 ${report.finalStatus}`);
  console.log('TEST 44: PASS');
}

function test45MemberIsolation() {
  const motionAsset = productionMotionAssetV2ToGroupMotionAsset(MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST);
  const cases = [
    { selected: 'member_a', visible: ['member_b', 'member_c', 'member_d'] },
    { selected: 'member_b', visible: ['member_a', 'member_c', 'member_d'] },
  ];
  for (const c of cases) {
    const { userMember, visibleAiMembers } = getVisibleGroupMembers({
      members: motionAsset.members.map((m) => ({ memberId: m.memberId, _motion: m })),
      selectedMemberId: c.selected,
      mode: 'binding-isolation',
    });
    assert(userMember?.memberId === c.selected, `TEST 45 user ${c.selected}`);
    assert(!visibleAiMembers.some((v) => v.memberId === c.selected), `TEST 45 exclude ${c.selected}`);
  }
  console.log('TEST 45: PASS');
}

const GROUP_RUNTIME_PATHS = [
  'src/modes/group',
  'src/components/group/GroupStudioSession.tsx',
  'src/components/group/three',
  'src/hooks/useGroupStudio.ts',
  'src/hooks/useGroupDanceEngine.ts',
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

function test46MediaPipeZero() {
  assert(countActiveRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 46 mediapipe');
  console.log('TEST 46: PASS');
}

function test47SkeletonFrameZero() {
  let total = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    total += countActiveRuntimeImport(p);
  }
  assert(total === 0, `TEST 47 skeleton imports=${total}`);
  console.log('TEST 47: PASS');
}

function test48TeachingModeRegression() {
  const teachingFiles = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  const forbidden = [
    'validateProductionSkeleton',
    'runProductionMotionRetargetGate',
    'productionMotionValidationHarness',
  ];
  for (const rel of teachingFiles) {
    const abs = join(resolve(process.cwd()), rel);
    let content = '';
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const token of forbidden) {
      assert(!content.includes(token), `TEST 48 ${rel} must not import ${token}`);
    }
  }
  console.log('TEST 48: PASS');
}

async function run() {
  test37AllRequiredMappedValid();
  test38MissingRequiredInvalid();
  test39SideFlipFails();
  test40DuplicateSemanticAmbiguous();
  test41HighRatioMissingRequiredNotValid();
  test42VerifiedRetargetPlayback();
  test43BlockedTransformNotChanged();
  test44UnknownProfileBlocked();
  test45MemberIsolation();
  test46MediaPipeZero();
  test47SkeletonFrameZero();
  test48TeachingModeRegression();
  console.log('productionSkeletonContract tests: ALL PASS (TEST 37~48)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
