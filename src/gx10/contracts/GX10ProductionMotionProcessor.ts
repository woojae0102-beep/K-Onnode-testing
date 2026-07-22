// @ts-nocheck
/**
 * GX10 Production Motion Processor — interface only (PHASE 9B).
 *
 * IMPLEMENTATION BOUNDARY:
 * - GX10 owns: source motion processing, job lifecycle, motion asset generation, skeleton metadata.
 * - GX10 MUST NOT: call Group Runtime, retarget, or inspect K-ONNODE playback verification.
 * - NO GX10 API / hardware / sensor in this phase.
 */
import type {
  GX10ProductionMotionJob,
  GX10ProductionMotionJobResult,
} from './GX10ProductionMotionJob';

export type GX10SourceVideoType =
  | 'uploaded_video'
  | 'reference_video'
  | 'gx10_capture';

export type GX10SourceVideoMetadata = {
  durationSec: number;
  fps: number;
  sourceType: GX10SourceVideoType;
};

export type GX10MemberMapping = {
  memberId: string;
  memberName: string;
  memberOrder: number;
};

export type GX10ProductionMotionProcessorInput = {
  groupId: string;
  songId: string;
  sourceVideo: Blob | string;
  memberMapping: GX10MemberMapping[];
  requestedMemberCount: number;
  sourceVideoMetadata: GX10SourceVideoMetadata;
};

/** Async job-based — MUST NOT return ProductionMotionAssetV2 directly */
export interface GX10ProductionMotionProcessor {
  submitJob(input: GX10ProductionMotionProcessorInput): Promise<GX10ProductionMotionJob>;

  getJobStatus(jobId: string): Promise<GX10ProductionMotionJob>;

  getJobResult(jobId: string): Promise<GX10ProductionMotionJobResult>;
}

export default GX10ProductionMotionProcessor;
