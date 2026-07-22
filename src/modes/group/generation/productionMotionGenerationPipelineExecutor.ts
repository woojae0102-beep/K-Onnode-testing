// @ts-nocheck
/**
 * Production Motion Generation Pipeline Executor (PHASE 19).
 * Execution layer — wraps PHASE 18 state machine with lock, checkpoint, retry, events.
 * No GX10 / external processor / Runtime connection. Stage handlers remain stub.
 */
import type { ProductionMotionGenerationPipelineStage } from './productionMotionGenerationPipelineContract';
import {
  PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES,
  nextPipelineStage,
} from './productionMotionGenerationPipelineContract';
import type { CreateProductionMotionGenerationJobInput, ProductionMotionGenerationJobContext } from './productionMotionGenerationJobContext';
import {
  ProductionMotionGenerationPipeline,
  createStubPipelineHandlers,
  type ProductionMotionGenerationPipelineHandlers,
} from './productionMotionGenerationPipelineStateMachine';
import { ProductionMotionGenerationCheckpointStore } from './productionMotionGenerationCheckpointStore';
import { ProductionMotionGenerationExecutionLock } from './productionMotionGenerationExecutionLock';
import { ExecutionEventBus, type ExecutionEventListener } from './productionMotionGenerationExecutionEvents';
import {
  DEFAULT_RETRY_POLICY,
  EXECUTION_ERROR_CODES,
  isRecoverableError,
  scheduleRetry,
  waitRetryDelay,
  type RetryPolicy,
} from './productionMotionGenerationRetryEngine';
import {
  validateDuplicateExecute,
  validateExecuteJob,
  validateResumeJob,
  type ExecutionValidationResult,
} from './productionMotionGenerationExecutionValidation';
import type { GenerationPipelineValidationResult } from './productionMotionGenerationPipelineValidation';
import type { ProductionMotionGenerationAdapter } from './adapters/ProductionMotionGenerationAdapter';
import { createAdapterPipelineHandlers } from './adapters/createAdapterPipelineHandlers';

export type ProductionPipelineExecutorOptions = {
  /** When set, pipeline uses adapter handlers instead of stub (PHASE 20 DI). */
  adapter?: ProductionMotionGenerationAdapter;
  handlers?: ProductionMotionGenerationPipelineHandlers;
  retryPolicy?: RetryPolicy;
  stageTimeoutMs?: number;
  ownerId?: string;
  checkpointStore?: ProductionMotionGenerationCheckpointStore;
  executionLock?: ProductionMotionGenerationExecutionLock;
  eventBus?: ExecutionEventBus;
};

export type ExecutorResult = GenerationPipelineValidationResult & {
  job?: ProductionMotionGenerationJobContext;
  events?: string[];
  recoverable?: boolean;
};

const nowIso = () => new Date().toISOString();

export class ProductionPipelineExecutor {
  readonly pipeline: ProductionMotionGenerationPipeline;
  readonly adapter: ProductionMotionGenerationAdapter | null;
  readonly checkpoints: ProductionMotionGenerationCheckpointStore;
  readonly lock: ProductionMotionGenerationExecutionLock;
  readonly events: ExecutionEventBus;
  readonly retryPolicy: RetryPolicy;
  readonly stageTimeoutMs: number;
  readonly ownerId: string;

  constructor(options: ProductionPipelineExecutorOptions = {}) {
    const handlers = options.adapter
      ? createAdapterPipelineHandlers(options.adapter)
      : (options.handlers ?? createStubPipelineHandlers());

    this.adapter = options.adapter ?? null;
    this.pipeline = new ProductionMotionGenerationPipeline(handlers);
    this.checkpoints = options.checkpointStore ?? new ProductionMotionGenerationCheckpointStore();
    this.lock = options.executionLock ?? new ProductionMotionGenerationExecutionLock();
    this.events = options.eventBus ?? new ExecutionEventBus();
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.stageTimeoutMs = options.stageTimeoutMs ?? 120_000;
    this.ownerId = options.ownerId ?? `executor-${Math.random().toString(36).slice(2, 10)}`;
  }

  onEvent(listener: ExecutionEventListener): () => void {
    return this.events.subscribe(listener);
  }

  createJob(input: CreateProductionMotionGenerationJobInput) {
    return this.pipeline.createJob(input);
  }

  getJob(jobId: string) {
    return this.pipeline.getJob(jobId);
  }

  async executeJob(jobId: string): Promise<ExecutorResult> {
    const job = this.pipeline.getJob(jobId);
    const validation = validateExecuteJob(job, this.lock, jobId);
    if (!validation.ok) return validation;

    const dup = validateDuplicateExecute(this.lock, jobId, this.ownerId);
    if (!dup.ok) return dup;

    const token = this.lock.tryAcquire(jobId, this.ownerId);
    if (!token) {
      return {
        ok: false,
        errorCode: EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE,
        message: 'Concurrent execution blocked',
      };
    }

    try {
      this.events.emit({
        type: 'PipelineStarted',
        jobId,
        timestamp: nowIso(),
        job: job!,
      });
      return await this.runUntilReady(jobId);
    } finally {
      this.lock.release(jobId, this.ownerId);
    }
  }

  async executeStage(
    jobId: string,
    stage: ProductionMotionGenerationPipelineStage,
  ): Promise<ExecutorResult> {
    const job = this.pipeline.getJob(jobId);
    const validation = validateExecuteJob(job, this.lock, jobId);
    if (!validation.ok) return validation;

    const token = this.lock.tryAcquire(jobId, this.ownerId);
    if (!token) {
      return {
        ok: false,
        errorCode: EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE,
        message: 'Concurrent execution blocked',
      };
    }

    try {
      return await this.runSingleStage(jobId, stage);
    } finally {
      this.lock.release(jobId, this.ownerId);
    }
  }

  async resumeJob(jobId: string): Promise<ExecutorResult> {
    const job = this.pipeline.getJob(jobId);
    const validation = validateResumeJob(job, this.checkpoints, jobId, this.lock);
    if (!validation.ok) return validation;

    const latest = this.checkpoints.getLatest(jobId)!;
    this.pipeline.restoreJobContext(latest.jobSnapshot);

    const token = this.lock.tryAcquire(jobId, this.ownerId);
    if (!token) {
      return {
        ok: false,
        errorCode: EXECUTION_ERROR_CODES.DUPLICATE_EXECUTE,
        message: 'Concurrent execution blocked',
      };
    }

    try {
      this.events.emit({
        type: 'PipelineStarted',
        jobId,
        timestamp: nowIso(),
        job: latest.jobSnapshot,
      });
      return await this.runUntilReady(jobId);
    } finally {
      this.lock.release(jobId, this.ownerId);
    }
  }

  cancelJob(jobId: string): ExecutorResult {
    const result = this.pipeline.cancelJob(jobId);
    if (result.ok && result.job) {
      this.checkpoints.saveFromJob(result.job);
      this.events.emit({
        type: 'Cancelled',
        jobId,
        timestamp: nowIso(),
        job: result.job,
      });
    }
    return result;
  }

  async retryJob(jobId: string): Promise<ExecutorResult> {
    const job = this.pipeline.getJob(jobId);
    if (!job) {
      return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
    }
    if (job.currentState !== 'FAILED') {
      return {
        ok: false,
        errorCode: 'GENERATION_JOB_ALREADY_TERMINAL',
        message: 'Retry only from FAILED',
      };
    }
    if (job.retryCount >= this.retryPolicy.maxAttempts) {
      return {
        ok: false,
        errorCode: EXECUTION_ERROR_CODES.RETRY_LIMIT_EXCEEDED,
        message: 'Retry limit exceeded',
      };
    }

    const errorCode = job.errorCode || 'GENERATION_UNKNOWN';
    const retrySchedule = scheduleRetry(errorCode, job.retryCount, this.retryPolicy);
    if (!retrySchedule) {
      return {
        ok: false,
        errorCode: isRecoverableError(errorCode)
          ? EXECUTION_ERROR_CODES.RETRY_LIMIT_EXCEEDED
          : EXECUTION_ERROR_CODES.FATAL_STAGE_ERROR,
        message: `Cannot retry error: ${errorCode}`,
      };
    }

    this.events.emit({
      type: 'RetryScheduled',
      jobId,
      timestamp: nowIso(),
      attempt: retrySchedule.attempt,
      delayMs: retrySchedule.delayMs,
      reason: retrySchedule.reason,
      errorCode: retrySchedule.errorCode,
    });

    await waitRetryDelay(retrySchedule.delayMs);

    const retried = this.pipeline.retryJob(jobId);
    if (!retried.ok) return retried;

    return this.executeJob(jobId);
  }

  async runUntilReady(jobId: string): Promise<ExecutorResult> {
    const job = this.pipeline.getJob(jobId);
    if (!job) {
      return { ok: false, errorCode: 'GENERATION_JOB_NOT_FOUND', message: jobId };
    }

    if (job.currentState === 'READY') {
      return {
        ok: false,
        errorCode: EXECUTION_ERROR_CODES.READY_EXECUTE_FORBIDDEN,
        message: 'Job already READY',
      };
    }

    while (true) {
      const current = this.pipeline.getJob(jobId)!;
      if (current.currentState === 'READY') {
        this.events.emit({
          type: 'Completed',
          jobId,
          timestamp: nowIso(),
          job: current,
        });
        return { ok: true, job: current };
      }
      if (current.cancelled || current.currentState === 'CANCELLED') {
        return {
          ok: false,
          errorCode: 'GENERATION_JOB_CANCELLED',
          message: 'Job cancelled during execution',
          job: current,
        };
      }

      const nextStage = current.currentStage
        ? nextPipelineStage(current.currentStage)
        : PRODUCTION_MOTION_GENERATION_PIPELINE_STAGES[0];

      if (!nextStage) {
        return { ok: true, job: current };
      }

      const stageResult = await this.runSingleStage(jobId, nextStage);
      if (!stageResult.ok) return stageResult;
      if (nextStage === 'READY') {
        this.events.emit({
          type: 'Completed',
          jobId,
          timestamp: nowIso(),
          job: stageResult.job!,
        });
        return stageResult;
      }
    }
  }

  private async runSingleStage(
    jobId: string,
    stage: ProductionMotionGenerationPipelineStage,
  ): Promise<ExecutorResult> {
    this.events.emit({
      type: 'StageStarted',
      jobId,
      timestamp: nowIso(),
      stage,
    });

    const result = await this.runStageWithTimeout(jobId, stage);

    if (!result.ok) {
      const recoverable = isRecoverableError(result.errorCode, (result as ExecutorResult).recoverable);
      this.events.emit({
        type: 'StageFailed',
        jobId,
        timestamp: nowIso(),
        stage,
        errorCode: result.errorCode,
        message: result.message,
        recoverable,
      });
      if (result.job) {
        this.checkpoints.saveFromJob(result.job);
      }
      return result;
    }

    if (result.job) {
      this.checkpoints.saveFromJob(result.job);
      this.events.emit({
        type: 'StageCompleted',
        jobId,
        timestamp: nowIso(),
        stage,
        job: result.job,
      });
    }

    return result;
  }

  private async runStageWithTimeout(
    jobId: string,
    stage: ProductionMotionGenerationPipelineStage,
  ): Promise<ExecutorResult> {
    if (this.stageTimeoutMs <= 0) {
      return this.pipeline.runStage(jobId, stage);
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<ExecutorResult>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve({
          ok: false,
          errorCode: EXECUTION_ERROR_CODES.STAGE_TIMEOUT,
          message: `Stage ${stage} exceeded ${this.stageTimeoutMs}ms`,
        });
      }, this.stageTimeoutMs);
    });

    const stagePromise = this.pipeline.runStage(jobId, stage);
    const outcome = await Promise.race([stagePromise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return outcome;
  }

  /** Simulate crash recovery by restoring from latest checkpoint into a fresh executor. */
  static recoverFromCheckpoint(options: {
    checkpointStore: ProductionMotionGenerationCheckpointStore;
    jobId: string;
    executorOptions?: ProductionPipelineExecutorOptions;
  }): ProductionPipelineExecutor | null {
    const latest = options.checkpointStore.getLatest(options.jobId);
    if (!latest) return null;

    const executor = new ProductionPipelineExecutor({
      ...options.executorOptions,
      checkpointStore: options.checkpointStore,
    });
    executor.pipeline.restoreJobContext(latest.jobSnapshot);
    if (!executor.pipeline.getJob(options.jobId)) {
      executor.pipeline.createJob({
        jobId: latest.jobSnapshot.jobId,
        videoId: latest.jobSnapshot.videoId,
        groupId: latest.jobSnapshot.groupId,
        songId: latest.jobSnapshot.songId,
        memberId: latest.jobSnapshot.memberId,
        inputVideoUrl: latest.jobSnapshot.inputVideoUrl,
      });
      executor.pipeline.restoreJobContext(latest.jobSnapshot);
    }
    return executor;
  }
}

export default ProductionPipelineExecutor;
