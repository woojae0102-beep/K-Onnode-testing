// @ts-nocheck
/**
 * GX10 Producer Contract + Provenance tests (TEST 62~78)
 * Run: npx tsx src/modes/group/runtime/gx10ProducerContract.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import * as THREE from 'three';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST } from '../fixtures/productionMotionTestContract';
import { assertRealProductionAsset, assertAssetProvenance } from './validateAssetProvenance';
import { validateRealProductionMotionAsset } from './realProductionMotionValidationHarness';
import { DefaultProductionMotionAssetIngestor } from '../../../gx10/ingest/DefaultProductionMotionAssetIngestor';
import type { GX10ProductionMotionOutput } from '../../../gx10/contracts/GX10ProductionMotionOutput';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function cloneAsset() {
  return JSON.parse(JSON.stringify(MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST));
}

function buildProcessorOutput(overrides: Partial<GX10ProductionMotionOutput> = {}): GX10ProductionMotionOutput {
  return {
    productionAssetId: 'prod-asset-001',
    schemaVersion: 2,
    groupId: 'test-group',
    songId: 'test-song',
    sourceProcessor: 'gx10',
    processorVersion: '0.0.0-contract',
    sourceSkeletonProfile: 'MIXAMO',
    sourceSkeletonVersion: '1.0',
    generatedAt: '2026-07-20T00:00:00.000Z',
    markAsRealProduction: true,
    durationSec: 30,
    fps: 30,
    members: [{
      memberId: 'm1',
      memberName: 'M1',
      avatarAssetId: 'av-1',
      avatarGlbUrl: 'https://example.com/avatar.glb',
      avatarSkeletonProfile: 'RPM',
      avatarSkeletonVersion: '1.0',
      motion: {
        memberId: 'm1',
        motionAssetId: 'motion-1',
        motionFormat: 'gltf_animation',
        motionUrl: 'https://example.com/motion.glb',
        animationClipName: 'Dance',
        sourceSkeletonProfile: 'MIXAMO',
        sourceSkeletonVersion: '1.0',
        durationSec: 30,
      },
    }],
    ...overrides,
  };
}

function ingestRealProductionAsset(overrides: Partial<GX10ProductionMotionOutput> = {}) {
  const ingestor = new DefaultProductionMotionAssetIngestor();
  return ingestor.ingestCompletedJob({
    jobResult: { jobId: 'job-real-1', status: 'completed', productionAssetId: 'prod-asset-001' },
    processorOutput: buildProcessorOutput(overrides),
    assetProvenance: 'real_production',
  }).asset;
}

function test62RealProductionAccepted() {
  const asset = ingestRealProductionAsset();
  assert(assertRealProductionAsset(asset) === 'real_production', 'TEST 62');
  assert(asset.trustedProvenance?.source === 'production_ingest', 'TEST 62 trusted source');
  console.log('TEST 62: PASS');
}

function test62cForgedRealProductionBlocked() {
  const asset = cloneAsset();
  asset.assetProvenance = 'real_production';
  let threw = false;
  try {
    assertRealProductionAsset(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'TEST 62c forged',
    );
  }
  assert(threw, 'TEST 62c must throw');
  console.log('TEST 62c: PASS');
}

function test63SyntheticBlockedFromRealHarness() {
  const asset = cloneAsset();
  asset.assetProvenance = 'synthetic_test';
  let threw = false;
  try {
    assertRealProductionAsset(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'TEST 63 code',
    );
  }
  assert(threw, 'TEST 63 must throw');
  console.log('TEST 63: PASS');
}

function test64DevFixtureBlocked() {
  const asset = cloneAsset();
  asset.assetProvenance = 'dev_fixture';
  let threw = false;
  try {
    assertRealProductionAsset(asset);
  } catch (err) {
    threw = true;
  }
  assert(threw, 'TEST 64');
  console.log('TEST 64: PASS');
}

function test65MissingProvenanceBlocked() {
  const asset = cloneAsset();
  delete asset.assetProvenance;
  let threw = false;
  try {
    assertRealProductionAsset(asset);
  } catch (err) {
    threw = true;
    assert(err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_UNKNOWN, 'TEST 65');
  }
  assert(threw, 'TEST 65');
  console.log('TEST 65: PASS');
}

function test66LegacyShimNoRealProduction() {
  // legacyV1ToV2 is not exported — replicate shape without assetProvenance
  const v2 = {
    schemaVersion: 2,
    groupId: 'g',
    songId: 's',
    durationSec: 10,
    status: 'ready',
    members: [{
      memberId: 'm',
      memberName: 'M',
      avatar: { avatarAssetId: 'a', glbUrl: 'https://x/a.glb' },
      motion: {
        motionAssetId: 'mo',
        motionFormat: 'gltf_animation',
        motionUrl: 'https://x/m.glb',
        durationSec: 10,
      },
    }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  assert(v2.assetProvenance === undefined, 'TEST 66 no provenance');
  let threw = false;
  try {
    assertRealProductionAsset(v2);
  } catch (err) {
    threw = true;
    assert(err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_UNKNOWN, 'TEST 66 unknown');
  }
  assert(threw, 'TEST 66 blocked');
  console.log('TEST 66: PASS');
}

function stripComments(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/**');
    })
    .join('\n');
}

function test67Gx10ContractNoSkeletonFrameData() {
  const content = stripComments(
    readFileSync(resolve('src/gx10/contracts/GX10ProductionMotionProcessor.ts'), 'utf8')
    + readFileSync(resolve('src/gx10/contracts/GX10ProductionMotionOutput.ts'), 'utf8'),
  );
  for (const token of ['SkeletonFrameData', 'skeletonFrames', 'joints', 'trackId']) {
    assert(!content.includes(token), `TEST 67 ${token}`);
  }
  console.log('TEST 67: PASS');
}

function test68Gx10ContractNoMediaPipe() {
  const dir = resolve('src/gx10');
  let found = false;
  for (const file of collectSourceFiles(dir)) {
    if (readFileSync(file, 'utf8').includes('@mediapipe')) found = true;
  }
  assert(!found, 'TEST 68 mediapipe in gx10');
  console.log('TEST 68: PASS');
}

function test69ProcessorOutputNoFrameArrays() {
  const content = stripComments(readFileSync(resolve('src/gx10/contracts/GX10ProductionMotionOutput.ts'), 'utf8'));
  assert(!content.includes('skeletonFrames'), 'TEST 69');
  assert(!content.includes('frame arrays'), 'TEST 69');
  console.log('TEST 69: PASS');
}

function test70MotionAssetIdUniqueness() {
  const ingestor = new DefaultProductionMotionAssetIngestor();
  const output = buildProcessorOutput({
    members: [
      buildProcessorOutput().members[0],
      {
        ...buildProcessorOutput().members[0],
        memberId: 'm2',
        memberName: 'M2',
        avatarAssetId: 'av-2',
        motion: { ...buildProcessorOutput().members[0].motion, motionAssetId: 'motion-1' },
      },
    ],
  });
  let threw = false;
  try {
    ingestor.ingestCompletedJob({
      jobResult: { jobId: 'j1', status: 'completed', productionAssetId: 'prod-asset-001' },
      processorOutput: output,
      assetProvenance: 'real_production',
    });
  } catch (err) {
    threw = true;
    assert(err.code === PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID, 'TEST 70');
  }
  assert(threw, 'TEST 70');
  console.log('TEST 70: PASS');
}

function test71MotionUrlUniqueness() {
  const ingestor = new DefaultProductionMotionAssetIngestor();
  const base = buildProcessorOutput().members[0];
  const output = buildProcessorOutput({
    members: [
      base,
      {
        ...base,
        memberId: 'm2',
        memberName: 'M2',
        avatarAssetId: 'av-2',
        motion: { ...base.motion, motionAssetId: 'motion-2', motionUrl: base.motion.motionUrl },
      },
    ],
  });
  let threw = false;
  try {
    ingestor.ingestCompletedJob({
      jobResult: { jobId: 'j1', status: 'completed', productionAssetId: 'prod-asset-001' },
      processorOutput: output,
      assetProvenance: 'real_production',
    });
  } catch (err) {
    threw = true;
    assert(err.code === PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL, 'TEST 71');
  }
  assert(threw, 'TEST 71');
  console.log('TEST 71: PASS');
}

function test72IngestCompletedOnly() {
  const ingestor = new DefaultProductionMotionAssetIngestor();
  let threw = false;
  try {
    ingestor.ingestCompletedJob({
      jobResult: { jobId: 'j1', status: 'failed', productionAssetId: null, errorCode: 'X' },
      processorOutput: buildProcessorOutput(),
      assetProvenance: 'real_production',
    });
  } catch (err) {
    threw = true;
    assert(err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY, 'TEST 72');
  }
  assert(threw, 'TEST 72');
  console.log('TEST 72: PASS');
}

function test73IngestNoGroupRuntimeImport() {
  const content = readFileSync(resolve('src/gx10/ingest/DefaultProductionMotionAssetIngestor.ts'), 'utf8');
  for (const token of ['AvatarCharacterAnimated3D', 'GroupDanceSyncEngine', 'getVisibleGroupMembers', 'runProductionMotionRetargetGate']) {
    assert(!content.includes(token), `TEST 73 ${token}`);
  }
  console.log('TEST 73: PASS');
}

function test74IngestGeneratesV2FromProcessorOutput() {
  const ingestor = new DefaultProductionMotionAssetIngestor();
  const result = ingestor.ingestCompletedJob({
    jobResult: { jobId: 'j1', status: 'completed', productionAssetId: 'prod-asset-001' },
    processorOutput: buildProcessorOutput(),
    assetProvenance: 'real_production',
  });
  assert(result.asset.schemaVersion === 2, 'TEST 74 schema');
  assert(result.asset.assetProvenance === 'real_production', 'TEST 74 provenance');
  assert(result.asset.trustedProvenance?.productionAssetId === 'prod-asset-001', 'TEST 74 trusted seal');
  assert(result.asset.productionAuthorityProof?.productionAssetId === 'prod-asset-001', 'TEST 74 authority');
  assert(result.asset.productionAssetId === 'prod-asset-001', 'TEST 74 productionAssetId');
  assert(result.asset.members[0].motion.sourceSkeletonProfile === 'MIXAMO', 'TEST 74 profile');
  console.log('TEST 74: PASS');
}

function test75RealHarnessRejectsSynthetic() {
  const asset = cloneAsset();
  assert(asset.assetProvenance === 'synthetic_test', 'TEST 75 fixture');
  let threw = false;
  try {
    validateRealProductionMotionAsset({
      asset,
      memberId: 'member_a',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (err) {
    threw = true;
    assert(err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID, 'TEST 75');
  }
  assert(threw, 'TEST 75');
  console.log('TEST 75: PASS');
}

function test76GroupMediaPipeZero() {
  assert(countGroupRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 76');
  console.log('TEST 76: PASS');
}

function test77GroupSkeletonZero() {
  let total = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    total += countGroupRuntimeImport(p);
  }
  assert(total === 0, `TEST 77 count=${total}`);
  console.log('TEST 77: PASS');
}

function test78TeachingRegression() {
  const files = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  for (const rel of files) {
    const content = readFileSync(resolve(rel), 'utf8');
    for (const token of ['validateRealProductionMotionAsset', 'GX10ProductionMotionProcessor', 'DefaultProductionMotionAssetIngestor']) {
      assert(!content.includes(token), `TEST 78 ${rel} ${token}`);
    }
  }
  console.log('TEST 78: PASS');
}

function test62bAssertAssetProvenanceRealOnly() {
  assert(assertAssetProvenance(cloneAsset(), ['synthetic_test']) === 'synthetic_test', 'TEST 62b');
  console.log('TEST 62b: PASS');
}

function test58MemberIsolation() {
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
    assert(userMember?.memberId === c.selected, `TEST 58 user ${c.selected}`);
    assert(
      visibleAiMembers.map((v) => v.memberId).join(',') === c.visible.join(','),
      `TEST 58 visible ${c.selected}`,
    );
  }
  console.log('TEST 58: PASS');
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
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        if (!trimmed.includes('import ') && !trimmed.includes('from ')) continue;
        if (line.includes(pattern)) count += 1;
      }
    }
  }
  return count;
}

async function run() {
  test62RealProductionAccepted();
  test62cForgedRealProductionBlocked();
  test62bAssertAssetProvenanceRealOnly();
  test63SyntheticBlockedFromRealHarness();
  test64DevFixtureBlocked();
  test65MissingProvenanceBlocked();
  test66LegacyShimNoRealProduction();
  test67Gx10ContractNoSkeletonFrameData();
  test68Gx10ContractNoMediaPipe();
  test69ProcessorOutputNoFrameArrays();
  test70MotionAssetIdUniqueness();
  test71MotionUrlUniqueness();
  test72IngestCompletedOnly();
  test73IngestNoGroupRuntimeImport();
  test74IngestGeneratesV2FromProcessorOutput();
  test75RealHarnessRejectsSynthetic();
  test58MemberIsolation();
  test76GroupMediaPipeZero();
  test77GroupSkeletonZero();
  test78TeachingRegression();
  console.log('gx10ProducerContract tests: ALL PASS (TEST 62~78)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
