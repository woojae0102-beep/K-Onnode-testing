// @ts-nocheck
/**
 * Test-only Production Authority signing helpers (PHASE 13.5).
 * Uses the same canonical payload + RSA-SHA256 as production server signing.
 */
import { createRequire } from 'node:module';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type { ProductionAuthorityRecord } from './productionAuthorityVerification';
import type { ProductionAuthorityToken } from './ProductionAuthorityToken';

const require = createRequire(import.meta.url);
const signing = require('../../../lib/api-lib/productionAuthoritySigning.cjs');

let testPrivateKeyPem: string | null = null;
let testPublicKeyPem: string | null = null;

export function ensureTestAuthorityKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  if (!testPrivateKeyPem || !testPublicKeyPem) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    testPrivateKeyPem = privateKey;
    testPublicKeyPem = publicKey;
  }
  return { privateKeyPem: testPrivateKeyPem, publicKeyPem: testPublicKeyPem };
}

export function signTestAuthorityToken(input: {
  productionAssetId: string;
  authorityRecordId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
  authorityVersion?: number;
  nonce?: string;
  issuedAt?: string;
  expiresAt?: string;
}): ProductionAuthorityToken {
  const { privateKeyPem } = ensureTestAuthorityKeyPair();
  const fields = signing.createAuthorityTokenFields({
    ...input,
    authorityVersion: input.authorityVersion ?? 1,
    nonce: input.nonce ?? randomBytes(16).toString('hex'),
  });
  return signing.signAuthorityTokenFields(fields, privateKeyPem);
}

export function buildTestAuthorityRecord(asset: ProductionMotionAssetV2): ProductionAuthorityRecord {
  const proof = asset.productionAuthorityProof!;
  const memberIds = asset.members.map((m) => m.memberId).sort();
  const nonce = `test-nonce-${asset.productionAssetId}`;
  const token = signTestAuthorityToken({
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: proof.authorityRecordId,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
    authorityVersion: 1,
    nonce,
  });
  asset.productionAuthorityToken = token;
  return {
    source: 'production_ingest',
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: proof.authorityRecordId,
    ingestJobId: proof.ingestJobId,
    ingestedAt: proof.ingestedAt,
    ingestedBy: proof.ingestedBy,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
    status: 'active',
    authorityVersion: 1,
    nonce,
    assetHash: token.assetHash,
    authorityToken: token,
  };
}

export default buildTestAuthorityRecord;
