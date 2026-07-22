// @ts-nocheck
/**
 * Production Motion Generation Execution Validation (PHASE 19).
 */
import type { ProductionMotionGenerationJobContext } from './productionMotionGenerationJobContext';
import { GENERATION_PIPELINE_ERROR_CODES } from './productionMotionGenerationPipelineValidation';
import { EXECUTION_ERROR_CODES } from './productionMotionGenerationRetryEngine';
import type { ProductionMotionGenerationCheckpointStore } from './productionMotionGenerationCheckpointStore';
import type { ProductionMotionGenerationExecutionLock } from './productionMotionGenerationExecutionLock';

export type ExecutionValidationResult =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export function validateExecuteJob(
  job: ProductionMotionGenerationJobContext | undefined,
  lock: ProductionMotionGenerationExecutionLock,
  jobId: string,
): ExecutionValidationResult {
  if (!job) {
    return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
  }
  if (job.currentState === 'READY') {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.READY_EXECUTE_FORBIDDEN,
      message: 'READY job cannot be executed',
    };
  }
  if (job.cancelled || job.currentState === 'CANCELLED') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_CANCELLED,
      message: 'Job is cancelled',
    };
  }
  if (lock.isLocked(jobId)) {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.JOB_ALREADY_RUNNING,
      message: 'Job is already executing',
    };
  }
  if (job.currentState === 'FAILED') {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.FAILED_RESUME_REQUIRES_RETRY,
      message: 'FAILED job requires retry before execute',
    };
  }
  return { ok: true };
}

export function validateDuplicateExecute(
  lock: ProductionMotionGenerationExecutionLock,
  jobId: string,
  ownerId: string,
): ExecutionValidationResult {
  const existing = lock.getLock(jobId);
  if (existing && existing.ownerId !== ownerId) {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE,
      message: `Job ${jobId} already executing under ${existing.ownerId}`,
    };
  }
  return { ok: true };
}

export function validateResumeJob(
  job: ProductionMotionGenerationJobContext | undefined,
  checkpoints: ProductionMotionGenerationCheckpointStore,
  jobId: string,
  lock: ProductionMotionGenerationExecutionLock,
): ExecutionValidationResult {
  if (!job) {
    return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
  }
  if (!checkpoints.hasCheckpoint(jobId)) {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.RESUME_WITHOUT_CHECKPOINT,
      message: 'No checkpoint available for resume',
    };
  }
  if (job.currentState === 'READY') {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.READY_RESUME_FORBIDDEN,
      message: 'READY job cannot be resumed',
    };
  }
  if (job.cancelled || job.currentState === 'CANCELLED') {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.CANCELLED_RESUME_FORBIDDEN,
      message: 'Cancelled job cannot be resumed',
    };
  }
  if (job.currentState === 'FAILED') {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.FAILED_RESUME_REQUIRES_RETRY,
      message: 'FAILED job must use retryJob, not resumeJob',
    };
  }
  if (lock.isLocked(jobId)) {
    return {
      ok: false,
      errorCode: EXECUTION_ERROR_CODES.JOB_ALREADY_RUNNING,
      message: 'Job is already executing',
    };
  }
  return { ok: true };
}

export default validateExecuteJob;
