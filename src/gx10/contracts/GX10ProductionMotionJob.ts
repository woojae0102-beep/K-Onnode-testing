// @ts-nocheck
/**
 * GX10 Production Motion async job types (PHASE 9B).
 */

export type GX10ProductionMotionJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export type GX10ProductionMotionJob = {
  jobId: string;
  groupId: string;
  songId: string;
  status: GX10ProductionMotionJobStatus;
  createdAt: string;
  updatedAt: string;
};

export type GX10ProductionMotionJobResult = {
  jobId: string;
  status: 'completed' | 'failed';
  /** Processor output handle — ingest boundary consumes this, not a runtime asset */
  productionAssetId: string | null;
  errorCode?: string;
};

export default GX10ProductionMotionJob;
