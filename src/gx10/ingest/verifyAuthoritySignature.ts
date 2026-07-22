// @ts-nocheck
/**
 * Client-side Production Authority signature verification (PHASE 13.5).
 * Uses Web Crypto RSASSA-PKCS1-v1_5 + SHA-256.
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type { ProductionAuthorityToken } from './ProductionAuthorityToken';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../../modes/group/types/ProductionMotionAssetV2';
import {
  buildCanonicalAuthorityTokenPayload,
  computeProductionAssetIdentityHash,
  isAuthorityTokenExpired,
  sortedMemberIds,
  stripAuthorityTokenSignature,
} from './productionAuthorityTokenCanonical';

let configuredPublicKeyPem: string | null = null;
let cachedPublicKey: CryptoKey | null = null;
let cachedPublicKeyPem: string | null = null;

function readDefaultPublicKeyPem(): string | null {
  if (configuredPublicKeyPem) return configuredPublicKeyPem;
  const fromEnv = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, string> }).env?.VITE_PRODUCTION_AUTHORITY_PUBLIC_KEY
    : undefined;
  if (fromEnv?.trim()) {
    return fromEnv.replace(/\\n/g, '\n').trim();
  }
  return null;
}

export function setProductionAuthorityPublicKeyPem(pem: string | null): void {
  configuredPublicKeyPem = pem;
  cachedPublicKey = null;
  cachedPublicKeyPem = null;
}

function pemToSpkiBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importVerifyPublicKey(pem: string): Promise<CryptoKey> {
  if (cachedPublicKey && cachedPublicKeyPem === pem) {
    return cachedPublicKey;
  }
  const key = await crypto.subtle.importKey(
    'spki',
    pemToSpkiBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  cachedPublicKey = key;
  cachedPublicKeyPem = pem;
  return key;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifyAuthoritySignature(
  token: ProductionAuthorityToken,
  publicKeyPem?: string,
): Promise<void> {
  const pem = publicKeyPem ?? readDefaultPublicKeyPem();
  if (!pem) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
      'production authority public key not configured',
    );
  }

  if (!token?.signature) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority token signature missing',
    );
  }

  if (isAuthorityTokenExpired(token)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_EXPIRED,
      'authority token expired',
    );
  }

  const payload = stripAuthorityTokenSignature(token);
  const canonical = buildCanonicalAuthorityTokenPayload(payload);
  const data = new TextEncoder().encode(canonical);
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64ToBytes(token.signature);
  } catch {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority token signature malformed',
    );
  }
  const publicKey = await importVerifyPublicKey(pem);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      data,
    );
  } catch {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority token signature invalid',
    );
  }

  if (!valid) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority token signature invalid',
    );
  }
}

export async function assertAuthorityTokenMatchesAsset(
  asset: ProductionMotionAssetV2,
  token: ProductionAuthorityToken,
): Promise<void> {
  const memberIds = sortedMemberIds(asset.members.map((m) => m.memberId));

  if (token.productionAssetId !== asset.productionAssetId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'token productionAssetId mismatch',
    );
  }
  if (token.authorityRecordId !== asset.productionAuthorityProof?.authorityRecordId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'token authorityRecordId mismatch',
    );
  }
  if (token.groupId !== asset.groupId || token.songId !== asset.songId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'token group/song mismatch',
    );
  }

  const tokenMembers = sortedMemberIds(token.memberIds);
  if (tokenMembers.join(',') !== memberIds.join(',')) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'token memberIds mismatch',
    );
  }

  const expectedHash = await computeProductionAssetIdentityHash({
    productionAssetId: asset.productionAssetId!,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
  });

  if (token.assetHash !== expectedHash) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'token assetHash mismatch',
    );
  }
}

export async function verifyAuthorityTokenForAsset(
  asset: ProductionMotionAssetV2,
  token: ProductionAuthorityToken,
  publicKeyPem?: string,
): Promise<void> {
  await verifyAuthoritySignature(token, publicKeyPem);
  await assertAuthorityTokenMatchesAsset(asset, token);
}

export default verifyAuthoritySignature;
