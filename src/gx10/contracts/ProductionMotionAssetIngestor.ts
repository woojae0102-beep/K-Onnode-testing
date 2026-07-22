// @ts-nocheck
/**
 * Production Motion Asset Ingest boundary (PHASE 9B).
 *
 * IMPLEMENTATION BOUNDARY:
 *   GX10ProductionMotionJobResult
 *     → Production Motion Asset Ingest (this module)
 *     → ProductionMotionAssetV2
 *     → ProductionMotionAssetLoader (Group consumer)
 *     → Group Runtime
 *
 * This module MUST NOT:
 * - perform motion extraction
 * - perform retargeting
 * - call MediaPipe
 * - import Group Runtime code (AvatarCharacterAnimated3D, GroupDanceSyncEngine, etc.)
 */
import type { ProductionMotionAssetV2 } from '../../modes/group/types/ProductionMotionAssetV2';
import type { AssetProvenance } from '../../modes/group/types/AssetProvenance';
import type { GX10ProductionMotionJobResult } from './GX10ProductionMotionJob';
import type { GX10ProductionMotionOutput } from './GX10ProductionMotionOutput';
import type { GX10ProductionMotionJobOutputContract } from './GX10ProductionMotionOutputContract';

export type ProductionMotionAssetIngestResult = {
  asset: ProductionMotionAssetV2;
  assetProvenance: AssetProvenance;
  productionAssetId: string;
};

export interface ProductionMotionAssetIngestor {
  /** PHASE 14 — GX10 wire contract ingest path */
  ingestGX10JobOutput(input: {
    jobOutput: GX10ProductionMotionJobOutputContract;
    assetProvenance: AssetProvenance;
  }): ProductionMotionAssetIngestResult;

  ingestCompletedJob(input: {
    jobResult: GX10ProductionMotionJobResult;
    processorOutput: GX10ProductionMotionOutput;
    assetProvenance: AssetProvenance;
  }): ProductionMotionAssetIngestResult;
}

export default ProductionMotionAssetIngestor;
