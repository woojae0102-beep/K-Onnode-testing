// @ts-nocheck
/**
 * PHASE 15 — Production Authority Fail-Closed tests (TEST 116~130)
 * Run: npx tsx src/modes/group/runtime/productionAuthorityFailClosed.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as THREE from 'three';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { DefaultProductionMotionAssetIngestor } from '../../../gx10/ingest/DefaultProductionMotionAssetIngestor';
import type { GX10ProductionMotionOutput } from '../../../gx10/contracts/GX10ProductionMotionOutput';
import {
  verifyProductionAuthority,
  setUseTestProductionAuthorityStore,
  clearTestProductionAuthorityRecords,
  registerTestProductionAuthorityRecord,
} from '../../../gx10/ingest/verifyProductionAuthority';
import { buildTestAuthorityRecord, ensureTestAuthorityKeyPair } from '../../../gx10/ingest/productionAuthorityTestSigning';
import { setProductionAuthorityPublicKeyPem } from '../../../gx10/ingest/verifyAuthoritySignature';
import {
  setProductionAuthorityFetchForTests,
  resetProductionAuthorityFetchForTests,
} from '../../../services/group/ProductionAuthorityVerifyApi';
import { loadProductionMotionAsset } from '../services/ProductionMotionAssetLoader';
import { evaluateProductionMotionRuntimeAuthorityGate, shouldCreateProductionMotionMixer } from './productionMotionRuntimeAuthorityGate';
import { computeProductionMotionFinalStatus } from './runProductionMotionRetargetGate';
import { isVerifiedPlaybackStatus } from '../../../gx10/ingest/productionAuthorityVerificationResult';
import { validateRealProductionMotionAsset } from './realProductionMotionValidationHarness';
import { createAuthorityVerificationFailure } from '../../../gx10/ingest/productionAuthorityVerificationResult';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildProcessorOutput(overrides: Partial<GX10ProductionMotionOutput> = {}): GX10ProductionMotionOutput {
  return {
    productionAssetId: 'prod-failclosed-001',
    schemaVersion: 2,
    groupId: 'failclosed-group',
    songId: 'failclosed-song',
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
  return new DefaultProductionMotionAssetIngestor().ingestCompletedJob({
    jobResult: { jobId: 'job-fc-1', status: 'completed', productionAssetId: output.productionAssetId },
    processorOutput: output,
    assetProvenance: 'real_production',
  }).asset;
}

function mockFetchResponse(status: number, body: unknown, delayMs = 0) {
  return async (_input: string | URL, init?: { signal?: AbortSignal }) => {
    if (delayMs > 0) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        if (init?.signal) {
          if (init.signal.aborted) {
            clearTimeout(timer);
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          init.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        }
      });
    }
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  };
}

async function test116NetworkTimeout() {
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityFetchForTests(
    mockFetchResponse(200, { verified: true }, 50) as typeof fetch,
    10,
  );
  const asset = ingestRealProduction();
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 116 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_TIMEOUT, `TEST 116 got ${result.failureCode}`);
  console.log('TEST 116: PASS');
}

async function test117FetchReject() {
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityFetchForTests(async () => {
    throw new TypeError('fetch failed');
  }, 5000);
  const asset = ingestRealProduction();
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 117 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NETWORK_ERROR, `TEST 117 got ${result.failureCode}`);
  console.log('TEST 117: PASS');
}

async function test118Http500() {
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityFetchForTests(
    mockFetchResponse(500, { error: 'internal', hint: 'firestore down' }) as typeof fetch,
    5000,
  );
  const asset = ingestRealProduction();
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 118 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SERVER_ERROR, `TEST 118 got ${result.failureCode}`);
  console.log('TEST 118: PASS');
}

async function test119Http404() {
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityFetchForTests(
    mockFetchResponse(404, { error: PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND, hint: 'not found' }) as typeof fetch,
    5000,
  );
  const asset = ingestRealProduction();
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 119 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND, `TEST 119 got ${result.failureCode}`);
  console.log('TEST 119: PASS');
}

async function test120InvalidJson() {
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityFetchForTests(async () => new Response('{not-json', { status: 200 }), 5000);
  const asset = ingestRealProduction();
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 120 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_BAD_RESPONSE, `TEST 120 got ${result.failureCode}`);
  console.log('TEST 120: PASS');
}

async function test121AuthorityMismatch() {
  setUseTestProductionAuthorityStore(true);
  const asset = ingestRealProduction();
  registerTestProductionAuthorityRecord({
    ...buildTestAuthorityRecord(asset),
    groupId: 'wrong-group',
  });
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 121 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH, `TEST 121 got ${result.failureCode}`);
  console.log('TEST 121: PASS');
}

async function test122Revoked() {
  setUseTestProductionAuthorityStore(true);
  const asset = ingestRealProduction();
  registerTestProductionAuthorityRecord({
    ...buildTestAuthorityRecord(asset),
    status: 'revoked',
  });
  const result = await verifyProductionAuthority(asset);
  assert(!result.verified, 'TEST 122 must fail');
  assert(result.failureCode === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED, `TEST 122 got ${result.failureCode}`);
  console.log('TEST 122: PASS');
}

async function test123LoaderBlocked() {
  setUseTestProductionAuthorityStore(false);
  const asset = ingestRealProduction();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: string | URL) => {
    const url = String(input);
    if (url.includes('production-dance')) {
      return new Response(JSON.stringify({ asset }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('production-authority-verify')) {
      return new Response(JSON.stringify({ error: PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SERVER_ERROR }), { status: 503 });
    }
    return originalFetch(input);
  };
  try {
    const loadResult = await loadProductionMotionAsset({
      groupId: asset.groupId,
      songId: asset.songId,
    });
    assert(loadResult.loadStatus === 'authority_blocked', `TEST 123 status=${loadResult.loadStatus}`);
    assert(Boolean(loadResult.authorityBlocked), 'TEST 123 authorityBlocked required');
    assert(loadResult.authorityBlocked!.verified === false, 'TEST 123 verified false');
    assert(!loadResult.authorityVerification, 'TEST 123 must not expose verification');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('TEST 123: PASS');
}

function test124RuntimeBlocked() {
  const gate = evaluateProductionMotionRuntimeAuthorityGate({
    assetProvenance: 'real_production',
    authorityBlocked: createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SERVER_ERROR,
      'blocked',
    ),
  });
  assert(gate.blocked === true, 'TEST 124 blocked');
  assert(gate.blockedStatus === 'BLOCKED_AUTHORITY_SERVER_ERROR', `TEST 124 status=${gate.blockedStatus}`);
  console.log('TEST 124: PASS');
}

function test125AnimationMixerNotCreated() {
  const mixerGate = shouldCreateProductionMotionMixer({
    assetProvenance: 'real_production',
    authorityBlocked: createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
      'blocked',
    ),
  });
  assert(mixerGate.allowed === false, 'TEST 125 mixer blocked');
  assert(mixerGate.blockedStatus === 'BLOCKED_AUTHORITY_VERIFICATION_FAILED', `TEST 125 ${mixerGate.blockedStatus}`);
  console.log('TEST 125: PASS');
}

function test126VerifiedNeverEmitted() {
  const status = computeProductionMotionFinalStatus({
    playbackPath: 'direct',
    binding: { bindingStatus: 'fully_bound', memberId: 'm1', boundTrackCount: 1, totalTrackCount: 1, unboundTracks: [] },
    motionClipAudit: { valid: true, trackCount: 1, durationSec: 1, reasons: [] },
    retargetedClipValid: false,
    transformProof: { transformProof: 'motion_detected' },
    authorityBlockedStatus: 'BLOCKED_AUTHORITY_NETWORK_ERROR',
  });
  assert(!isVerifiedPlaybackStatus(status), `TEST 126 must not verify, got ${status}`);
  assert(status === 'BLOCKED_AUTHORITY_NETWORK_ERROR', `TEST 126 status=${status}`);
  console.log('TEST 126: PASS');
}

function test127HarnessBlocked() {
  setUseTestProductionAuthorityStore(true);
  const asset = ingestRealProduction();
  let threw = false;
  try {
    validateRealProductionMotionAsset({
      asset,
      authorityVerification: createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED,
        'revoked',
      ) as never,
      memberId: 'm1',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED,
      `TEST 127 got ${err?.code}`,
    );
  }
  assert(threw, 'TEST 127 harness must throw on failed authority');
  console.log('TEST 127: PASS');
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

function test128MediaPipeImportZero() {
  assert(countGroupRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 128 mediapipe');
  console.log('TEST 128: PASS');
}

function test129SkeletonRuntimeImportZero() {
  let skeletonTotal = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    skeletonTotal += countGroupRuntimeImport(p);
  }
  assert(skeletonTotal === 0, `TEST 129 skeleton=${skeletonTotal}`);
  console.log('TEST 129: PASS');
}

function test130TeachingRegression() {
  const teachingFiles = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  for (const rel of teachingFiles) {
    const content = readFileSync(resolve(rel), 'utf8');
    for (const token of ['verifyProductionAuthority', 'production-authority-verify']) {
      assert(!content.includes(token), `TEST 130 teaching ${rel} ${token}`);
    }
  }
  console.log('TEST 130: PASS');
}

async function run() {
  const { publicKeyPem } = ensureTestAuthorityKeyPair();
  setProductionAuthorityPublicKeyPem(publicKeyPem);
  clearTestProductionAuthorityRecords();

  await test116NetworkTimeout();
  await test117FetchReject();
  await test118Http500();
  await test119Http404();
  await test120InvalidJson();
  await test121AuthorityMismatch();
  await test122Revoked();
  await test123LoaderBlocked();
  test124RuntimeBlocked();
  test125AnimationMixerNotCreated();
  test126VerifiedNeverEmitted();
  test127HarnessBlocked();
  test128MediaPipeImportZero();
  test129SkeletonRuntimeImportZero();
  test130TeachingRegression();

  resetProductionAuthorityFetchForTests();
  clearTestProductionAuthorityRecords();
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityPublicKeyPem(null);
  console.log('productionAuthorityFailClosed tests: ALL PASS (TEST 116~130)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
