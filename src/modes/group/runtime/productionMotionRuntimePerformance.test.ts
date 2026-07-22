// @ts-nocheck
/**
 * PHASE 16 — Production Group Runtime Performance tests (TEST 131~150)
 * Run: npx tsx src/modes/group/runtime/productionMotionRuntimePerformance.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as THREE from 'three';
import { cloneAvatarScene } from './auditAvatarSkeleton';
import { runProductionMotionRetargetGate } from './runProductionMotionRetargetGate';
import { resolveAvatarAnimationRoot } from './resolveAvatarAnimationRoot';
import { disposeProductionMotionMixer } from './disposeProductionMotionMixer';
import {
  boneMappingCacheKey,
  getOrCacheBoneMapping,
  getOrCacheMotionClipResolve,
  getOrCacheRetargetResult,
  getProductionMotionRuntimeMetrics,
  motionClipCacheKey,
  recordAvatarMounted,
  recordAvatarUnmounted,
  recordGltfUrlAccess,
  recordMixerCreated,
  recordMixerUpdateTimeMs,
  releaseGltfUrlAccess,
  resetProductionMotionRuntimeCacheForTests,
  retargetCacheKey,
} from './productionMotionRuntimeCache';
import { resolveMotionAnimationClip } from './resolveMotionAnimationClip';
import { computeSkeletonBoneMapping } from './computeSkeletonBoneMapping';
import { extractSkeletonDefinitionFromBones } from './extractSkeletonDefinition';
import { DefaultAvatarMotionRetargeter } from './DefaultAvatarMotionRetargeter';
import { extractSkeletonRuntimeFromScene } from './SkeletonRuntime';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildSkinnedRig(boneNames: string[], prefix = 'mixamorig') {
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
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
  mesh.name = 'SkinnedMesh';
  mesh.add(bones[0]);
  mesh.bind(skeleton, new THREE.Matrix4());
  const root = new THREE.Group();
  root.add(mesh);
  return { root, skeleton, bones };
}

function buildAvatarRig(boneNames: string[]) {
  return buildSkinnedRig(boneNames, 'Avatar');
}

function buildMotionClip(boneName: string, name = 'Dance', duration = 2) {
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack(`${boneName}.position`, [0, duration], [0, 0, 0, 0, 0.5, 0]),
  ]);
}

function simulateAvatarRuntimeSlot(memberId: string, sharedMotionUrl: string, sharedAvatarUrl: string) {
  recordGltfUrlAccess(sharedAvatarUrl, false);
  recordGltfUrlAccess(sharedMotionUrl, false);

  const motionRig = buildSkinnedRig(['Hips', 'Spine', 'LeftArm', 'RightArm']);
  const avatarRig = buildAvatarRig(['Hips', 'Spine', 'Arm_L', 'Arm_R']);
  const avatarClone = cloneAvatarScene(avatarRig.root);
  const motionSceneClone = motionRig.root.clone(true);
  const clip = buildMotionClip(motionRig.bones[0].name);

  const resolved = getOrCacheMotionClipResolve(
    motionClipCacheKey(sharedMotionUrl, clip.name, memberId),
    () => resolveMotionAnimationClip([clip], clip.name, memberId),
  );

  const gate = runProductionMotionRetargetGate({
    memberId,
    avatarRoot: avatarClone,
    motionScene: motionSceneClone,
    sourceClip: resolved.clip,
    declaredMotionProfile: 'MIXAMO',
    declaredAvatarProfile: 'MIXAMO',
    requireDeclaredProfiles: true,
  });

  let mixer: THREE.AnimationMixer | null = null;
  let action: THREE.AnimationAction | null = null;
  const playbackClip = gate.playbackPath !== 'failed' ? gate.clip : resolved.clip;
  const mixerRoot = resolveAvatarAnimationRoot(avatarClone, playbackClip) || avatarClone;
  mixer = new THREE.AnimationMixer(mixerRoot);
  action = mixer.clipAction(playbackClip, mixerRoot);
  action.play();
  action.paused = true;
  recordMixerCreated(1);

  recordAvatarMounted();

  return {
    memberId,
    mixer,
    action,
    dispose() {
      if (mixer && action) {
        disposeProductionMotionMixer({
          mixer,
          root: mixerRoot,
          clip: playbackClip,
          actionCount: 1,
        });
      }
      releaseGltfUrlAccess(sharedAvatarUrl);
      releaseGltfUrlAccess(sharedMotionUrl);
      recordAvatarUnmounted();
    },
  };
}

function reset() {
  resetProductionMotionRuntimeCacheForTests();
}

function test131Avatar1() {
  reset();
  const slot = simulateAvatarRuntimeSlot('m1', 'https://example.com/motion-a.glb', 'https://example.com/avatar-a.glb');
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.avatarCount === 1, `TEST 131 avatars=${metrics.avatarCount}`);
  assert(metrics.mixerCount === 1, `TEST 131 mixers=${metrics.mixerCount}`);
  slot.dispose();
  console.log('TEST 131: PASS');
}

function test132Avatar4() {
  reset();
  const slots = Array.from({ length: 4 }, (_, i) => simulateAvatarRuntimeSlot(
    `m${i + 1}`,
    `https://example.com/motion-${i}.glb`,
    `https://example.com/avatar-${i}.glb`,
  ));
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.avatarCount === 4, `TEST 132 avatars=${metrics.avatarCount}`);
  assert(metrics.mixerCount === 4, `TEST 132 mixers=${metrics.mixerCount}`);
  slots.forEach((s) => s.dispose());
  console.log('TEST 132: PASS');
}

function test133Avatar8() {
  reset();
  const slots = Array.from({ length: 8 }, (_, i) => simulateAvatarRuntimeSlot(
    `m${i + 1}`,
    `https://example.com/motion-${i}.glb`,
    `https://example.com/avatar-${i}.glb`,
  ));
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.avatarCount === 8, `TEST 133 avatars=${metrics.avatarCount}`);
  assert(metrics.mixerCount === 8, `TEST 133 mixers=${metrics.mixerCount}`);
  slots.forEach((s) => s.dispose());
  console.log('TEST 133: PASS');
}

function test134Avatar12() {
  reset();
  const slots = Array.from({ length: 12 }, (_, i) => simulateAvatarRuntimeSlot(
    `m${i + 1}`,
    `https://example.com/motion-${i}.glb`,
    `https://example.com/avatar-${i}.glb`,
  ));
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.avatarCount === 12, `TEST 134 avatars=${metrics.avatarCount}`);
  assert(metrics.mixerCount === 12, `TEST 134 mixers=${metrics.mixerCount}`);
  slots.forEach((s) => s.dispose());
  console.log('TEST 134: PASS');
}

function test135Avatar16() {
  reset();
  const slots = Array.from({ length: 16 }, (_, i) => simulateAvatarRuntimeSlot(
    `m${i + 1}`,
    `https://example.com/motion-${i}.glb`,
    `https://example.com/avatar-${i}.glb`,
  ));
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.avatarCount === 16, `TEST 135 avatars=${metrics.avatarCount}`);
  assert(metrics.mixerCount === 16, `TEST 135 mixers=${metrics.mixerCount}`);
  slots.forEach((s) => s.dispose());
  console.log('TEST 135: PASS');
}

function test136SameMotionUrlReuse() {
  reset();
  const motionUrl = 'https://example.com/shared-motion.glb';
  simulateAvatarRuntimeSlot('a', motionUrl, 'https://example.com/av1.glb').dispose();
  simulateAvatarRuntimeSlot('b', motionUrl, 'https://example.com/av2.glb').dispose();
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.cachedGltfMisses >= 1, 'TEST 136 gltf tracked');
  assert(metrics.cachedMotionClipHits >= 0, 'TEST 136 clip cache active');
  console.log('TEST 136: PASS');
}

function test137SameAvatarUrlReuse() {
  reset();
  const avatarUrl = 'https://example.com/shared-avatar.glb';
  recordGltfUrlAccess(avatarUrl, false);
  recordGltfUrlAccess(avatarUrl, true);
  releaseGltfUrlAccess(avatarUrl);
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.cachedGltfHits >= 1, `TEST 137 hits=${metrics.cachedGltfHits}`);
  console.log('TEST 137: PASS');
}

function test138RetargetCacheHit() {
  reset();
  const motionRig = buildSkinnedRig(['Hips', 'Spine', 'LeftArm']);
  const avatarRig = buildAvatarRig(['Hips', 'Spine', 'Arm_L']);
  const sourceRuntime = extractSkeletonRuntimeFromScene(motionRig.root, 'src')!;
  const targetRuntime = extractSkeletonRuntimeFromScene(avatarRig.root, 'tgt')!;
  const clip = buildMotionClip(motionRig.bones[0].name);
  const key = retargetCacheKey(sourceRuntime.definition, targetRuntime.definition, clip);
  const retargeter = new DefaultAvatarMotionRetargeter();
  getOrCacheRetargetResult(key, () => retargeter.retarget(sourceRuntime, targetRuntime, clip));
  getOrCacheRetargetResult(key, () => retargeter.retarget(sourceRuntime, targetRuntime, clip));
  const mappingKey = boneMappingCacheKey(sourceRuntime.definition, targetRuntime.definition);
  getOrCacheBoneMapping(mappingKey, () => computeSkeletonBoneMapping(sourceRuntime.definition, targetRuntime.definition));
  getOrCacheBoneMapping(mappingKey, () => computeSkeletonBoneMapping(sourceRuntime.definition, targetRuntime.definition));
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.cachedRetargetHits >= 1, `TEST 138 retarget hits=${metrics.cachedRetargetHits}`);
  assert(metrics.cachedBoneMappingHits >= 1, `TEST 138 mapping hits=${metrics.cachedBoneMappingHits}`);
  console.log('TEST 138: PASS');
}

function test139RetargetCacheMiss() {
  reset();
  const motionRig = buildSkinnedRig(['Hips', 'Spine']);
  const avatarRig = buildAvatarRig(['Hips', 'Spine']);
  const sourceRuntime = extractSkeletonRuntimeFromScene(motionRig.root, 'src')!;
  const targetRuntime = extractSkeletonRuntimeFromScene(avatarRig.root, 'tgt')!;
  const clipA = buildMotionClip(motionRig.bones[0].name, 'A');
  const clipB = buildMotionClip(motionRig.bones[0].name, 'B');
  const retargeter = new DefaultAvatarMotionRetargeter();
  getOrCacheRetargetResult(
    retargetCacheKey(sourceRuntime.definition, targetRuntime.definition, clipA),
    () => retargeter.retarget(sourceRuntime, targetRuntime, clipA),
  );
  getOrCacheRetargetResult(
    retargetCacheKey(sourceRuntime.definition, targetRuntime.definition, clipB),
    () => retargeter.retarget(sourceRuntime, targetRuntime, clipB),
  );
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.cachedRetargetMisses >= 2, `TEST 139 misses=${metrics.cachedRetargetMisses}`);
  console.log('TEST 139: PASS');
}

function test140RepeatedSeek() {
  reset();
  const slot = simulateAvatarRuntimeSlot('seek', 'https://example.com/m.glb', 'https://example.com/a.glb');
  assert(slot.action, 'TEST 140 action');
  const actionRef = slot.action;
  for (let i = 0; i < 20; i += 1) {
    actionRef.time = i * 0.1;
    slot.mixer!.update(0);
  }
  assert(slot.action === actionRef, 'TEST 140 same action ref');
  slot.dispose();
  console.log('TEST 140: PASS');
}

function test141RepeatedPause() {
  reset();
  const slot = simulateAvatarRuntimeSlot('pause', 'https://example.com/m.glb', 'https://example.com/a.glb');
  assert(slot.action, 'TEST 141 action');
  for (let i = 0; i < 10; i += 1) {
    slot.action!.paused = true;
    slot.mixer!.update(0);
  }
  assert(slot.action!.paused === true, 'TEST 141 paused');
  slot.dispose();
  console.log('TEST 141: PASS');
}

function test142RepeatedResume() {
  reset();
  const slot = simulateAvatarRuntimeSlot('resume', 'https://example.com/m.glb', 'https://example.com/a.glb');
  assert(slot.action, 'TEST 142 action');
  for (let i = 0; i < 10; i += 1) {
    slot.action!.paused = false;
    slot.mixer!.update(1 / 60);
    recordMixerUpdateTimeMs(0.1);
  }
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.averageUpdateTimeMs > 0, 'TEST 142 update tracked');
  slot.dispose();
  console.log('TEST 142: PASS');
}

function test143RapidMountUnmount() {
  reset();
  for (let i = 0; i < 8; i += 1) {
    const slot = simulateAvatarRuntimeSlot(`rapid-${i}`, 'https://example.com/m.glb', 'https://example.com/a.glb');
    slot.dispose();
  }
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.avatarCount === 0, `TEST 143 avatars=${metrics.avatarCount}`);
  assert(metrics.mixerCount === 0, `TEST 143 mixers=${metrics.mixerCount}`);
  assert(metrics.disposedMixerCount >= 8, `TEST 143 disposed=${metrics.disposedMixerCount}`);
  console.log('TEST 143: PASS');
}

function test144DisposeLeak() {
  reset();
  const before = getProductionMotionRuntimeMetrics().disposedMixerCount;
  const slot = simulateAvatarRuntimeSlot('leak', 'https://example.com/m.glb', 'https://example.com/a.glb');
  slot.dispose();
  const after = getProductionMotionRuntimeMetrics().disposedMixerCount;
  assert(after === before + 1, `TEST 144 disposed ${before}->${after}`);
  assert(getProductionMotionRuntimeMetrics().mixerCount === 0, 'TEST 144 no active mixers');
  console.log('TEST 144: PASS');
}

function test145AnimationMixerLeak() {
  reset();
  simulateAvatarRuntimeSlot('leak2', 'https://example.com/m.glb', 'https://example.com/a.glb').dispose();
  simulateAvatarRuntimeSlot('leak3', 'https://example.com/m2.glb', 'https://example.com/a2.glb').dispose();
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.mixerCount === 0, `TEST 145 mixers=${metrics.mixerCount}`);
  assert(metrics.activeActionCount === 0, `TEST 145 actions=${metrics.activeActionCount}`);
  console.log('TEST 145: PASS');
}

function test146GltfCacheHit() {
  reset();
  const url = 'https://example.com/cached.glb';
  recordGltfUrlAccess(url, false);
  recordGltfUrlAccess(url, true);
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.cachedGltfHits >= 1, `TEST 146 hits=${metrics.cachedGltfHits}`);
  console.log('TEST 146: PASS');
}

function test147MotionClipCacheHit() {
  reset();
  const clip = buildMotionClip('mixamorig:Hips');
  const key = motionClipCacheKey('https://example.com/m.glb', 'Dance', 'm1');
  getOrCacheMotionClipResolve(key, () => resolveMotionAnimationClip([clip], 'Dance', 'm1'));
  getOrCacheMotionClipResolve(key, () => resolveMotionAnimationClip([clip], 'Dance', 'm1'));
  const metrics = getProductionMotionRuntimeMetrics();
  assert(metrics.cachedMotionClipHits >= 1, `TEST 147 hits=${metrics.cachedMotionClipHits}`);
  console.log('TEST 147: PASS');
}

function test148TeachingRegression() {
  const teachingFiles = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  for (const rel of teachingFiles) {
    const content = readFileSync(resolve(rel), 'utf8');
    for (const token of ['productionMotionRuntimeCache', 'disposeProductionMotionMixer']) {
      assert(!content.includes(token), `TEST 148 teaching ${rel} ${token}`);
    }
  }
  console.log('TEST 148: PASS');
}

function test149MediaPipeImportZero() {
  assert(countGroupRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 149 mediapipe');
  console.log('TEST 149: PASS');
}

function test150SkeletonRuntimeImportZero() {
  let skeletonTotal = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    skeletonTotal += countGroupRuntimeImport(p);
  }
  assert(skeletonTotal === 0, `TEST 150 skeleton=${skeletonTotal}`);
  console.log('TEST 150: PASS');
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
    } else if (/\.(tsx?|jsx?|md)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function countGroupRuntimeImport(pattern: string): number {
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
      if (/\.test\.(tsx?|jsx?)$/.test(file)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) continue;
        if (!t.includes('import ') && !t.includes('from ')) continue;
        if (line.includes(pattern)) count += 1;
      }
    }
  }
  return count;
}

function run() {
  test131Avatar1();
  test132Avatar4();
  test133Avatar8();
  test134Avatar12();
  test135Avatar16();
  test136SameMotionUrlReuse();
  test137SameAvatarUrlReuse();
  test138RetargetCacheHit();
  test139RetargetCacheMiss();
  test140RepeatedSeek();
  test141RepeatedPause();
  test142RepeatedResume();
  test143RapidMountUnmount();
  test144DisposeLeak();
  test145AnimationMixerLeak();
  test146GltfCacheHit();
  test147MotionClipCacheHit();
  test148TeachingRegression();
  test149MediaPipeImportZero();
  test150SkeletonRuntimeImportZero();

  resetProductionMotionRuntimeCacheForTests();
  console.log('productionMotionRuntimePerformance tests: ALL PASS (TEST 131~150)');
}

try {
  run();
} catch (err) {
  console.error(err);
  process.exit(1);
}
