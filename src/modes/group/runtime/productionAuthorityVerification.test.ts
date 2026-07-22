// @ts-nocheck
/**
 * PHASE 13 — Server Authority Verification tests (TEST 102~115)
 * Run: npx tsx src/modes/group/runtime/productionAuthorityVerification.test.ts
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
import { DefaultProductionMotionAssetIngestor } from '../../../gx10/ingest/DefaultProductionMotionAssetIngestor';
import type { GX10ProductionMotionOutput } from '../../../gx10/contracts/GX10ProductionMotionOutput';
import { createProductionAuthorityProof } from '../../../gx10/ingest/productionAuthorityProof';
import {
  verifyProductionAuthority,
  registerTestProductionAuthorityRecord,
  clearTestProductionAuthorityRecords,
  setUseTestProductionAuthorityStore,
} from '../../../gx10/ingest/verifyProductionAuthority';
import { buildTestAuthorityRecord } from '../../../gx10/ingest/productionAuthorityTestSigning';
import { setProductionAuthorityPublicKeyPem } from '../../../gx10/ingest/verifyAuthoritySignature';
import { ensureTestAuthorityKeyPair } from '../../../gx10/ingest/productionAuthorityTestSigning';
import { validateRealProductionMotionAsset } from './realProductionMotionValidationHarness';
import { productionMotionAssetV2ToGroupMotionAsset } from './productionMotionAssetV2Mapper';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
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
  const output = buildProcessorOutput(overrides);
  const productionAssetId = output.productionAssetId;
  return new DefaultProductionMotionAssetIngestor().ingestCompletedJob({
    jobResult: { jobId: 'job-real-1', status: 'completed', productionAssetId },
    processorOutput: output,
    assetProvenance: 'real_production',
  }).asset;
}

function setupVerifiedRealAsset(overrides: Partial<GX10ProductionMotionOutput> = {}) {
  const asset = ingestRealProduction(overrides);
  registerTestProductionAuthorityRecord(buildTestAuthorityRecord(asset));
  return asset;
}

function expectFailure(fn: () => Promise<unknown>, code: string, label: string) {
  return Promise.resolve(fn()).then((result: any) => {
    assert(!result?.verified, `${label} must fail`);
    assert(result?.failureCode === code, `${label} expected ${code}, got ${result?.failureCode ?? result}`);
  });
}

async function test102FakeAuthorityProofBlocked() {
  const asset = ingestRealProduction();
  asset.productionAuthorityProof = createProductionAuthorityProof({
    productionAssetId: 'fake',
    authorityRecordId: 'fake',
    ingestJobId: 'fake',
  });
  asset.productionAssetId = 'fake';
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
    'TEST 102',
  );
  console.log('TEST 102: PASS');
}

async function test103MissingAuthorityRecord() {
  const asset = ingestRealProduction();
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
    'TEST 103',
  );
  console.log('TEST 103: PASS');
}

async function test104ProductionAssetIdMismatch() {
  const asset = setupVerifiedRealAsset();
  registerTestProductionAuthorityRecord({
    ...buildTestAuthorityRecord(asset),
    productionAssetId: 'wrong-prod-id',
  });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 104',
  );
  console.log('TEST 104: PASS');
}

async function test105CrossAssetProofReuse() {
  const assetA = setupVerifiedRealAsset();
  const assetB = ingestRealProduction({
    productionAssetId: 'prod-asset-002',
    groupId: 'test-group-b',
    songId: 'test-song-b',
    members: [{
      ...buildProcessorOutput().members[0],
      memberId: 'm2',
      motion: { ...buildProcessorOutput().members[0].motion, motionAssetId: 'motion-2' },
    }],
  });
  assetB.productionAuthorityProof = {
    ...assetA.productionAuthorityProof!,
    productionAssetId: assetB.productionAssetId!,
  };
  await expectFailure(
    () => verifyProductionAuthority(assetB),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 105',
  );
  console.log('TEST 105: PASS');
}

async function test106GroupIdMismatch() {
  const asset = setupVerifiedRealAsset();
  asset.groupId = 'wrong-group';
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 106',
  );
  console.log('TEST 106: PASS');
}

async function test107SongIdMismatch() {
  const asset = setupVerifiedRealAsset();
  asset.songId = 'wrong-song';
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 107',
  );
  console.log('TEST 107: PASS');
}

async function test108MemberSetMismatch() {
  const asset = setupVerifiedRealAsset();
  asset.members[0].memberId = 'm1-renamed';
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 108',
  );
  console.log('TEST 108: PASS');
}

async function test109RevokedAuthority() {
  const asset = setupVerifiedRealAsset();
  registerTestProductionAuthorityRecord({
    ...buildTestAuthorityRecord(asset),
    status: 'revoked',
  });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED,
    'TEST 109',
  );
  console.log('TEST 109: PASS');
}

async function test110RealProductionWithoutServerAuthority() {
  clearTestProductionAuthorityRecords();
  const asset = ingestRealProduction();
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
    'TEST 110',
  );
  console.log('TEST 110: PASS');
}

async function test111LoaderVerificationSuccess() {
  const asset = setupVerifiedRealAsset();
  const result = await verifyProductionAuthority(asset);
  assert(result.verified === true, 'TEST 111 verified');
  assert(result.signatureVerified === true, 'TEST 111 signatureVerified');
  assert(result.productionAssetId === asset.productionAssetId, 'TEST 111 id');
  assert(result.authorityToken?.signature, 'TEST 111 token');
  console.log('TEST 111: PASS');
}

async function test112LoaderVerificationFailure() {
  clearTestProductionAuthorityRecords();
  const asset = ingestRealProduction();
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
    'TEST 112',
  );
  console.log('TEST 112: PASS');
}

async function test113HarnessRequiresAuthorityVerification() {
  const asset = setupVerifiedRealAsset();
  let threw = false;
  try {
    validateRealProductionMotionAsset({
      asset,
      memberId: 'm1',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    } as never);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
      'TEST 113 missing verification',
    );
  }
  assert(threw, 'TEST 113 must throw without verification');

  const result = await verifyProductionAuthority(asset);
  assert(result.verified === true, 'TEST 113 verification');
  let harnessErr: ProductionMotionAssetError | null = null;
  try {
    validateRealProductionMotionAsset({
      asset,
      authorityVerification: result,
      memberId: 'm1',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (err) {
    harnessErr = err;
  }
  assert(
    harnessErr?.code !== PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
    'TEST 113 passed authority gate',
  );
  console.log('TEST 113: PASS');
}

function test114MemberIsolationRegression() {
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
    assert(userMember?.memberId === c.selected, `TEST 114 user ${c.selected}`);
    assert(
      visibleAiMembers.map((v) => v.memberId).join(',') === c.visible.join(','),
      `TEST 114 visible ${c.selected}`,
    );
  }
  console.log('TEST 114: PASS');
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

function test115GroupRuntimeRegression() {
  assert(countGroupRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 115 mediapipe');
  let skeletonTotal = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    skeletonTotal += countGroupRuntimeImport(p);
  }
  assert(skeletonTotal === 0, `TEST 115 skeleton=${skeletonTotal}`);

  const teachingFiles = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  for (const rel of teachingFiles) {
    const content = readFileSync(resolve(rel), 'utf8');
    for (const token of ['verifyProductionAuthority', 'production-authority-verify']) {
      assert(!content.includes(token), `TEST 115 teaching ${rel} ${token}`);
    }
  }
  console.log('TEST 115: PASS');
}

async function run() {
  const { publicKeyPem } = ensureTestAuthorityKeyPair();
  setProductionAuthorityPublicKeyPem(publicKeyPem);
  setUseTestProductionAuthorityStore(true);
  clearTestProductionAuthorityRecords();

  await test102FakeAuthorityProofBlocked();
  await test103MissingAuthorityRecord();
  await test104ProductionAssetIdMismatch();
  await test105CrossAssetProofReuse();
  await test106GroupIdMismatch();
  await test107SongIdMismatch();
  await test108MemberSetMismatch();
  await test109RevokedAuthority();
  await test110RealProductionWithoutServerAuthority();
  await test111LoaderVerificationSuccess();
  await test112LoaderVerificationFailure();
  await test113HarnessRequiresAuthorityVerification();
  test114MemberIsolationRegression();
  test115GroupRuntimeRegression();

  clearTestProductionAuthorityRecords();
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityPublicKeyPem(null);
  console.log('productionAuthorityVerification tests: ALL PASS (TEST 102~115)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
