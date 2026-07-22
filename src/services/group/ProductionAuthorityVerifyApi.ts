// @ts-nocheck
/**
 * Production Authority Verification API client (PHASE 13 / 15 fail-closed).
 * Never throws — returns typed failure result.
 */
import {
  createAuthorityVerificationFailure,
  type ProductionAuthorityVerificationResult,
} from '../../gx10/ingest/productionAuthorityVerificationResult';
import { PRODUCTION_MOTION_ERRORS } from '../../modes/group/types/ProductionMotionAssetV2';

const API = '/api/group?path=production-authority-verify';
const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchProductionAuthorityVerificationParams = {
  productionAssetId: string;
  authorityRecordId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
};

let fetchImpl: typeof fetch = fetch;
let timeoutMs = DEFAULT_TIMEOUT_MS;

export function setProductionAuthorityFetchForTests(
  impl: typeof fetch,
  nextTimeoutMs?: number,
): void {
  fetchImpl = impl;
  if (nextTimeoutMs != null) timeoutMs = nextTimeoutMs;
}

export function resetProductionAuthorityFetchForTests(): void {
  fetchImpl = fetch;
  timeoutMs = DEFAULT_TIMEOUT_MS;
}

function mapHttpStatusToFailure(status: number, hint?: string): ProductionAuthorityVerificationResult {
  if (status === 404) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
      hint || 'authority record not found',
      status,
    );
  }
  if (status >= 500) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SERVER_ERROR,
      hint || `authority server error (${status})`,
      status,
    );
  }
  return createAuthorityVerificationFailure(
    PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_VERIFICATION_FAILED,
    hint || `authority verification failed (${status})`,
    status,
  );
}

function isVerificationPayload(value: unknown): value is {
  verified: true;
  signatureVerified?: boolean;
  productionAssetId: string;
  authorityRecordId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
  verifiedAt?: string;
  status?: string;
  authorityVersion?: number;
  authorityToken?: { signature?: string };
} {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.verified === true
    && typeof v.productionAssetId === 'string'
    && typeof v.authorityRecordId === 'string'
    && typeof v.groupId === 'string'
    && typeof v.songId === 'string'
    && Array.isArray(v.memberIds)
  );
}

export async function fetchProductionAuthorityVerification(
  params: FetchProductionAuthorityVerificationParams,
): Promise<ProductionAuthorityVerificationResult> {
  const qs = new URLSearchParams({
    productionAssetId: params.productionAssetId,
    authorityRecordId: params.authorityRecordId,
    groupId: params.groupId,
    songId: params.songId,
    memberIds: params.memberIds.join(','),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(`${API}&${qs.toString()}`, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const message = (err as Error)?.message || 'authority verification network error';
    if ((err as Error)?.name === 'AbortError' || message.toLowerCase().includes('abort')) {
      return createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_TIMEOUT,
        `authority verification timed out after ${timeoutMs}ms`,
      );
    }
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NETWORK_ERROR,
      message,
    );
  }
  clearTimeout(timer);

  let rawText = '';
  try {
    rawText = await res.text();
  } catch (err) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NETWORK_ERROR,
      (err as Error)?.message || 'authority response read failed',
    );
  }

  let data: Record<string, unknown> = {};
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      return createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_BAD_RESPONSE,
        'authority verification response is not valid JSON',
        res.status,
      );
    }
  } else if (!res.ok) {
    return mapHttpStatusToFailure(res.status, 'empty authority verification response');
  }

  if (!res.ok) {
    const hint = typeof data?.hint === 'string' ? data.hint : undefined;
    const code = typeof data?.error === 'string' ? data.error : undefined;
    if (code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND || res.status === 404) {
      return createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_NOT_FOUND,
        hint || 'authority record not found',
        res.status,
      );
    }
    if (code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED) {
      return createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_REVOKED,
        hint || 'authority revoked',
        res.status,
      );
    }
    if (code === PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH) {
      return createAuthorityVerificationFailure(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_MISMATCH,
        hint || 'authority mismatch',
        res.status,
      );
    }
    return mapHttpStatusToFailure(res.status, hint);
  }

  const verification = data?.verification ?? data;
  if (!isVerificationPayload(verification)) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_BAD_RESPONSE,
      'authority verification response schema invalid',
      res.status,
    );
  }

  if (!verification.authorityToken?.signature) {
    return createAuthorityVerificationFailure(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_AUTHORITY_SIGNATURE_INVALID,
      'authority token missing from server verification',
      res.status,
    );
  }

  return {
    verified: true,
    signatureVerified: true,
    productionAssetId: verification.productionAssetId,
    authorityRecordId: verification.authorityRecordId,
    groupId: verification.groupId,
    songId: verification.songId,
    memberIds: [...verification.memberIds].sort(),
    verifiedAt: verification.verifiedAt || new Date().toISOString(),
    status: 'active',
    authorityVersion: verification.authorityVersion ?? 1,
    authorityToken: verification.authorityToken as ProductionAuthorityVerificationResult['authorityToken'],
  };
}

export default fetchProductionAuthorityVerification;
