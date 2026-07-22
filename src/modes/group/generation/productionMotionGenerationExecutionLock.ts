// @ts-nocheck
/**
 * Production Motion Generation Execution Lock (PHASE 19).
 * Prevents concurrent execution of the same job.
 */
export type ExecutionLockToken = {
  jobId: string;
  ownerId: string;
  acquiredAt: string;
};

export class ProductionMotionGenerationExecutionLock {
  private locks = new Map<string, ExecutionLockToken>();

  tryAcquire(jobId: string, ownerId: string): ExecutionLockToken | null {
    if (this.locks.has(jobId)) return null;
    const token: ExecutionLockToken = {
      jobId,
      ownerId,
      acquiredAt: new Date().toISOString(),
    };
    this.locks.set(jobId, token);
    return token;
  }

  release(jobId: string, ownerId?: string): boolean {
    const existing = this.locks.get(jobId);
    if (!existing) return false;
    if (ownerId && existing.ownerId !== ownerId) return false;
    this.locks.delete(jobId);
    return true;
  }

  isLocked(jobId: string): boolean {
    return this.locks.has(jobId);
  }

  getLock(jobId: string): ExecutionLockToken | undefined {
    return this.locks.get(jobId);
  }

  clear(): void {
    this.locks.clear();
  }
}

export default ProductionMotionGenerationExecutionLock;
