// @ts-nocheck
/**
 * GX10 Job Output Contract → ProductionMotionAssetV2 mapper (PHASE 14).
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type { AssetProvenance } from '../../modes/group/types/AssetProvenance';
import type { GX10ProductionMotionOutput } from '../contracts/GX10ProductionMotionOutput';
import type { GX10ProductionMotionJobOutputContract } from '../contracts/GX10ProductionMotionOutputContract';

export function mapGX10ContractToProcessorOutput(
  jobOutput: GX10ProductionMotionJobOutputContract,
): GX10ProductionMotionOutput {
  const durationSec = Math.max(...jobOutput.members.map((m) => m.duration));
  const sourceSkeletonProfile = jobOutput.members[0].sourceSkeletonProfile;
  const sourceSkeletonVersion = jobOutput.members[0].sourceSkeletonVersion;

  return {
    productionAssetId: jobOutput.productionAssetId,
    schemaVersion: 2,
    groupId: jobOutput.groupId,
    songId: jobOutput.songId,
    sourceProcessor: jobOutput.provider,
    processorVersion: jobOutput.processorVersion,
    sourceSkeletonProfile,
    sourceSkeletonVersion,
    generatedAt: jobOutput.generatedAt,
    markAsRealProduction: jobOutput.markAsRealProduction,
    durationSec,
    fps: jobOutput.fps,
    members: jobOutput.members.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      avatarAssetId: m.avatarAssetId,
      avatarGlbUrl: m.avatarGlbUrl,
      avatarSkeletonProfile: m.avatarSkeletonProfile,
      avatarSkeletonVersion: m.avatarSkeletonVersion,
      motion: {
        memberId: m.memberId,
        motionAssetId: m.motionAssetId,
        motionFormat: 'gltf_animation',
        motionUrl: m.motionUrl,
        animationClipName: m.animationClipName,
        sourceSkeletonProfile: m.sourceSkeletonProfile,
        sourceSkeletonVersion: m.sourceSkeletonVersion,
        durationSec: m.duration,
      },
    })),
  };
}

export function mapGX10JobOutputToProductionMotionAssetV2(
  jobOutput: GX10ProductionMotionJobOutputContract,
  assetProvenance: AssetProvenance,
): ProductionMotionAssetV2 {
  const processorOutput = mapGX10ContractToProcessorOutput(jobOutput);
  const now = new Date().toISOString();

  return {
    schemaVersion: 2,
    groupId: processorOutput.groupId,
    songId: processorOutput.songId,
    durationSec: processorOutput.durationSec,
    fps: processorOutput.fps,
    status: 'ready',
    assetProvenance,
    productionAssetId: processorOutput.productionAssetId,
    createdAt: processorOutput.generatedAt || now,
    updatedAt: now,
    members: processorOutput.members.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      avatar: {
        avatarAssetId: m.avatarAssetId,
        glbUrl: m.avatarGlbUrl,
        avatarSkeletonProfile: m.avatarSkeletonProfile,
        avatarSkeletonVersion: m.avatarSkeletonVersion,
      },
      motion: {
        motionAssetId: m.motion.motionAssetId,
        motionFormat: 'gltf_animation',
        motionUrl: m.motion.motionUrl,
        durationSec: m.motion.durationSec,
        animationClipName: m.motion.animationClipName,
        sourceSkeletonProfile: m.motion.sourceSkeletonProfile,
        sourceSkeletonVersion: m.motion.sourceSkeletonVersion,
      },
    })),
  };
}

export default mapGX10JobOutputToProductionMotionAssetV2;
