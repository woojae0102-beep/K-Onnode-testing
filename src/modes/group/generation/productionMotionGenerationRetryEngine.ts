// @ts-nocheck
/**
 * Production Motion Generation Retry Engine (PHASE 19).
 * Exponential backoff, retry limit, fatal vs recoverable classification.
 */
export const EXECUTION_ERROR_CODES = {
  DUPLICATE_EXECUTE: 'EXECUTION_DUPLICATE_EXECUTE',
  JOB_ALREADY_RUNNING: 'EXECUTION_JOB_ALREADY_RUNNING',
  READY_EXECUTE_FORBIDDEN: 'EXECUTION_READY_EXECUTE_FORBIDDEN',
  RESUME_WITHOUT_CHECKPOINT: 'EXECUTION_RESUME_WITHOUT_CHECKPOINT',
  CANCELLED_RESUME_FORBIDDEN: 'EXECUTION_CANCELLED_RESUME_FORBIDDEN',
  READY_RESUME_FORBIDDEN: 'EXECUTION_READY_RESUME_FORBIDDEN',
  FAILED_RESUME_REQUIRES_RETRY: 'EXECUTION_FAILED_RESUME_REQUIRES_RETRY',
  RETRY_LIMIT_EXCEEDED: 'EXECUTION_RETRY_LIMIT_EXCEEDED',
  STAGE_TIMEOUT: 'EXECUTION_STAGE_TIMEOUT',
  FATAL_STAGE_ERROR: 'EXECUTION_FATAL_STAGE_ERROR',
} as const;

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 8000,
  multiplier: 2,
};

/** Errors that must not be retried automatically. */
export const FATAL_ERROR_CODES = new Set<string>([
  EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE,
  EXECUTION_ERROR_CODES.READY_EXECUTE_FORBIDDEN,
  EXECUTION_ERROR_CODES.CANCELLED_RESUME_FORBIDDEN,
  EXECUTION_ERROR_CODES.READY_RESUME_FORBIDDEN,
  EXECUTION_ERROR_CODES.FAILED_RESUME_REQUIRES_RETRY,
  EXECUTION_ERROR_CODES.RETRY_LIMIT_EXCEEDED,
  EXECUTION_ERROR_CODES.FATAL_STAGE_ERROR,
  'GENERATION_STAGE_SKIP_FORBIDDEN',
  'GENERATION_READY_FROM_FAILED_FORBIDDEN',
  'GENERATION_DUPLICATE_ACTIVE_JOB',
  'GENERATION_JOB_CANCELLED',
  'ADAPTER_AUTHORITY_FAILED',
  'PRODUCTION_AUTHORITY_SIGNING_KEY_MISSING',
  'GX10_AUTH_FAILED',
]);

export function isRecoverableError(errorCode: string, explicit?: boolean): boolean {
  if (explicit === false) return false;
  if (explicit === true) return true;
  if (FATAL_ERROR_CODES.has(errorCode)) return false;
  if (errorCode.startsWith('EXECUTION_FATAL_')) return false;
  return true;
}

export function computeRetryDelayMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  const exp = policy.baseDelayMs * Math.pow(policy.multiplier, Math.max(0, attempt - 1));
  return Math.min(exp, policy.maxDelayMs);
}

export function canScheduleRetry(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): boolean {
  return retryCount < policy.maxAttempts;
}

export type RetrySchedule = {
  attempt: number;
  delayMs: number;
  reason: string;
  errorCode: string;
};

export function scheduleRetry(
  errorCode: string,
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): RetrySchedule | null {
  if (!isRecoverableError(errorCode)) return null;
  const nextAttempt = retryCount + 1;
  if (!canScheduleRetry(nextAttempt, policy)) return null;
  return {
    attempt: nextAttempt,
    delayMs: computeRetryDelayMs(nextAttempt, policy),
    reason: `Recoverable error: ${errorCode}`,
    errorCode,
  };
}

export async function waitRetryDelay(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export default scheduleRetry;
