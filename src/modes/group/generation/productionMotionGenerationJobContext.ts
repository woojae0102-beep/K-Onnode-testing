// @ts-nocheck
/**
 * Production Motion Generation Job Context (PHASE 18).
 */
import type {
  ProductionMotionGenerationPipelineStage,
  ProductionMotionGenerationPipelineState,
} from './productionMotionGenerationPipelineContract';
import {
  PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES,
  progressPercentForStage,
  stateForPipelineStage,
} from './productionMotionGenerationPipelineContract';

export type ProductionMotionGenerationAuthorityStatus =
  | 'pending'
  | 'blocked'
  | 'registered'
  | 'skipped';

export type ProductionMotionGenerationJobContext = {
  jobId: string;
  videoId: string;
  groupId: string;
  songId: string;
  memberId: string;
  inputVideoUrl: string | null;
  outputMotionGlbUrl: string | null;
  retryCount: number;
  elapsedTimeMs: number;
  startedAt: string | null;
  completedAt: string | null;
  currentStage: ProductionMotionGenerationPipelineStage | null;
  currentState: ProductionMotionGenerationPipelineState;
  errorCode: string | null;
  progressPercent: number;
  authorityStatus: ProductionMotionGenerationAuthorityStatus;
  /** Stages successfully completed (in order). */
  completedStages: ProductionMotionGenerationPipelineStage[];
  /** Set when PRODUCTION_MOTION_ASSET_V2 stage completes. */
  productionMotionAssetId: string | null;
  cancelled: boolean;
};

export type CreateProductionMotionGenerationJobInput = {
  jobId: string;
  videoId: string;
  groupId: string;
  songId: string;
  memberId: string;
  inputVideoUrl?: string | null;
};

const nowIso = () => new Date().toISOString();

export function createProductionMotionGenerationJobContext(
  input: CreateProductionMotionGenerationJobInput,
): ProductionMotionGenerationJobContext {
  return {
    jobId: input.jobId,
    videoId: input.videoId,
    groupId: input.groupId,
    songId: input.songId,
    memberId: input.memberId,
    inputVideoUrl: input.inputVideoUrl ?? null,
    outputMotionGlbUrl: null,
    retryCount: 0,
    elapsedTimeMs: 0,
    startedAt: null,
    completedAt: null,
    currentStage: null,
    currentState: 'NEW',
    errorCode: null,
    progressPercent: 0,
    authorityStatus: 'pending',
    completedStages: [],
    productionMotionAssetId: null,
    cancelled: false,
  };
}

export function markJobStarted(ctx: ProductionMotionGenerationJobContext): ProductionMotionGenerationJobContext {
  if (ctx.startedAt) return ctx;
  return { ...ctx, startedAt: nowIso() };
}

export function applyStageSuccess(
  ctx: ProductionMotionGenerationJobContext,
  stage: ProductionMotionGenerationPipelineStage,
  patch: Partial<ProductionMotionGenerationJobContext> = {},
): ProductionMotionGenerationJobContext {
  const state = stateForPipelineStage(stage);
  const completedStages = ctx.completedStages.includes(stage)
    ? ctx.completedStages
    : [...ctx.completedStages, stage];

  let authorityStatus = ctx.authorityStatus;
  if (stage === 'AUTHORITY_REGISTRATION') {
    authorityStatus = 'registered';
  }

  const next: ProductionMotionGenerationJobContext = {
    ...ctx,
    ...patch,
    currentStage: stage,
    currentState: state,
    completedStages,
    progressPercent: progressPercentForStage(stage),
    authorityStatus,
    errorCode: null,
  };

  if (stage === 'READY') {
    next.completedAt = nowIso();
    next.currentState = 'READY';
    next.progressPercent = 100;
  }

  return next;
}

export function applyStageFailure(
  ctx: ProductionMotionGenerationJobContext,
  stage: ProductionMotionGenerationPipelineStage,
  errorCode: string,
): ProductionMotionGenerationJobContext {
  return {
    ...ctx,
    currentStage: stage,
    currentState: 'FAILED',
    errorCode,
    completedAt: nowIso(),
  };
}

export function applyJobCancelled(ctx: ProductionMotionGenerationJobContext): ProductionMotionGenerationJobContext {
  return {
    ...ctx,
    cancelled: true,
    currentState: 'CANCELLED',
    completedAt: nowIso(),
  };
}

export function incrementJobRetry(ctx: ProductionMotionGenerationJobContext): ProductionMotionGenerationJobContext {
  return {
    ...ctx,
    retryCount: ctx.retryCount + 1,
    errorCode: null,
    currentState: 'NEW',
    currentStage: null,
    completedAt: null,
    cancelled: false,
  };
}

export function allStagesCompleted(ctx: ProductionMotionGenerationJobContext): boolean {
  return PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.every((s) => ctx.completedStages.includes(s));
}

export default createProductionMotionGenerationJobContext;
