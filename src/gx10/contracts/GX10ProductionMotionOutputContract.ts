// @ts-nocheck
/**
 * GX10 Production Motion Output Contract — wire format (PHASE 14).
 *
 * Flat per-member records grouped under a completed job envelope.
 * NO skeletonFrames / joints / MediaPipe types.
 *
 * GX10 API is NOT connected in this phase — contract + validation + mapping only.
 */
import type { SkeletonProfile } from '../../modes/group/types/ProductionSkeletonContract';

export const GX10_OUTPUT_CONTRACT_VERSION = 1 as const;

export type GX10ProductionMotionProvider =
  | 'gx10'
  | 'deepmotion'
  | 'manual_import';

export type GX10ProductionMotionJobStatus = 'completed' | 'failed';

/** Per-member processor output record (checksum covers motion identity fields). */
export type GX10ProductionMotionMemberOutputRecord = Readonly<{
  memberId: string;
  memberName: string;
  avatarAssetId: string;
  avatarGlbUrl: string;
  avatarSkeletonProfile: SkeletonProfile;
  avatarSkeletonVersion: string;
  motionAssetId: string;
  motionUrl: string;
  /** Motion duration in seconds */
  duration: number;
  animationClipName: string;
  sourceSkeletonProfile: SkeletonProfile;
  sourceSkeletonVersion: string;
  /** SHA-256 hex of canonical member checksum payload */
  checksum: string;
}>;

/** Completed job output envelope — canonical GX10 → K-ONNODE ingest input. */
export type GX10ProductionMotionJobOutputContract = Readonly<{
  contractVersion: typeof GX10_OUTPUT_CONTRACT_VERSION;
  jobId: string;
  status: GX10ProductionMotionJobStatus;
  productionAssetId: string;
  groupId: string;
  songId: string;
  fps: number;
  provider: GX10ProductionMotionProvider;
  processorVersion: string;
  generatedAt: string;
  markAsRealProduction?: boolean;
  members: GX10ProductionMotionMemberOutputRecord[];
}>;

export default GX10ProductionMotionJobOutputContract;
