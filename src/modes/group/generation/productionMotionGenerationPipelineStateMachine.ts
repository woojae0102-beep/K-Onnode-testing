// @ts-nocheck
/**
 * Production Motion Generation Pipeline State Machine (PHASE 18).
 * Stub stage handlers — no Runtime / GX10 / external processor connection.
 */
import type { ProductionMotionGenerationPipelineStage } from './productionMotionGenerationPipelineContract';
import {
  PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES,
  nextPipelineStage,
} from './productionMotionGenerationPipelineContract';
import {
  applyJobCancelled,
  applyStageFailure,
  applyStageSuccess,
  createProductionMotionGenerationJobContext,
  incrementJobRetry,
  markJobStarted,
  type CreateProductionMotionGenerationJobInput,
  type ProductionMotionGenerationJobContext,
} from './productionMotionGenerationJobContext';
import {
  GENERATION_PIPELINE_ERROR_CODES,
  validateAdvanceToStage,
  validateDuplicateJob,
  type GenerationPipelineValidationResult,
} from './productionMotionGenerationPipelineValidation';

export type StageHandlerResult =
  | { ok: true; patch?: Partial<ProductionMotionGenerationJobContext> }
  | { ok: false; errorCode: string; message?: string; recoverable?: boolean };

export type StageHandler = (
  ctx: ProductionMotionGenerationJobContext,
) => StageHandlerResult | Promise<StageHandlerResult>;

export type ProductionMotionGenerationPipelineHandlers = Partial<
  Record<ProductionMotionGenerationPipelineStage, StageHandler>
>;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Default stub handlers — simulate success without real GLB generation. */
export function createStubPipelineHandlers(): ProductionMotionGenerationPipelineHandlers {
  return {
    UPLOAD_VIDEO: (ctx) => ({
      ok: true,
      patch: { inputVideoUrl: ctx.inputVideoUrl || `stub://video/${ctx.videoId}` },
    }),
    SKELETON_EXTRACTION: () => ({ ok: true }),
    SKELETON_NORMALIZE: () => ({ ok: true }),
    MOTION_CLEANUP: () => ({ ok: true }),
    FOOT_LOCK_CORRECTION: () => ({ ok: true }),
    ROOT_MOTION_NORMALIZE: () => ({ ok: true }),
    ANIMATION_OPTIMIZATION: () => ({ ok: true }),
    ANIMATION_COMPRESSION: () => ({ ok: true }),
    MOTION_GLB_EXPORT: (ctx) => ({
      ok: true,
      patch: {
        outputMotionGlbUrl: `stub://motion/${ctx.groupId}/${ctx.songId}/${ctx.memberId}.glb`,
      },
    }),
    STORAGE_UPLOAD: (ctx) => ({
      ok: true,
      patch: {
        outputMotionGlbUrl: `https://storage.stub/production-motion/${ctx.groupId}/${ctx.songId}/${ctx.jobId}/${ctx.memberId}.glb`,
      },
    }),
    FIRESTORE_METADATA: () => ({ ok: true }),
    PRODUCTION_MOTION_ASSET_V2: (ctx) => ({
      ok: true,
      patch: { productionMotionAssetId: `prod-${ctx.groupId}-${ctx.songId}-${ctx.jobId}` },
    }),
    AUTHORITY_REGISTRATION: () => ({ ok: true, patch: { authorityStatus: 'registered' } }),
    READY: () => ({ ok: true }),
  };
}

export class ProductionMotionGenerationPipeline {
  private jobs = new Map<string, ProductionMotionGenerationJobContext>();
  private handlers: ProductionMotionGenerationPipelineHandlers;

  constructor(handlers: ProductionMotionGenerationPipelineHandlers = createStubPipelineHandlers()) {
    this.handlers = { ...createStubPipelineHandlers(), ...handlers };
  }

  getJob(jobId: string): ProductionMotionGenerationJobContext | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): ProductionMotionGenerationJobContext[] {
    return [...this.jobs.values()];
  }

  /** Restore job context from checkpoint (PHASE 19 execution engine). */
  restoreJobContext(job: ProductionMotionGenerationJobContext): void {
    this.jobs.set(job.jobId, {
      ...job,
      completedStages: [...job.completedStages],
    });
  }

  createJob(input: CreateProductionMotionGenerationJobInput): GenerationPipelineValidationResult & {
    job?: ProductionMotionGenerationJobContext;
  } {
    const dup = validateDuplicateJob(this.listJobs(), input.jobId);
    if (!dup.ok) return dup;

    const job = createProductionMotionGenerationJobContext(input);
    this.jobs.set(input.jobId, job);
    return { ok: true, job };
  }

  cancelJob(jobId: string): GenerationPipelineValidationResult & {
    job?: ProductionMotionGenerationJobContext;
  } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
    }
    if (job.currentState === 'READY' || job.currentState === 'CANCELLED') {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
        message: 'Cannot cancel terminal job',
      };
    }
    const updated = applyJobCancelled(job);
    this.jobs.set(jobId, updated);
    return { ok: true, job: updated };
  }

  retryJob(jobId: string): GenerationPipelineValidationResult & {
    job?: ProductionMotionGenerationJobContext;
  } {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
    }
    if (job.currentState !== 'FAILED') {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
        message: 'Retry only allowed from FAILED',
      };
    }
    const updated = incrementJobRetry({
      ...job,
      completedStages: [],
      currentState: 'NEW',
      currentStage: null,
      outputMotionGlbUrl: null,
      productionMotionAssetId: null,
      authorityStatus: 'pending',
      progressPercent: 0,
    });
    this.jobs.set(jobId, updated);
    return { ok: true, job: updated };
  }

  async runStage(
    jobId: string,
    stage: ProductionMotionGenerationPipelineStage,
  ): Promise<GenerationPipelineValidationResult & { job?: ProductionMotionGenerationJobContext }> {
    let job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
    }

    const validation = validateAdvanceToStage(job, stage);
    if (!validation.ok) return validation;

    job = markJobStarted(job);
    const t0 = now();
    const handler = this.handlers[stage] || (() => ({ ok: true }));

    let result: StageHandlerResult;
    try {
      result = await handler(job);
    } catch (err) {
      result = {
        ok: false,
        errorCode: 'GENERATION_STAGE_HANDLER_THROW',
        message: (err as Error)?.message || String(err),
      };
    }

    const elapsed = now() - t0;
    job = { ...job, elapsedTimeMs: job.elapsedTimeMs + elapsed };

    if (!result.ok) {
      const failed = applyStageFailure(job, stage, result.errorCode);
      this.jobs.set(jobId, failed);
      return {
        ok: false,
        errorCode: result.errorCode,
        message: result.message,
        job: failed,
        recoverable: result.recoverable,
      };
    }

    const success = applyStageSuccess(job, stage, result.patch || {});
    this.jobs.set(jobId, success);
    return { ok: true, job: success };
  }

  async runToCompletion(
    jobId: string,
  ): Promise<GenerationPipelineValidationResult & { job?: ProductionMotionGenerationJobContext }> {
    for (const stage of PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES) {
      const result = await this.runStage(jobId, stage);
      if (!result.ok) return result;
    }
    const job = this.jobs.get(jobId);
    return { ok: true, job };
  }

  async runNextStage(
    jobId: string,
  ): Promise<GenerationPipelineValidationResult & { job?: ProductionMotionGenerationJobContext }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
    }
    const next = job.currentStage
      ? nextPipelineStage(job.currentStage)
      : PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[0];
    if (!next) {
      return {
        ok: false,
        errorCode: GENERATION_PIPELINE_ERROR_CODES.JOB_ALREADY_TERMINAL,
        message: 'No next stage',
      };
    }
    return this.runStage(jobId, next);
  }
}

export default ProductionMotionGenerationPipeline;
