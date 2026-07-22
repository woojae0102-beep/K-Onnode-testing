// @ts-nocheck
/**
 * Server authority verification + cryptographic signature verify (PHASE 13 / 13.5 / 15 fail-closed).
 * Never throws on verification failure — returns typed ProductionAuthorityVerificationResult.
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type {
  ProductionAuthorityRecord,
  ProductionAuthorityVerification,
} from './productionAuthorityVerification';
import type { ProductionAuthorityToken } from './ProductionAuthorityToken';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../../modes/group/types/ProductionMotionAssetV2';
import { validateProvenanceTrustBoundary } from './validateProvenanceTrustBoundary';
import { fetchProductionAuthorityVerification } from '../../services/group/ProductionAuthorityVerifyApi';
import { verifyAuthorityTokenForAsset } from './verifyAuthoritySignature';
import {
  createAuthorityVerificationFailure,
  isAuthorityVerificationSuccess,
  type ProductionAuthorityVerificationFailure,
  type ProductionAuthorityVerificationResult,
} from './productionAuthorityVerificationResult';

export type { ProductionAuthorityRecord, ProductionAuthorityVerification };
export type { ProductionAuthorityVerificationResult, ProductionAuthorityVerificationFailure };

const testAuthorityRecords = new Map<string, ProductionAuthorityRecord>();
let useTestAuthorityStore = false;

export function setUseTestProductionAuthorityStore(enabled: boolean): void {
  useTestAuthorityStore = enabled;
}

export function registerTestProductionAuthorityRecord(record: ProductionAuthorityRecord): void {
  testAuthorityRecords.set(record.authorityRecordId, record);
}

export function clearTestProductionAuthorityRecords(): void {
  testAuthorityRecords.clear();
}

function sortedMemberIds(asset: ProductionMotionAssetV2): string[] {
  return asset.members.map((m) => m.memberId).sort();
}

function memberSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function failFromError(err: unknown): ProductionAuthorityVerificationFailure {
  if (err instanceof ProductionMotionAssetError) {
    const code = err.code in PRODUCTION_MOTION_ERRORS ? err.code : PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED;
    return createAuthorityVerificationFailure(code as ProductionAuthorityVerificationFailure['failureCode'], err.message);
  }
  return createAuthorityVerificationFailure(
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
    (err as Error)?.message || 'authority verification failed',
  );
}

function resolveAuthorityToken(
  asset: ProductionMotionAssetV2,
  record: ProductionAuthorityRecord,
): ProductionAuthorityToken | ProductionAuthorityVerificationFailure {
  const token = record.authorityToken ?? asset.productionAuthorityToken;
  if (!token) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority token missing',
    );
  }
  return token;
}

function assertRecordTokenBinding(
  record: ProductionAuthorityRecord,
  token: ProductionAuthorityToken,
): ProductionAuthorityVerificationFailure | null {
  if (record.authorityVersion != null && token.authorityVersion !== record.authorityVersion) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'authorityVersion mismatch with authority record',
    );
  }
  if (record.nonce && token.nonce !== record.nonce) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'nonce mismatch with authority record',
    );
  }
  if (record.assetHash && token.assetHash !== record.assetHash) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'assetHash mismatch with authority record',
    );
  }
  return null;
}

async function verifyAgainstRecord(
  asset: ProductionMotionAssetV2,
  record: ProductionAuthorityRecord,
): Promise<ProductionAuthorityVerificationResult> {
  const proof = asset.productionAuthorityProof!;

  if (record.status === 'revoked') {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED,
      `authority record ${record.authorityRecordId} revoked`,
    );
  }

  if (record.productionAssetId !== asset.productionAssetId) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'productionAssetId mismatch with authority record',
    );
  }

  if (record.authorityRecordId !== proof.authorityRecordId) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'authorityRecordId mismatch with authority record',
    );
  }

  if (record.groupId !== asset.groupId) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'groupId mismatch with authority record',
    );
  }

  if (record.songId !== asset.songId) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'songId mismatch with authority record',
    );
  }

  const memberIds = sortedMemberIds(asset);
  if (record.memberIds?.length && !memberSetsEqual(memberIds, [...record.memberIds].sort())) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'memberIds mismatch with authority record',
    );
  }

  const tokenOrFailure = resolveAuthorityToken(asset, record);
  if (!('signature' in tokenOrFailure)) {
    return tokenOrFailure;
  }

  const bindingFailure = assertRecordTokenBinding(record, tokenOrFailure);
  if (bindingFailure) return bindingFailure;

  try {
    await verifyAuthorityTokenForAsset(asset, tokenOrFailure);
  } catch (err) {
    return failFromError(err);
  }

  return {
    verified: true,
    signatureVerified: true,
    productionAssetId: record.productionAssetId,
    authorityRecordId: record.authorityRecordId,
    groupId: record.groupId,
    songId: record.songId,
    memberIds: record.memberIds?.length ? [...record.memberIds].sort() : memberIds,
    verifiedAt: new Date().toISOString(),
    status: 'active',
    authorityVersion: tokenOrFailure.authorityVersion,
    authorityToken: tokenOrFailure,
  };
}

export async function verifyProductionAuthority(
  asset: ProductionMotionAssetV2,
): Promise<ProductionAuthorityVerificationResult> {
  if (asset.assetProvenance !== 'real_production') {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
      'server authority verification requires real_production',
    );
  }

  try {
    validateProvenanceTrustBoundary(asset);
  } catch (err) {
    return failFromError(err);
  }

  const proof = asset.productionAuthorityProof!;
  const memberIds = sortedMemberIds(asset);

  if (useTestAuthorityStore) {
    const record = testAuthorityRecords.get(proof.authorityRecordId);
    if (!record) {
      return createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
        `authority record ${proof.authorityRecordId} not found`,
      );
    }
    return verifyAgainstRecord(asset, record);
  }

  const verification = await fetchProductionAuthorityVerification({
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: proof.authorityRecordId,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds,
  });

  if (!isAuthorityVerificationSuccess(verification)) {
    return verification;
  }

  try {
    await verifyAuthorityTokenForAsset(asset, verification.authorityToken);
    assertAuthorityVerificationMatchesAsset(asset, verification);
  } catch (err) {
    return failFromError(err);
  }

  return {
    ...verification,
    signatureVerified: true,
  };
}

export function assertAuthorityVerificationMatchesAsset(
  asset: ProductionMotionAssetV2,
  verification: ProductionAuthorityVerificationResult,
): asserts verification is ProductionAuthorityVerification {
  if (!verification || !('verified' in verification) || !verification.verified) {
    const failureCode = verification && !verification.verified
      ? verification.failureCode
      : PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED;
    throw new ProductionMotionAssetError(
      failureCode,
      verification && !verification.verified
        ? verification.message
        : 'server authority verification missing',
    );
  }

  if (!verification.signatureVerified) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority signature not verified',
    );
  }

  if (verification.productionAssetId !== asset.productionAssetId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'verification productionAssetId mismatch',
    );
  }

  if (verification.groupId !== asset.groupId || verification.songId !== asset.songId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'verification group/song mismatch',
    );
  }

  const memberIds = sortedMemberIds(asset);
  if (!memberSetsEqual(memberIds, [...verification.memberIds].sort())) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'verification memberIds mismatch',
    );
  }

  if (asset.productionAuthorityProof?.authorityRecordId !== verification.authorityRecordId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
      'verification authorityRecordId mismatch',
    );
  }

  if (!verification.authorityToken?.signature) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'verification authority token missing',
    );
  }
}

export function authorityRecordFromIngestedAsset(
  asset: ProductionMotionAssetV2,
): Omit<ProductionAuthorityRecord, 'authorityToken' | 'authorityVersion' | 'nonce' | 'assetHash'> {
  const proof = asset.productionAuthorityProof!;
  return {
    source: 'production_ingest',
    productionAssetId: asset.productionAssetId!,
    authorityRecordId: proof.authorityRecordId,
    ingestJobId: proof.ingestJobId,
    ingestedAt: proof.ingestedAt,
    ingestedBy: proof.ingestedBy,
    groupId: asset.groupId,
    songId: asset.songId,
    memberIds: sortedMemberIds(asset),
    status: 'active',
  };
}

export default verifyProductionAuthority;
