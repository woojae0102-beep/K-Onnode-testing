// @ts-nocheck
/**
 * Default Production Motion Asset Ingestor (PHASE 9B/10/14).
 *
 * CANONICAL AUTHORITY for assetProvenance='real_production'.
 * Converts completed processor output → ProductionMotionAssetV2 with trusted provenance seal.
 * NO Group Runtime imports.
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type { AssetProvenance } from '../../modes/group/types/AssetProvenance';
import type {
  ProductionMotionAssetIngestor,
  ProductionMotionAssetIngestResult,
} from '../contracts/ProductionMotionAssetIngestor';
import type { GX10ProductionMotionJobResult } from '../contracts/GX10ProductionMotionJob';
import type { GX10ProductionMotionOutput } from '../contracts/GX10ProductionMotionOutput';
import type { GX10ProductionMotionJobOutputContract } from '../contracts/GX10ProductionMotionOutputContract';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../../modes/group/types/ProductionMotionAssetV2';
import { sealTrustedRealProductionProvenance } from './trustedProvenance';
import { createProductionAuthorityProof } from './productionAuthorityProof';
import { validateProvenanceTrustBoundary } from './validateProvenanceTrustBoundary';
import { validateRealProductionIntakeContract } from './ProductionAssetIntakeContract';
import { validateGX10ProductionMotionOutput } from './validateGX10ProcessorOutput';
import { runGX10ProductionMotionPipeline } from './GX10ProductionMotionPipeline';

function assertCompletedJob(jobResult: GX10ProductionMotionJobResult): void {
  if (jobResult.status !== 'completed') {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY,
      `job ${jobResult.jobId} status=${jobResult.status}`,
    );
  }
  if (!jobResult.productionAssetId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
      'productionAssetId missing on completed job',
    );
  }
}

function resolveIngestProvenance(
  requested: AssetProvenance,
  output: GX10ProductionMotionOutput,
): AssetProvenance {
  if (requested === 'real_production') {
    if (!output.markAsRealProduction) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
        'real_production requires processorOutput.markAsRealProduction=true',
      );
    }
    return 'real_production';
  }
  if (requested === 'synthetic_test' || requested === 'dev_fixture') {
    if (output.markAsRealProduction) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_PROVENANCE_INVALID,
        'markAsRealProduction cannot be used with non-real ingest provenance',
      );
    }
  }
  return requested;
}

function sealRealProductionAsset(
  asset: ProductionMotionAssetV2,
  input: {
    jobId: string;
    productionAssetId: string;
    ingestedAt: string;
  },
): void {
  asset.productionAuthorityProof = createProductionAuthorityProof({
    productionAssetId: input.productionAssetId,
    authorityRecordId: input.productionAssetId,
    ingestJobId: input.jobId,
    ingestedAt: input.ingestedAt,
  });
  asset.trustedProvenance = sealTrustedRealProductionProvenance({
    ingestJobId: input.jobId,
    productionAssetId: input.productionAssetId,
    ingestedAt: input.ingestedAt,
  });
  validateProvenanceTrustBoundary(asset);
  validateRealProductionIntakeContract(asset);
}

export class DefaultProductionMotionAssetIngestor implements ProductionMotionAssetIngestor {
  /** PHASE 14 — wire contract → validate → map → authority seal */
  ingestGX10JobOutput(input: {
    jobOutput: GX10ProductionMotionJobOutputContract;
    assetProvenance: AssetProvenance;
  }): ProductionMotionAssetIngestResult {
    return runGX10ProductionMotionPipeline(input);
  }

  ingestCompletedJob(input: {
    jobResult: GX10ProductionMotionJobResult;
    processorOutput: GX10ProductionMotionOutput;
    assetProvenance: AssetProvenance;
  }): ProductionMotionAssetIngestResult {
    assertCompletedJob(input.jobResult);

    const assetProvenance = resolveIngestProvenance(input.assetProvenance, input.processorOutput);
    validateGX10ProductionMotionOutput(input.processorOutput, assetProvenance);

    if (input.processorOutput.productionAssetId !== input.jobResult.productionAssetId) {
      throw new ProductionMotionAssetError(
        PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_SCHEMA_INVALID,
        'productionAssetId mismatch between job result and processor output',
      );
    }

    const now = new Date().toISOString();
    const productionAssetId = input.jobResult.productionAssetId!;

    const asset: ProductionMotionAssetV2 = {
      schemaVersion: 2,
      groupId: input.processorOutput.groupId,
      songId: input.processorOutput.songId,
      durationSec: input.processorOutput.durationSec,
      fps: input.processorOutput.fps,
      status: 'ready',
      assetProvenance,
      productionAssetId,
      createdAt: input.processorOutput.generatedAt || now,
      updatedAt: now,
      members: input.processorOutput.members.map((m) => ({
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
        formation: m.formationKeyframes?.length
          ? { keyframes: m.formationKeyframes }
          : undefined,
      })),
    };

    if (assetProvenance === 'real_production') {
      sealRealProductionAsset(asset, {
        jobId: input.jobResult.jobId,
        productionAssetId,
        ingestedAt: now,
      });
    } else {
      validateProvenanceTrustBoundary(asset);
    }

    return {
      asset,
      assetProvenance,
      productionAssetId,
    };
  }
}

export default DefaultProductionMotionAssetIngestor;
