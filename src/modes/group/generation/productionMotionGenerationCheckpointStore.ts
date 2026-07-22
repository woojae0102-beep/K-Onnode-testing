// @ts-nocheck
/**
 * Production Motion Generation Checkpoint Store (PHASE 19).
 */
import type { ProductionMotionGenerationPipelineStage } from './productionMotionGenerationPipelineContract';
import type { ProductionMotionGenerationJobContext } from './productionMotionGenerationJobContext';

export type ProductionMotionGenerationCheckpoint = {
  jobId: string;
  currentStage: ProductionMotionGenerationPipelineStage | null;
  completedStages: ProductionMotionGenerationPipelineStage[];
  retryCount: number;
  elapsedTimeMs: number;
  progressPercent: number;
  errorCode: string | null;
  timestamp: string;
  /** Full job snapshot for crash recovery resume. */
  jobSnapshot: ProductionMotionGenerationJobContext;
};

const nowIso = () => new Date().toISOString();

export function buildCheckpointFromJob(
  job: ProductionMotionGenerationJobContext,
): ProductionMotionGenerationCheckpoint {
  return {
    jobId: job.jobId,
    currentStage: job.currentStage,
    completedStages: [...job.completedStages],
    retryCount: job.retryCount,
    elapsedTimeMs: job.elapsedTimeMs,
    progressPercent: job.progressPercent,
    errorCode: job.errorCode,
    timestamp: nowIso(),
    jobSnapshot: { ...job, completedStages: [...job.completedStages] },
  };
}

export class ProductionMotionGenerationCheckpointStore {
  private checkpoints = new Map<string, ProductionMotionGenerationCheckpoint[]>();

  save(checkpoint: ProductionMotionGenerationCheckpoint): void {
    const list = this.checkpoints.get(checkpoint.jobId) || [];
    list.push(checkpoint);
    this.checkpoints.set(checkpoint.jobId, list);
  }

  saveFromJob(job: ProductionMotionGenerationJobContext): ProductionMotionGenerationCheckpoint {
    const checkpoint = buildCheckpointFromJob(job);
    this.save(checkpoint);
    return checkpoint;
  }

  getLatest(jobId: string): ProductionMotionGenerationCheckpoint | null {
    const list = this.checkpoints.get(jobId);
    if (!list?.length) return null;
    return list[list.length - 1];
  }

  list(jobId: string): ProductionMotionGenerationCheckpoint[] {
    return [...(this.checkpoints.get(jobId) || [])];
  }

  hasCheckpoint(jobId: string): boolean {
    return (this.checkpoints.get(jobId)?.length ?? 0) > 0;
  }

  clear(jobId?: string): void {
    if (jobId) {
      this.checkpoints.delete(jobId);
      return;
    }
    this.checkpoints.clear();
  }
}

export default ProductionMotionGenerationCheckpointStore;
