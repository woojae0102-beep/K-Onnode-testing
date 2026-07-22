// @ts-nocheck
/**
 * PHASE 12 — Production Intake Readiness tests (TEST 89~101)
 * Run: npx tsx src/modes/group/runtime/productionIntakeReadiness.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as THREE from 'three';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST } from '../fixtures/productionMotionTestContract';
import {
  registerTestProductionMotionAsset,
  clearTestProductionMotionAssets,
} from '../services/ProductionMotionAssetLoader';
import { assertRealProductionAsset } from './validateAssetProvenance';
import { validateRealProductionMotionAsset } from './realProductionMotionValidationHarness';
import { DefaultProductionMotionAssetIngestor } from '../../../gx10/ingest/DefaultProductionMotionAssetIngestor';
import type { GX10ProductionMotionOutput } from '../../../gx10/contracts/GX10ProductionMotionOutput';
import {
  sealTrustedRealProductionProvenance,
  isTrustedRealProductionProvenance,
} from '../../../gx10/ingest/trustedProvenance';
import {
  createProductionAuthorityProof,
  proofSurvivesJsonSerialization,
  isValidProductionAuthorityProof,
} from '../../../gx10/ingest/productionAuthorityProof';
import { validateRealProductionIntakeContract } from '../../../gx10/ingest/ProductionAssetIntakeContract';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';
import { auditGroupProductionRuntimeBoundary } from './groupProductionRuntimeBoundary';

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

function ingestRealProduction(overrides: Partial<GX10ProductionMotionOutput> = {}) {
  return new DefaultProductionMotionAssetIngestor().ingestCompletedJob({
    jobResult: { jobId: 'job-real-1', status: 'completed', productionAssetId: 'prod-asset-001' },
    processorOutput: buildProcessorOutput(overrides),
    assetProvenance: 'real_production',
  }).asset;
}

function expectError(fn: () => void, code: string, label: string) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError && err.code === code,
      `${label} expected ${code}, got ${err?.code ?? err}`,
    );
  }
  assert(threw, `${label} must throw`);
}

function test89SerializationBoundary() {
  const seal = sealTrustedRealProductionProvenance({
    ingestJobId: 'job-1',
    productionAssetId: 'prod-1',
  });
  const serializedSeal = JSON.parse(JSON.stringify(seal));
  assert(!isTrustedRealProductionProvenance(serializedSeal), 'TEST 89 Symbol seal lost after JSON');

  const proof = createProductionAuthorityProof({
    productionAssetId: 'prod-1',
    authorityRecordId: 'prod-1',
    ingestJobId: 'job-1',
  });
  assert(proofSurvivesJsonSerialization(proof), 'TEST 89 authority proof survives JSON');
  console.log('TEST 89: PASS');
}

function test90ClientCreatedRealProductionBlocked() {
  const asset = cloneAsset();
  asset.assetProvenance = 'real_production';
  asset.productionAssetId = 'forged-id';
  expectError(
    () => assertRealProductionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 90',
  );
  console.log('TEST 90: PASS');
}

function test91RealProductionWithoutAuthorityProof() {
  const asset = ingestRealProduction();
  delete asset.productionAuthorityProof;
  expectError(
    () => assertRealProductionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 91 assert',
  );
  console.log('TEST 91: PASS');
}

function test92SyntheticPromotionBlocked() {
  clearTestProductionMotionAssets();
  const asset = cloneAsset();
  assert(asset.assetProvenance === 'synthetic_test', 'TEST 92 baseline');
  asset.assetProvenance = 'real_production';
  expectError(
    () => registerTestProductionMotionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 92 register',
  );
  expectError(
    () => assertRealProductionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 92 assert',
  );
  console.log('TEST 92: PASS');
}

function test93DevFixturePromotionBlocked() {
  clearTestProductionMotionAssets();
  const asset = cloneAsset();
  asset.assetProvenance = 'dev_fixture';
  asset.assetProvenance = 'real_production';
  expectError(
    () => registerTestProductionMotionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 93 register',
  );
  expectError(
    () => assertRealProductionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 93 assert',
  );
  console.log('TEST 93: PASS');
}

function test94LegacyV1TrustBlocked() {
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
  expectError(
    () => assertRealProductionAsset(v2),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_UNKNOWN,
    'TEST 94',
  );
  console.log('TEST 94: PASS');
}

function test95ChoreographyJsonNotInActiveRuntime() {
  const audit = auditGroupProductionRuntimeBoundary();
  assert(audit.secure, `TEST 95 violations: ${audit.violations.join('; ')}`);
  const useGroupStudio = readFileSync(resolve('src/hooks/useGroupStudio.ts'), 'utf8');
  assert(!useGroupStudio.includes('ChoreographyDatasetLoader'), 'TEST 95 useGroupStudio');
  assert(!useGroupStudio.includes('loadGroupMotionContent'), 'TEST 95 loadGroupMotionContent');
  console.log('TEST 95: PASS');
}

function test96DeepMotionDirectIngestBlocked() {
  const audit = auditGroupProductionRuntimeBoundary();
  const deepMotionViolations = audit.violations.filter((v) => v.includes('DeepMotion'));
  assert(deepMotionViolations.length === 0, `TEST 96 ${deepMotionViolations.join('; ')}`);

  const mapper = readFileSync(resolve('src/modes/group/runtime/productionMotionAssetV2Mapper.ts'), 'utf8');
  assert(!mapper.includes('deepMotionProvider'), 'TEST 96 mapper provider import');
  assert(!mapper.includes('fetchDeepMotion'), 'TEST 96 fetchDeepMotion');
  console.log('TEST 96: PASS');
}

function test97IntakeContractMissingFields() {
  const asset = ingestRealProduction();
  delete asset.members[0].motion.animationClipName;
  expectError(
    () => validateRealProductionIntakeContract(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
    'TEST 97 clip',
  );
  console.log('TEST 97: PASS');
}

function test98MemberIsolationRegression() {
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
    assert(userMember?.memberId === c.selected, `TEST 98 user ${c.selected}`);
    assert(
      visibleAiMembers.map((v) => v.memberId).join(',') === c.visible.join(','),
      `TEST 98 visible ${c.selected}`,
    );
  }
  console.log('TEST 98: PASS');
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

function test99GroupMediaPipeZero() {
  assert(countGroupRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 99');
  console.log('TEST 99: PASS');
}

function test100SkeletonFrameDataZero() {
  let total = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    total += countGroupRuntimeImport(p);
  }
  assert(total === 0, `TEST 100 count=${total}`);
  console.log('TEST 100: PASS');
}

function test101TeachingRegression() {
  const files = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  for (const rel of files) {
    const content = readFileSync(resolve(rel), 'utf8');
    for (const token of [
      'validateRealProductionIntakeContract',
      'productionAuthorityProof',
      'DefaultProductionMotionAssetIngestor',
    ]) {
      assert(!content.includes(token), `TEST 101 ${rel} ${token}`);
    }
  }
  console.log('TEST 101: PASS');
}

function test89bIngestHasAuthorityProof() {
  const asset = ingestRealProduction();
  assert(isValidProductionAuthorityProof(asset.productionAuthorityProof, asset.productionAssetId), 'TEST 89b');
  assert(proofSurvivesJsonSerialization(asset.productionAuthorityProof!), 'TEST 89b serialize');
  console.log('TEST 89b: PASS');
}

function test88bRealHarnessRequiresAuthorityProof() {
  const asset = ingestRealProduction();
  let err: ProductionMotionAssetError | null = null;
  try {
    validateRealProductionMotionAsset({
      asset,
      memberId: 'm1',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (e) {
    err = e;
  }
  assert(
    err?.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
    `TEST 88b blocked without verification, got ${err?.code}`,
  );
  console.log('TEST 88b: PASS');
}

async function run() {
  test89SerializationBoundary();
  test89bIngestHasAuthorityProof();
  test90ClientCreatedRealProductionBlocked();
  test91RealProductionWithoutAuthorityProof();
  test92SyntheticPromotionBlocked();
  test93DevFixturePromotionBlocked();
  test94LegacyV1TrustBlocked();
  test95ChoreographyJsonNotInActiveRuntime();
  test96DeepMotionDirectIngestBlocked();
  test97IntakeContractMissingFields();
  test98MemberIsolationRegression();
  test88bRealHarnessRequiresAuthorityProof();
  test99GroupMediaPipeZero();
  test100SkeletonFrameDataZero();
  test101TeachingRegression();
  clearTestProductionMotionAssets();
  console.log('productionIntakeReadiness tests: ALL PASS (TEST 89~101)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
