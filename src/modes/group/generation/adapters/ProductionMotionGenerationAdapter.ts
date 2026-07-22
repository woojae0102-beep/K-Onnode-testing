// @ts-nocheck
/**
 * Production Motion Generation Adapter Contract (PHASE 20).
 * Pipeline / Executor depend on this interface only — no direct GX10 REST import.
 */
import type { ProductionMotionGenerationJobContext } from '../productionMotionGenerationJobContext';

export type AdapterResult<T = Record<string, unknown>> =
  | { ok: true; data?: T }
  | { ok: false; errorCode: string; message?: string; recoverable?: boolean };

export type AdapterSubmitInput = {
  job: ProductionMotionGenerationJobContext;
  inputVideoUrl?: string | null;
};

export type AdapterSubmitData = {
  externalJobId: string;
  status: 'queued' | 'processing';
};

export type AdapterPollInput = {
  job: ProductionMotionGenerationJobContext;
  externalJobId: string;
};

export type AdapterPollData = {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  errorCode?: string;
};

export type AdapterDownloadInput = {
  job: ProductionMotionGenerationJobContext;
  externalJobId: string;
};

export type AdapterDownloadData = {
  motionGlbUrl: string;
  byteLength?: number;
};

export type AdapterPersistInput = {
  job: ProductionMotionGenerationJobContext;
  externalJobId: string;
  motionGlbUrl: string;
};

export type AdapterPersistData = {
  storageUrl: string;
  productionMotionAssetId: string;
  metadataWritten: boolean;
};

export type AdapterRegisterAuthorityInput = {
  job: ProductionMotionGenerationJobContext;
  externalJobId: string;
  productionMotionAssetId: string;
};

export type AdapterRegisterAuthorityData = {
  authorityStatus: 'registered' | 'blocked';
  authorityRecordId?: string;
};

export type AdapterCancelInput = {
  job: ProductionMotionGenerationJobContext;
  externalJobId?: string;
};

export type AdapterRetryInput = {
  job: ProductionMotionGenerationJobContext;
  externalJobId?: string;
  reason: string;
};

export type AdapterRetryData = {
  externalJobId: string;
  retryCount: number;
};

/** Swappable generation backend — GX10 / DeepMotion / Local. */
export interface ProductionMotionGenerationAdapter {
  readonly adapterId: string;

  submitJob(input: AdapterSubmitInput): Promise<AdapterResult<AdapterSubmitData>>;

  pollJob(input: AdapterPollInput): Promise<AdapterResult<AdapterPollData>>;

  downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult<AdapterDownloadData>>;

  persistMotion(input: AdapterPersistInput): Promise<AdapterResult<AdapterPersistData>>;

  registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult<AdapterRegisterAuthorityData>>;

  cancelJob(input: AdapterCancelInput): Promise<AdapterResult<{ cancelled: boolean }>>;

  retryJob(input: AdapterRetryInput): Promise<AdapterResult<AdapterRetryData>>;
}

export default ProductionMotionGenerationAdapter;
