// @ts-nocheck
/**
 * Production Motion Generation Pipeline validation (PHASE 18 — fail-closed).
 */
import type {
  ProductionMotionGenerationPipelineStage,
  ProductionMotionGenerationPipelineState,
} from './productionMotionGenerationPipelineContract';
import {
  ORDERED_PIPELINE_STATES,
  PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES,
  pipelineStageIndex,
  pipelineStateIndex,
  stateForPipelineStage,
} from './productionMotionGenerationPipelineContract';
import type { ProductionMotionGenerationJobContext } from './productionMotionGenerationJobContext';

export const GENERATION_PIPELINE_ERROR_CODES = {
  INVALID_STATE_TRANSITION: 'GENERATION_INVALID_STATE_TRANSITION',
  STAGE_SKIP_FORBIDDEN: 'GENERATION_STAGE_SKIP_FORBIDDEN',
  READY_WITHOUT_ALL_STAGES: 'GENERATION_READY_WITHOUT_ALL_STAGES',
  READY_FROM_FAILED_FORBIDDEN: 'GENERATION_READY_FROM_FAILED_FORBIDDEN',
  AUTHORITY_WITHOUT_STORAGE: 'GENERATION_AUTHORITY_WITHOUT_STORAGE',
  RUNTIME_REGISTER_WITHOUT_METADATA: 'GENERATION_RUNTIME_REGISTER_WITHOUT_METADATA',
  DUPLICATE_ACTIVE_JOB: 'GENERATION_DUPLICATE_ACTIVE_JOB',
  JOB_CANCELLED: 'GENERATION_JOB_CANCELLED',
  JOB_ALREADY_TERMINAL: 'GENERATION_JOB_ALREADY_TERMINAL',
  STAGE_PREREQUISITE_MISSING: 'GENERATION_STAGE_PREREQUISITE_MISSING',
} as const;

export type GenerationPipelineValidationResult =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export function canTransitionPipelineState(
  from: ProductionMotionGenerationPipelineState,
  to: ProductionMotionGenerationPipelineState,
): GenerationPipelineValidationResult {
  if (from === to) return { ok: true };

  if (from === 'FAILED' && to === 'READY') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.READY_FROM_FAILED_FORBIDDEN,
      message: 'FAILED state cannot transition directly to READY',
    };
  }

  if (from === 'CANCELLED') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
      message: 'Cancelled job cannot transition',
    };
  }

  if (to === 'FAILED' || to === 'CANCELLED') {
    return { ok: true };
  }

  if (from === 'READY') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
      message: 'READY job cannot transition to non-terminal state',
    };
  }

  if (from === 'FAILED') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
      message: 'FAILED job requires retry before forward transition',
    };
  }

  const fromIdx = pipelineStateIndex(from);
  const toIdx = pipelineStateIndex(to);
  if (fromIdx < 0 || toIdx < 0) {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.INVALID_STATE_TRANSITION,
      message: `Unknown state transition ${from} → ${to}`,
    };
  }

  if (toIdx !== fromIdx + 1 && to !== 'READY') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.INVALID_STATE_TRANSITION,
      message: `State skip forbidden: ${from} → ${to}`,
    };
  }

  return { ok: true };
}

export function validateAdvanceToStage(
  ctx: ProductionMotionGenerationJobContext,
  targetStage: ProductionMotionGenerationPipelineStage,
): GenerationPipelineValidationResult {
  if (ctx.cancelled || ctx.currentState === 'CANCELLED') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_CANCELLED,
      message: 'Job is cancelled',
    };
  }

  if (ctx.currentState === 'READY') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
      message: 'Job already READY',
    };
  }

  if (ctx.currentState === 'FAILED') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
      message: 'Job is FAILED — retry required',
    };
  }

  const targetIdx = pipelineStageIndex(targetStage);
  if (targetIdx < 0) {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.STAGE_SKIP_FORBIDDEN,
      message: `Unknown stage ${targetStage}`,
    };
  }

  const expectedNext = ctx.currentStage
    ? PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[pipelineStageIndex(ctx.currentStage) + 1]
    : PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[0];

  if (expectedNext !== targetStage) {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.STAGE_SKIP_FORBIDDEN,
      message: `Stage skip forbidden: expected ${expectedNext ?? 'none'}, got ${targetStage}`,
    };
  }

  const targetState = stateForPipelineStage(targetStage);
  const fromState = ctx.currentStage
    ? stateForPipelineStage(ctx.currentStage)
    : 'NEW';

  if (fromState !== targetState) {
    const transition = canTransitionPipelineState(
      fromState === ctx.currentState ? fromState : ctx.currentState,
      targetState,
    );
    if (!transition.ok) return transition;

    if (ctx.currentState === 'NEW' && targetState !== 'UPLOADING') {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.INVALID_STATE_TRANSITION,
        message: 'First stage must be UPLOAD_VIDEO',
      };
    }
  }

  return validateStagePrerequisites(ctx, targetStage);
}

export function validateStagePrerequisites(
  ctx: ProductionMotionGenerationJobContext,
  targetStage: ProductionMotionGenerationPipelineStage,
): GenerationPipelineValidationResult {
  if (targetStage === 'AUTHORITY_REGISTRATION') {
    if (!ctx.completedStages.includes('STORAGE_UPLOAD')) {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.AUTHORITY_WITHOUT_STORAGE,
        message: 'Authority registration blocked — STORAGE_UPLOAD not completed',
      };
    }
  }

  if (targetStage === 'PRODUCTION_MOTION_ASSET_V2') {
    if (!ctx.completedStages.includes('FIRESTORE_METADATA')) {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.STAGE_PREREQUISITE_MISSING,
        message: 'ProductionMotionAssetV2 blocked — FIRESTORE_METADATA not completed',
      };
    }
  }

  if (targetStage === 'READY') {
    const missing = PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.filter(
      (s) => s !== 'READY' && !ctx.completedStages.includes(s),
    );
    if (missing.length > 0) {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.READY_WITHOUT_ALL_STAGES,
        message: `READY forbidden — missing stages: ${missing.join(', ')}`,
      };
    }
    if (!ctx.completedStages.includes('AUTHORITY_REGISTRATION')) {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.READY_WITHOUT_ALL_STAGES,
        message: 'READY forbidden — AUTHORITY_REGISTRATION not completed',
      };
    }
  }

  return { ok: true };
}

export function validateReadyJob(ctx: ProductionMotionGenerationJobContext): GenerationPipelineValidationResult {
  if (ctx.currentState === 'FAILED') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.READY_FROM_FAILED_FORBIDDEN,
      message: 'Cannot mark READY from FAILED',
    };
  }
  return validateStagePrerequisites(ctx, 'READY');
}

/** Runtime registration gate — metadata + asset v2 required (consumer path unchanged). */
export function validateRuntimeRegistrationAllowed(
  ctx: ProductionMotionGenerationJobContext,
): GenerationPipelineValidationResult {
  if (!ctx.completedStages.includes('FIRESTORE_METADATA')) {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.RUNTIME_REGISTER_WITHOUT_METADATA,
      message: 'Runtime registration blocked — Firestore metadata missing',
    };
  }
  if (!ctx.completedStages.includes('PRODUCTION_MOTION_ASSET_V2')) {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.RUNTIME_REGISTER_WITHOUT_METADATA,
      message: 'Runtime registration blocked — ProductionMotionAssetV2 missing',
    };
  }
  if (ctx.currentState !== 'READY') {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.READY_WITHOUT_ALL_STAGES,
      message: 'Runtime registration blocked — job not READY',
    };
  }
  return { ok: true };
}

export function validateDuplicateJob(
  existingJobs: ProductionMotionGenerationJobContext[],
  jobId: string,
): GenerationPipelineValidationResult {
  const duplicate = existingJobs.find(
    (j) => j.jobId === jobId && j.currentState !== 'FAILED' && j.currentState !== 'CANCELLED',
  );
  if (duplicate) {
    return {
      ok: false,
      errorCode: GENERATION_PIPELINE_ERROR_CODES.DUPLICATE_ACTIVE_JOB,
      message: `Active job already exists: ${jobId}`,
    };
  }
  return { ok: true };
}

export default validateAdvanceToStage;
