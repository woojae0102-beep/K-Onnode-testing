// @ts-nocheck
/**
 * Per-job adapter execution state (PHASE 20).
 */
export type AdapterExecutionState = {
  externalJobId: string | null;
  submitCompleted: boolean;
  pollCompleted: boolean;
  downloadCompleted: boolean;
  persistCompleted: boolean;
  authorityRegistered: boolean;
  motionGlbUrl: string | null;
  storageUrl: string | null;
  productionMotionAssetId: string | null;
  adapterCallLog: string[];
};

export function createAdapterExecutionState(): AdapterExecutionState {
  return {
    externalJobId: null,
    submitCompleted: false,
    pollCompleted: false,
    downloadCompleted: false,
    persistCompleted: false,
    authorityRegistered: false,
    motionGlbUrl: null,
    storageUrl: null,
    productionMotionAssetId: null,
    adapterCallLog: [],
  };
}

export class AdapterExecutionStateStore {
  private states = new Map<string, AdapterExecutionState>();

  get(jobId: string): AdapterExecutionState {
    if (!this.states.has(jobId)) {
      this.states.set(jobId, createAdapterExecutionState());
    }
    return this.states.get(jobId)!;
  }

  reset(jobId: string): void {
    this.states.set(jobId, createAdapterExecutionState());
  }

  clear(): void {
    this.states.clear();
  }
}

export default AdapterExecutionStateStore;
