// @ts-nocheck
/**
 * Production authority verification result contract (PHASE 15 — fail-closed).
 * verified=true only on full success; all failure codes are BLOCKED-boundary only.
 */
import type { ProductionAuthorityToken } from './ProductionAuthorityToken';
import type { ProductionMotionFinalStatus } from '../../modes/group/types/ProductionSkeletonContract';

export const PRODUCTION_AUTHORITY_FAILURE_CODES = {
  PRODUCTION_AUTHORITY_TIMEOUT: 'PRODUCTION_AUTHORITY_TIMEOUT',
  PRODUCTION_AUTHORITY_NETWORK_ERROR: 'PRODUCTION_AUTHORITY_NETWORK_ERROR',
  PRODUCTION_AUTHORITY_SERVER_ERROR: 'PRODUCTION_AUTHORITY_SERVER_ERROR',
  PRODUCTION_AUTHORITY_BAD_RESPONSE: 'PRODUCTION_AUTHORITY_BAD_RESPONSE',
  PRODUCTION_AUTHORITY_VERIFICATION_FAILED: 'PRODUCTION_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_NOT_FOUND: 'PRODUCTION_AUTHORITY_NOT_FOUND',
  PRODUCTION_AUTHORITY_MISMATCH: 'PRODUCTION_AUTHORITY_MISMATCH',
  PRODUCTION_AUTHORITY_REVOKED: 'PRODUCTION_AUTHORITY_REVOKED',
  PRODUCTION_AUTHORITY_SIGNATURE_INVALID: 'PRODUCTION_AUTHORITY_SIGNATURE_INVALID',
  PRODUCTION_AUTHORITY_EXPIRED: 'PRODUCTION_AUTHORITY_EXPIRED',
  PRODUCTION_ASSET_PROVENANCE_INVALID: 'PRODUCTION_ASSET_PROVENANCE_INVALID',
} as const;

export type ProductionAuthorityFailureCode =
  typeof PRODUCTION_AUTHORITY_FAILURE_CODES[keyof typeof PRODUCTION_AUTHORITY_FAILURE_CODES];

export type ProductionAuthorityVerificationSuccess = {
  verified: true;
  signatureVerified: true;
  productionAssetId: string;
  authorityRecordId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
  verifiedAt: string;
  status: 'active';
  authorityVersion: number;
  authorityToken: ProductionAuthorityToken;
};

export type ProductionAuthorityVerificationFailure = {
  verified: false;
  failureCode: ProductionAuthorityFailureCode;
  message: string;
  httpStatus?: number;
};

export type ProductionAuthorityVerificationResult =
  | ProductionAuthorityVerificationSuccess
  | ProductionAuthorityVerificationFailure;

export function createAuthorityVerificationFailure(
  failureCode: ProductionAuthorityFailureCode,
  message: string,
  httpStatus?: number,
): ProductionAuthorityVerificationFailure {
  return { verified: false, failureCode, message, ...(httpStatus != null ? { httpStatus } : {}) };
}

export function isAuthorityVerificationSuccess(
  result: ProductionAuthorityVerificationResult | null | undefined,
): result is ProductionAuthorityVerificationSuccess {
  return Boolean(result?.verified);
}

const FAILURE_TO_BLOCKED: Record<ProductionAuthorityFailureCode, ProductionMotionFinalStatus> = {
  PRODUCTION_AUTHORITY_TIMEOUT: 'BLOCKED_AUTHORITY_TIMEOUT',
  PRODUCTION_AUTHORITY_NETWORK_ERROR: 'BLOCKED_AUTHORITY_NETWORK_ERROR',
  PRODUCTION_AUTHORITY_SERVER_ERROR: 'BLOCKED_AUTHORITY_SERVER_ERROR',
  PRODUCTION_AUTHORITY_BAD_RESPONSE: 'BLOCKED_AUTHORITY_BAD_RESPONSE',
  PRODUCTION_AUTHORITY_VERIFICATION_FAILED: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_NOT_FOUND: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_MISMATCH: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_REVOKED: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_SIGNATURE_INVALID: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_AUTHORITY_EXPIRED: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
  PRODUCTION_ASSET_PROVENANCE_INVALID: 'BLOCKED_AUTHORITY_VERIFICATION_FAILED',
};

export function authorityFailureToBlockedStatus(
  failureCode: ProductionAuthorityFailureCode,
): ProductionMotionFinalStatus {
  return FAILURE_TO_BLOCKED[failureCode] ?? 'BLOCKED_AUTHORITY_VERIFICATION_FAILED';
}

export function isVerifiedPlaybackStatus(status: ProductionMotionFinalStatus): boolean {
  return status === 'VERIFIED_DIRECT_PLAYBACK' || status === 'VERIFIED_RETARGET_PLAYBACK';
}

export default ProductionAuthorityVerificationResult;
