// @ts-nocheck
/**
 * Map GX10 REST / persist errors → adapter fail-closed results (PHASE 21).
 */
import type { AdapterResult } from '../ProductionMotionGenerationAdapter';
import { ADAPTER_ERROR_CODES } from '../adapterFailClosed';

const FATAL_GX10_CODES = new Set([
  'GX10_AUTH_FAILED',
  'PRODUCTION_AUTHORITY_SIGNING_KEY_MISSING',
  'GX10_JOB_CANCELLED',
]);

export function gx10ErrorToAdapterResult(err: unknown): AdapterResult {
  const code = (err as { code?: string })?.code || 'GX10_UNKNOWN_ERROR';
  const message = (err as Error)?.message || String(err);

  const mappedCode =
    code === 'GX10_JOB_SUBMIT_FAILED' ? ADAPTER_ERROR_CODES.SUBMIT_FAILED
      : code === 'GX10_POLL_TIMEOUT' ? ADAPTER_ERROR_CODES.POLL_TIMEOUT
        : code === 'GX10_MOTION_DOWNLOAD_FAILED' || code === 'GX10_JOB_RESULT_FAILED'
          ? ADAPTER_ERROR_CODES.DOWNLOAD_FAILED
          : code === 'GX10_JOB_FAILED' ? ADAPTER_ERROR_CODES.POLL_FAILED
            : code === 'PRODUCTION_AUTHORITY_SIGNING_KEY_MISSING' ? ADAPTER_ERROR_CODES.AUTHORITY_FAILED
              : code.startsWith('GX10_') ? code
                : ADAPTER_ERROR_CODES.PREREQUISITE_MISSING;

  return {
    ok: false,
    errorCode: mappedCode,
    message,
    recoverable: !FATAL_GX10_CODES.has(code),
  };
}

export default gx10ErrorToAdapterResult;
