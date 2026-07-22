// @ts-nocheck
/**
 * PHASE 10 — Provenance Security tests (TEST 79~88)
 * Run: npx tsx src/modes/group/runtime/productionProvenanceSecurity.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

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
import { isValidProductionAuthorityProof } from '../../../gx10/ingest/productionAuthorityProof';

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
  const ingestor = new DefaultProductionMotionAssetIngestor();
  return ingestor.ingestCompletedJob({
    jobResult: { jobId: 'job-real-1', status: 'completed', productionAssetId: 'prod-asset-001' },
    processorOutput: buildProcessorOutput(overrides),
    assetProvenance: 'real_production',
  });
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

function test79RegistryBlocksRealProduction() {
  clearTestProductionMotionAssets();
  const asset = cloneAsset();
  asset.assetProvenance = 'real_production';
  expectError(
    () => registerTestProductionMotionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 79',
  );
  console.log('TEST 79: PASS');
}

function test80SyntheticPromotionBlocked() {
  clearTestProductionMotionAssets();
  const asset = cloneAsset();
  assert(asset.assetProvenance === 'synthetic_test', 'TEST 80 baseline');
  asset.assetProvenance = 'real_production';
  expectError(
    () => registerTestProductionMotionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 80 register',
  );
  expectError(
    () => assertRealProductionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 80 assert',
  );
  console.log('TEST 80: PASS');
}

function test81DevFixturePromotionBlocked() {
  clearTestProductionMotionAssets();
  const asset = cloneAsset();
  asset.assetProvenance = 'dev_fixture';
  asset.assetProvenance = 'real_production';
  expectError(
    () => registerTestProductionMotionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 81 register',
  );
  expectError(
    () => assertRealProductionAsset(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 81 assert',
  );
  console.log('TEST 81: PASS');
}

function test82LegacyV1ProvenanceUnknown() {
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
  assert(v2.assetProvenance === undefined, 'TEST 82 no provenance');
  assert(v2.trustedProvenance === undefined, 'TEST 82 no trusted');
  expectError(
    () => assertRealProductionAsset(v2),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_UNKNOWN,
    'TEST 82',
  );
  console.log('TEST 82: PASS');
}

function test83IngestBoundaryCreatesRealProduction() {
  const result = ingestRealProduction();
  assert(result.asset.assetProvenance === 'real_production', 'TEST 83 provenance');
  assert(result.asset.trustedProvenance?.source === 'production_ingest', 'TEST 83 seal');
  assert(isValidProductionAuthorityProof(result.asset.productionAuthorityProof, result.asset.productionAssetId), 'TEST 83 authority');
  assert(assertRealProductionAsset(result.asset) === 'real_production', 'TEST 83 assert');
  console.log('TEST 83: PASS');
}

function test84IncompleteProcessorOutputFails() {
  expectError(
    () => ingestRealProduction({ members: [] }),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
    'TEST 84 members',
  );
  expectError(
    () => ingestRealProduction({ markAsRealProduction: false }),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 84 mark',
  );
  console.log('TEST 84: PASS');
}

function test85DuplicateIdsFail() {
  const base = buildProcessorOutput().members[0];
  expectError(
    () => ingestRealProduction({
      members: [base, { ...base, memberName: 'M2' }],
    }),
    PRODUCTION_MOTION_ERRORS.DUPLICATE_MEMBER_ID,
    'TEST 85 memberId',
  );
  expectError(
    () => ingestRealProduction({
      members: [
        base,
        {
          ...base,
          memberId: 'm2',
          memberName: 'M2',
          avatarAssetId: 'av-2',
          motion: { ...base.motion, motionAssetId: 'motion-1' },
        },
      ],
    }),
    PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID,
    'TEST 85 motionAssetId',
  );
  expectError(
    () => ingestRealProduction({
      members: [
        base,
        { ...base, memberId: 'm2', memberName: 'M2', avatarAssetId: 'av-2', motion: { ...base.motion, motionAssetId: 'motion-2', motionUrl: base.motion.motionUrl } },
      ],
    }),
    PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL,
    'TEST 85 motionUrl',
  );
  console.log('TEST 85: PASS');
}

function test86MissingSourceSkeletonProfileFails() {
  const output = buildProcessorOutput();
  output.members[0].motion.sourceSkeletonProfile = 'UNKNOWN';
  expectError(
    () => new DefaultProductionMotionAssetIngestor().ingestCompletedJob({
      jobResult: { jobId: 'j1', status: 'completed', productionAssetId: 'prod-asset-001' },
      processorOutput: output,
      assetProvenance: 'real_production',
    }),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
    'TEST 86',
  );
  console.log('TEST 86: PASS');
}

function test87MissingAvatarSkeletonProfileFails() {
  const output = buildProcessorOutput();
  delete output.members[0].avatarSkeletonProfile;
  expectError(
    () => new DefaultProductionMotionAssetIngestor().ingestCompletedJob({
      jobResult: { jobId: 'j1', status: 'completed', productionAssetId: 'prod-asset-001' },
      processorOutput: output,
      assetProvenance: 'real_production',
    }),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_SKELETON_PROFILE_UNSUPPORTED,
    'TEST 87',
  );
  console.log('TEST 87: PASS');
}

function test88RealHarnessGate() {
  const synthetic = cloneAsset();
  let syntheticErr: ProductionMotionAssetError | null = null;
  try {
    validateRealProductionMotionAsset({
      asset: synthetic,
      memberId: 'member_a',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (err) {
    syntheticErr = err;
  }
  assert(
    syntheticErr?.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
    'TEST 88 synthetic blocked',
  );

  const realAsset = ingestRealProduction().asset;
  let realErr: ProductionMotionAssetError | null = null;
  try {
    validateRealProductionMotionAsset({
      asset: realAsset,
      memberId: 'm1',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (err) {
    realErr = err;
  }
  assert(
    realErr?.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
    `TEST 88 real blocked without server verification, got ${realErr?.code}`,
  );
  console.log('TEST 88: PASS');
}

async function run() {
  test79RegistryBlocksRealProduction();
  test80SyntheticPromotionBlocked();
  test81DevFixturePromotionBlocked();
  test82LegacyV1ProvenanceUnknown();
  test83IngestBoundaryCreatesRealProduction();
  test84IncompleteProcessorOutputFails();
  test85DuplicateIdsFail();
  test86MissingSourceSkeletonProfileFails();
  test87MissingAvatarSkeletonProfileFails();
  test88RealHarnessGate();
  clearTestProductionMotionAssets();
  console.log('productionProvenanceSecurity tests: ALL PASS (TEST 79~88)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
