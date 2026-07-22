// @ts-nocheck
/**
 * Production Motion Asset Generation Pipeline Contract (PHASE 18).
 * Ordered stages — no skip allowed. Runtime consumption path is separate.
 */

/** Granular pipeline stages (canonical order — every job must pass all). */
export const PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES = [
  'UPLOAD_VIDEO',
  'SKELETON_EXTRACTION',
  'SKELETON_NORMALIZE',
  'MOTION_CLEANUP',
  'FOOT_LOCK_CORRECTION',
  'ROOT_MOTION_NORMALIZE',
  'ANIMATION_OPTIMIZATION',
  'ANIMATION_COMPRESSION',
  'MOTION_GLB_EXPORT',
  'STORAGE_UPLOAD',
  'FIRESTORE_METADATA',
  'PRODUCTION_MOTION_ASSET_V2',
  'AUTHORITY_REGISTRATION',
  'READY',
] as const;

export type ProductionMotionGenerationPipelineStage =
  typeof PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[number];

/** High-level pipeline state machine (derived from current stage). */
export const PRODUCTION_MOTION_GENERATION_PIPELINE_STATES = [
  'NEW',
  'UPLOADING',
  'EXTRACTING',
  'NORMALIZING',
  'CLEANING',
  'OPTIMIZING',
  'EXPORTING',
  'UPLOADING_STORAGE',
  'REGISTERING',
  'READY',
  'FAILED',
  'CANCELLED',
] as const;

export type ProductionMotionGenerationPipelineState =
  typeof PRODUCTION_MOTION_GENERATION_PIPELINE_STATES[number];

/** Terminal states — no forward progress without explicit retry/new job. */
export const TERMINAL_PIPELINE_STATES: readonly ProductionMotionGenerationPipelineState[] = [
  'READY',
  'FAILED',
  'CANCELLED',
];

export const ACTIVE_PIPELINE_STATES: readonly ProductionMotionGenerationPipelineState[] =
  PRODUCTION_MOTION_GENERATION_PIPELINE_STATES.filter(
    (s) => !TERMINAL_PIPELINE_STATES.includes(s) && s !== 'NEW',
  );

/** Stage → coarse state mapping (multiple stages may share one state). */
export const PIPELINE_STAGE_TO_STATE: Record<
  ProductionMotionGenerationPipelineStage,
  ProductionMotionGenerationPipelineState
> = {
  UPLOAD_VIDEO: 'UPLOADING',
  SKELETON_EXTRACTION: 'EXTRACTING',
  SKELETON_NORMALIZE: 'NORMALIZING',
  MOTION_CLEANUP: 'CLEANING',
  FOOT_LOCK_CORRECTION: 'CLEANING',
  ROOT_MOTION_NORMALIZE: 'OPTIMIZING',
  ANIMATION_OPTIMIZATION: 'OPTIMIZING',
  ANIMATION_COMPRESSION: 'OPTIMIZING',
  MOTION_GLB_EXPORT: 'EXPORTING',
  STORAGE_UPLOAD: 'UPLOADING_STORAGE',
  FIRESTORE_METADATA: 'REGISTERING',
  PRODUCTION_MOTION_ASSET_V2: 'REGISTERING',
  AUTHORITY_REGISTRATION: 'REGISTERING',
  READY: 'READY',
};

/** Ordered coarse states for transition validation (excluding terminal failure/cancel). */
export const ORDERED_PIPELINE_STATES: readonly ProductionMotionGenerationPipelineState[] = [
  'NEW',
  'UPLOADING',
  'EXTRACTING',
  'NORMALIZING',
  'CLEANING',
  'OPTIMIZING',
  'EXPORTING',
  'UPLOADING_STORAGE',
  'REGISTERING',
  'READY',
];

export function pipelineStageIndex(
  stage: ProductionMotionGenerationPipelineStage,
): number {
  return PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.indexOf(stage);
}

export function pipelineStateIndex(
  state: ProductionMotionGenerationPipelineState,
): number {
  return ORDERED_PIPELINE_STATES.indexOf(state);
}

export function stateForPipelineStage(
  stage: ProductionMotionGenerationPipelineStage,
): ProductionMotionGenerationPipelineState {
  return PIPELINE_STAGE_TO_STATE[stage];
}

export function nextPipelineStage(
  current: ProductionMotionGenerationPipelineStage,
): ProductionMotionGenerationPipelineStage | null {
  const idx = pipelineStageIndex(current);
  if (idx < 0 || idx >= PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.length - 1) return null;
  return PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[idx + 1];
}

export function previousPipelineStage(
  current: ProductionMotionGenerationPipelineStage,
): ProductionMotionGenerationPipelineStage | null {
  const idx = pipelineStageIndex(current);
  if (idx <= 0) return null;
  return PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[idx - 1];
}

export function progressPercentForStage(
  stage: ProductionMotionGenerationPipelineStage,
): number {
  const idx = pipelineStageIndex(stage);
  if (idx < 0) return 0;
  const total = PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES.length - 1;
  if (total <= 0) return 100;
  return Math.round((idx / total) * 100);
}

export function isPipelineStageBefore(
  a: ProductionMotionGenerationPipelineStage,
  b: ProductionMotionGenerationPipelineStage,
): boolean {
  return pipelineStageIndex(a) < pipelineStageIndex(b);
}

export default PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES;
