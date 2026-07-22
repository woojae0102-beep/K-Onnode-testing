// @ts-nocheck
/**
 * Adapter fail-closed validation (PHASE 20).
 */
import type { AdapterResult } from './ProductionMotionGenerationAdapter';
import type { AdapterExecutionState } from './AdapterExecutionState';

export const ADAPTER_ERROR_CODES = {
  SUBMIT_FAILED: 'ADAPTER_SUBMIT_FAILED',
  POLL_FAILED: 'ADAPTER_POLL_FAILED',
  POLL_TIMEOUT: 'ADAPTER_POLL_TIMEOUT',
  POLL_NOT_COMPLETE: 'ADAPTER_POLL_NOT_COMPLETE',
  DOWNLOAD_FAILED: 'ADAPTER_DOWNLOAD_FAILED',
  PERSIST_FAILED: 'ADAPTER_PERSIST_FAILED',
  AUTHORITY_FAILED: 'ADAPTER_AUTHORITY_FAILED',
  CANCEL_FAILED: 'ADAPTER_CANCEL_FAILED',
  RETRY_FAILED: 'ADAPTER_RETRY_FAILED',
  RETRY_LIMIT: 'ADAPTER_RETRY_LIMIT',
  PREREQUISITE_MISSING: 'ADAPTER_PREREQUISITE_MISSING',
  RUNTIME_REGISTER_BEFORE_READY: 'ADAPTER_RUNTIME_REGISTER_BEFORE_READY',
  RESUME_AFTER_CANCEL: 'ADAPTER_RESUME_AFTER_CANCEL',
} as const;

export function unwrapAdapterResult<T>(
  result: AdapterResult<T>,
  fallbackCode: string,
): { ok: true; data: T } | { ok: false; errorCode: string; message?: string; recoverable?: boolean } {
  if (!result.ok) {
    return {
      ok: false,
      errorCode: result.errorCode || fallbackCode,
      message: result.message,
      recoverable: result.recoverable,
    };
  }
  return { ok: true, data: (result.data || {}) as T };
}

export function requireSubmitComplete(state: AdapterExecutionState): AdapterResult {
  if (!state.submitCompleted || !state.externalJobId) {
    return {
      ok: false,
      errorCode: ADAPTER_ERROR_CODES.PREREQUISITE_MISSING,
      message: 'submitJob must complete before this stage',
    };
  }
  return { ok: true };
}

export function requirePollComplete(state: AdapterExecutionState): AdapterResult {
  const submit = requireSubmitComplete(state);
  if (!submit.ok) return submit;
  if (!state.pollCompleted) {
    return {
      ok: false,
      errorCode: ADAPTER_ERROR_CODES.POLL_NOT_COMPLETE,
      message: 'pollJob must complete before this stage',
    };
  }
  return { ok: true };
}

export function requireDownloadComplete(state: AdapterExecutionState): AdapterResult {
  const poll = requirePollComplete(state);
  if (!poll.ok) return poll;
  if (!state.downloadCompleted || !state.motionGlbUrl) {
    return {
      ok: false,
      errorCode: ADAPTER_ERROR_CODES.PREREQUISITE_MISSING,
      message: 'downloadMotion must complete before this stage',
    };
  }
  return { ok: true };
}

export function requirePersistComplete(state: AdapterExecutionState): AdapterResult {
  const dl = requireDownloadComplete(state);
  if (!dl.ok) return dl;
  if (!state.persistCompleted || !state.productionMotionAssetId) {
    return {
      ok: false,
      errorCode: ADAPTER_ERROR_CODES.PREREQUISITE_MISSING,
      message: 'persistMotion must complete before authority registration',
    };
  }
  return { ok: true };
}

export function blockRuntimeRegistrationBeforeReady(
  jobState: string,
): AdapterResult {
  if (jobState !== 'READY') {
    return {
      ok: false,
      errorCode: ADAPTER_ERROR_CODES.RUNTIME_REGISTER_BEFORE_READY,
      message: 'Runtime registration blocked until job READY',
    };
  }
  return { ok: true };
}

export default ADAPTER_ERROR_CODES;
