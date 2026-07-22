// @ts-nocheck
/**
 * GX10 Producer Output Contract (PHASE 9B).
 *
 * Processor provenance (sourceProcessor) ≠ assetProvenance (real_production/synthetic_test/dev_fixture).
 *
 * MUST NOT contain: skeletonFrames, joints, trackId, frame arrays, MediaPipe types.
 */
import type { SkeletonProfile } from '../../modes/group/types/ProductionSkeletonContract';

export type GX10SourceProcessor =
  | 'gx10'
  | 'deepmotion'
  | 'manual_import';

export type GX10GeneratedMemberMotion = {
  memberId: string;
  motionAssetId: string;
  motionFormat: 'gltf_animation';
  motionUrl: string;
  animationClipName?: string;
  sourceSkeletonProfile: SkeletonProfile;
  sourceSkeletonVersion: string;
  durationSec: number;
};

export type GX10ProductionMotionOutput = {
  productionAssetId: string;
  schemaVersion: 2;
  groupId: string;
  songId: string;
  sourceProcessor: GX10SourceProcessor;
  processorVersion: string;
  sourceSkeletonProfile: SkeletonProfile;
  sourceSkeletonVersion: string;
  generatedAt: string;
  /** ingestor sets assetProvenance — NOT set by processor output directly unless explicit flag */
  markAsRealProduction?: boolean;
  members: Array<{
    memberId: string;
    memberName: string;
    avatarAssetId: string;
    avatarGlbUrl: string;
    avatarSkeletonProfile?: SkeletonProfile;
    avatarSkeletonVersion?: string;
    motion: GX10GeneratedMemberMotion;
    formationKeyframes?: Array<{
      timeSec: number;
      position: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
    }>;
  }>;
  durationSec: number;
  fps?: number;
};

export default GX10ProductionMotionOutput;
