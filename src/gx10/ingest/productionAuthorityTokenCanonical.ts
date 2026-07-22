// @ts-nocheck
/**
 * Canonical Production Authority Token payload + asset identity hash (PHASE 13.5).
 */
import type { ProductionAuthorityToken, ProductionAuthorityTokenPayload } from './ProductionAuthorityToken';
import {
  PRODUCTION_AUTHORITY_ALGORITHM,
  PRODUCTION_AUTHORITY_ISSUER,
  PRODUCTION_AUTHORITY_TOKEN_VERSION,
} from './ProductionAuthorityToken';

export function sortedMemberIds(memberIds: string[]): string[] {
  return [...memberIds].map((id) => id.trim()).filter(Boolean).sort();
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeProductionAssetIdentityHash(input: {
  productionAssetId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
}): Promise<string> {
  const canonical = JSON.stringify({
    productionAssetId: input.productionAssetId.trim(),
    groupId: input.groupId.trim(),
    songId: input.songId.trim(),
    memberIds: sortedMemberIds(input.memberIds),
  });
  return sha256Hex(canonical);
}

export function buildCanonicalAuthorityTokenPayload(
  fields: ProductionAuthorityTokenPayload,
): string {
  return JSON.stringify({
    version: fields.version,
    issuer: fields.issuer,
    issuedAt: fields.issuedAt,
    expiresAt: fields.expiresAt,
    productionAssetId: fields.productionAssetId,
    authorityRecordId: fields.authorityRecordId,
    groupId: fields.groupId,
    songId: fields.songId,
    memberIds: sortedMemberIds(fields.memberIds),
    authorityVersion: fields.authorityVersion,
    nonce: fields.nonce,
    assetHash: fields.assetHash,
    algorithm: fields.algorithm,
  });
}

export function stripAuthorityTokenSignature(
  token: ProductionAuthorityToken,
): ProductionAuthorityTokenPayload {
  const { signature, ...payload } = token;
  return payload;
}

export function isAuthorityTokenExpired(token: ProductionAuthorityToken, nowMs = Date.now()): boolean {
  const expiresMs = Date.parse(token.expiresAt);
  return !Number.isFinite(expiresMs) || expiresMs <= nowMs;
}

export function createAuthorityTokenPayload(input: {
  productionAssetId: string;
  authorityRecordId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
  authorityVersion: number;
  nonce: string;
  assetHash: string;
  issuedAt?: string;
  expiresAt?: string;
}): ProductionAuthorityTokenPayload {
  return {
    version: PRODUCTION_AUTHORITY_TOKEN_VERSION,
    issuer: PRODUCTION_AUTHORITY_ISSUER,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    productionAssetId: input.productionAssetId.trim(),
    authorityRecordId: input.authorityRecordId.trim(),
    groupId: input.groupId.trim(),
    songId: input.songId.trim(),
    memberIds: sortedMemberIds(input.memberIds),
    authorityVersion: input.authorityVersion,
    nonce: input.nonce.trim(),
    assetHash: input.assetHash,
    algorithm: PRODUCTION_AUTHORITY_ALGORITHM,
  };
}

export default computeProductionAssetIdentityHash;
