// @ts-nocheck
/**
 * PHASE 13.5 — Cryptographic Production Authority tests (TEST 116~127)
 * Run: npx tsx src/modes/group/runtime/productionAuthorityCryptographic.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { DefaultProductionMotionAssetIngestor } from '../../../gx10/ingest/DefaultProductionMotionAssetIngestor';
import type { GX10ProductionMotionOutput } from '../../../gx10/contracts/GX10ProductionMotionOutput';
import {
  verifyProductionAuthority,
  registerTestProductionAuthorityRecord,
  clearTestProductionAuthorityRecords,
  setUseTestProductionAuthorityStore,
} from '../../../gx10/ingest/verifyProductionAuthority';
import {
  buildTestAuthorityRecord,
  ensureTestAuthorityKeyPair,
  signTestAuthorityToken,
} from '../../../gx10/ingest/productionAuthorityTestSigning';
import {
  setProductionAuthorityPublicKeyPem,
  verifyAuthoritySignature,
  verifyAuthorityTokenForAsset,
} from '../../../gx10/ingest/verifyAuthoritySignature';
import { validateRealProductionMotionAsset } from './realProductionMotionValidationHarness';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const signing = require('../../../../lib/api-lib/productionAuthoritySigning.cjs');

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildProcessorOutput(overrides: Partial<GX10ProductionMotionOutput> = {}): GX10ProductionMotionOutput {
  return {
    productionAssetId: 'prod-crypto-001',
    schemaVersion: 2,
    groupId: 'crypto-group',
    songId: 'crypto-song',
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
    jobResult: { jobId: 'job-crypto-1', status: 'completed', productionAssetId: output.productionAssetId },
    processorOutput: output,
    assetProvenance: 'real_production',
  }).asset;
}

function setupSignedAsset(overrides: Partial<GX10ProductionMotionOutput> = {}) {
  const asset = ingestRealProduction(overrides);
  const record = buildTestAuthorityRecord(asset);
  registerTestProductionAuthorityRecord(record);
  return { asset, record };
}

function expectFailure(fn: () => Promise<unknown>, code: string, label: string) {
  return Promise.resolve(fn()).then((result: any) => {
    assert(!result?.verified, `${label} must fail`);
    assert(result?.failureCode === code, `${label} expected ${code}, got ${result?.failureCode ?? result}`);
  });
}

async function test116AuthorityForgeryBlocked() {
  const { asset, record } = setupSignedAsset();
  const forged = {
    ...record.authorityToken,
    signature: Buffer.from('forged-signature-bytes').toString('base64'),
  };
  asset.productionAuthorityToken = forged;
  registerTestProductionAuthorityRecord({ ...record, authorityToken: forged });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
    'TEST 116',
  );
  console.log('TEST 116: PASS');
}

async function test117MissingSignatureBlocked() {
  const { asset, record } = setupSignedAsset();
  const { signature, ...unsigned } = record.authorityToken;
  const token = { ...unsigned, signature: '' };
  asset.productionAuthorityToken = token as typeof asset.productionAuthorityToken;
  registerTestProductionAuthorityRecord({ ...record, authorityToken: token as typeof asset.productionAuthorityToken });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
    'TEST 117',
  );
  console.log('TEST 117: PASS');
}

async function test118ModifiedPayloadBlocked() {
  const { asset, record } = setupSignedAsset();
  const tampered = {
    ...record.authorityToken,
    groupId: 'tampered-group',
  };
  asset.productionAuthorityToken = tampered;
  registerTestProductionAuthorityRecord({ ...record, authorityToken: tampered });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
    'TEST 118',
  );
  console.log('TEST 118: PASS');
}

async function test119WrongSigningKeyBlocked() {
  const { asset, record } = setupSignedAsset();
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const memberIds = asset.members.map((m) => m.memberId);
  const fields = signing.createAuthorityTokenFields({
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: asset.productionAuthorityProof!.authorityRecordId,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
    authorityVersion: 1,
    nonce: 'wrong-key-nonce',
  });
  const wrongKeyToken = signing.signAuthorityTokenFields(fields, privateKey);
  asset.productionAuthorityToken = wrongKeyToken;
  registerTestProductionAuthorityRecord({
    ...record,
    authorityToken: wrongKeyToken,
    nonce: wrongKeyToken.nonce,
    assetHash: wrongKeyToken.assetHash,
  });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
    'TEST 119',
  );
  console.log('TEST 119: PASS');
}

async function test120ExpiredSignatureBlocked() {
  const asset = ingestRealProduction();
  const expiredToken = signTestAuthorityToken({
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: asset.productionAuthorityProof!.authorityRecordId,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds: asset.members.map((m) => m.memberId),
    authorityVersion: 1,
    nonce: 'expired-nonce',
    issuedAt: '2020-01-01T00:00:00.000Z',
    expiresAt: '2020-01-02T00:00:00.000Z',
  });
  asset.productionAuthorityToken = expiredToken;
  registerTestProductionAuthorityRecord({
    source: 'production_ingest',
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: asset.productionAuthorityProof!.authorityRecordId,
    ingestJobId: asset.productionAuthorityProof!.ingestJobId,
    ingestedAt: asset.productionAuthorityProof!.ingestedAt,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds: asset.members.map((m) => m.memberId).sort(),
    status: 'active',
    authorityVersion: 1,
    nonce: expiredToken.nonce,
    assetHash: expiredToken.assetHash,
    authorityToken: expiredToken,
  });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_EXPIRED,
    'TEST 120',
  );
  console.log('TEST 120: PASS');
}

async function test121CrossAssetSignatureReuseBlocked() {
  const { asset: assetA, record: recordA } = setupSignedAsset();
  const assetB = ingestRealProduction({
    productionAssetId: 'prod-crypto-002',
    groupId: 'crypto-group-b',
    songId: 'crypto-song-b',
    members: [{
      ...buildProcessorOutput().members[0],
      memberId: 'm2',
      motion: { ...buildProcessorOutput().members[0].motion, motionAssetId: 'motion-2' },
    }],
  });
  assetB.productionAuthorityToken = recordA.authorityToken;
  registerTestProductionAuthorityRecord({
    source: 'production_ingest',
    productionAssetId: assetB.productionAssetId!,
    authorityRecordId: assetB.productionAuthorityProof!.authorityRecordId,
    ingestJobId: assetB.productionAuthorityProof!.ingestJobId,
    ingestedAt: assetB.productionAuthorityProof!.ingestedAt,
    groupId: assetB.groupId,
    songId: assetB.songId,
    memberIds: assetB.members.map((m) => m.memberId).sort(),
    status: 'active',
    authorityVersion: recordA.authorityVersion,
    nonce: recordA.nonce,
    assetHash: recordA.assetHash,
    authorityToken: recordA.authorityToken,
  });
  await expectFailure(
    () => verifyProductionAuthority(assetB),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 121',
  );
  console.log('TEST 121: PASS');
}

async function test122RevokedAuthorityWithValidSignature() {
  const { asset, record } = setupSignedAsset();
  registerTestProductionAuthorityRecord({ ...record, status: 'revoked' });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED,
    'TEST 122',
  );
  console.log('TEST 122: PASS');
}

async function test123ReplayNonceMismatchBlocked() {
  const { asset, record } = setupSignedAsset();
  const replayToken = signTestAuthorityToken({
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: asset.productionAuthorityProof!.authorityRecordId,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds: asset.members.map((m) => m.memberId),
    authorityVersion: 1,
    nonce: 'replay-nonce-different',
  });
  registerTestProductionAuthorityRecord({
    ...record,
    nonce: 'server-bound-nonce',
    authorityToken: replayToken,
    assetHash: replayToken.assetHash,
  });
  await expectFailure(
    () => verifyProductionAuthority(asset),
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
    'TEST 123',
  );
  console.log('TEST 123: PASS');
}

async function test124HarnessRequiresSignatureVerified() {
  const { asset } = setupSignedAsset();
  const result = await verifyProductionAuthority(asset);
  assert(result.verified === true, 'TEST 124 verified');
  assert(result.signatureVerified === true, 'TEST 124 signatureVerified');
  let harnessErr: ProductionMotionAssetError | null = null;
  try {
    validateRealProductionMotionAsset({
      asset,
      authorityVerification: { ...result, signatureVerified: false as never },
      memberId: 'm1',
      avatarRoot: new THREE.Group(),
      motionScene: new THREE.Group(),
      motionClips: [],
    });
  } catch (err) {
    harnessErr = err;
  }
  assert(
    harnessErr?.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
    'TEST 124 harness blocks unsigned verification',
  );
  console.log('TEST 124: PASS');
}

async function test125DirectSignatureVerifySuccess() {
  const { asset } = setupSignedAsset();
  const { publicKeyPem } = ensureTestAuthorityKeyPair();
  await verifyAuthorityTokenForAsset(asset, asset.productionAuthorityToken!, publicKeyPem);
  console.log('TEST 125: PASS');
}

async function test126AssetHashBinding() {
  const { asset } = setupSignedAsset();
  const token = { ...asset.productionAuthorityToken!, assetHash: 'deadbeef'.repeat(8) };
  let threw = false;
  try {
    await verifyAuthorityTokenForAsset(asset, token);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      `TEST 126 got ${err?.code}`,
    );
  }
  assert(threw, 'TEST 126 must throw');
  console.log('TEST 126: PASS');
}

async function test127VerifySignatureWithoutPublicKeyFails() {
  const { asset } = setupSignedAsset();
  setProductionAuthorityPublicKeyPem(null);
  await expectFailure(
    async () => {
      try {
        await verifyAuthoritySignature(asset.productionAuthorityToken!);
        return { verified: true };
      } catch (err) {
        if (err instanceof ProductionMotionAssetError) {
          return { verified: false, failureCode: err.code, message: err.message };
        }
        throw err;
      }
    },
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
    'TEST 127',
  );
  const { publicKeyPem } = ensureTestAuthorityKeyPair();
  setProductionAuthorityPublicKeyPem(publicKeyPem);
  console.log('TEST 127: PASS');
}

async function run() {
  const { publicKeyPem } = ensureTestAuthorityKeyPair();
  setProductionAuthorityPublicKeyPem(publicKeyPem);
  setUseTestProductionAuthorityStore(true);
  clearTestProductionAuthorityRecords();

  await test116AuthorityForgeryBlocked();
  await test117MissingSignatureBlocked();
  await test118ModifiedPayloadBlocked();
  await test119WrongSigningKeyBlocked();
  await test120ExpiredSignatureBlocked();
  await test121CrossAssetSignatureReuseBlocked();
  await test122RevokedAuthorityWithValidSignature();
  await test123ReplayNonceMismatchBlocked();
  await test124HarnessRequiresSignatureVerified();
  await test125DirectSignatureVerifySuccess();
  await test126AssetHashBinding();
  await test127VerifySignatureWithoutPublicKeyFails();

  clearTestProductionAuthorityRecords();
  setUseTestProductionAuthorityStore(false);
  setProductionAuthorityPublicKeyPem(null);
  console.log('productionAuthorityCryptographic tests: ALL PASS (TEST 116~127)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
