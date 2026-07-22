// @ts-nocheck
/**
 * Production Motion Generation Pipeline — public exports (PHASE 18).
 */
export {
  PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES,
  PRODUCTION_MOTION_GENERATION_PIPELINE_STATES,
  PIPELINE_STAGE_TO_STATE,
  ORDERED_PIPELINE_STATES,
  TERMINAL_PIPELINE_STATES,
  ACTIVE_PIPELINE_STATES,
  pipelineStageIndex,
  pipelineStateIndex,
  stateForPipelineStage,
  nextPipelineStage,
  previousPipelineStage,
  progressPercentForStage,
  isPipelineStageBefore,
} from './productionMotionGenerationPipelineContract';

export type {
  ProductionMotionGenerationPipelineStage,
  ProductionMotionGenerationPipelineState,
} from './productionMotionGenerationPipelineContract';

export {
  createProductionMotionGenerationJobContext,
  markJobStarted,
  applyStageSuccess,
  applyStageFailure,
  applyJobCancelled,
  incrementJobRetry,
  allStagesCompleted,
} from './productionMotionGenerationJobContext';

export type {
  ProductionMotionGenerationJobContext,
  ProductionMotionGenerationAuthorityStatus,
  CreateProductionMotionGenerationJobInput,
} from './productionMotionGenerationJobContext';

export {
  GENERATION_PIPELINE_ERROR_CODES,
  canTransitionPipelineState,
  validateAdvanceToStage,
  validateStagePrerequisites,
  validateReadyJob,
  validateRuntimeRegistrationAllowed,
  validateDuplicateJob,
} from './productionMotionGenerationPipelineValidation';

export type { GenerationPipelineValidationResult } from './productionMotionGenerationPipelineValidation';

export {
  ProductionMotionGenerationPipeline,
  createStubPipelineHandlers,
} from './productionMotionGenerationPipelineStateMachine';

export type {
  StageHandler,
  StageHandlerResult,
  ProductionMotionGenerationPipelineHandlers,
} from './productionMotionGenerationPipelineStateMachine';

export {
  EXECUTION_EVENT_TYPES,
  ExecutionEventBus,
} from './productionMotionGenerationExecutionEvents';

export type {
  ExecutionEventType,
  ProductionMotionExecutionEvent,
  ExecutionEventListener,
  PipelineStartedEvent,
  StageStartedEvent,
  StageCompletedEvent,
  StageFailedEvent,
  RetryScheduledEvent,
  CancelledEvent,
  CompletedEvent,
} from './productionMotionGenerationExecutionEvents';

export {
  ProductionMotionGenerationCheckpointStore,
  buildCheckpointFromJob,
} from './productionMotionGenerationCheckpointStore';

export type { ProductionMotionGenerationCheckpoint } from './productionMotionGenerationCheckpointStore';

export { ProductionMotionGenerationExecutionLock } from './productionMotionGenerationExecutionLock';

export type { ExecutionLockToken } from './productionMotionGenerationExecutionLock';

export {
  EXECUTION_ERROR_CODES,
  DEFAULT_RETRY_POLICY,
  FATAL_ERROR_CODES,
  isRecoverableError,
  computeRetryDelayMs,
  canScheduleRetry,
  scheduleRetry,
  waitRetryDelay,
} from './productionMotionGenerationRetryEngine';

export type { RetryPolicy, RetrySchedule } from './productionMotionGenerationRetryEngine';

export {
  validateExecuteJob,
  validateDuplicateExecute,
  validateResumeJob,
} from './productionMotionGenerationExecutionValidation';

export type { ExecutionValidationResult } from './productionMotionGenerationExecutionValidation';

export {
  ProductionPipelineExecutor,
} from './productionMotionGenerationPipelineExecutor';

export type {
  ProductionPipelineExecutorOptions,
  ExecutorResult,
} from './productionMotionGenerationPipelineExecutor';

export * from './adapters';
