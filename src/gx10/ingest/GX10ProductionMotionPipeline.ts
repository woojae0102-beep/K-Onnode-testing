// @ts-nocheck
/**
 * GX10 Production Motion Pipeline (PHASE 14).
 *
 * Output → Validator → Mapper → Authority seal → ProductionMotionAssetV2
 *
 * Does NOT call Group Runtime or GX10 API.
 */
import type { AssetProvenance } from '../../modes/group/types/AssetProvenance';
import type { GX10ProductionMotionJobOutputContract } from '../contracts/GX10ProductionMotionOutputContract';
import type { ProductionMotionAssetIngestResult } from '../contracts/ProductionMotionAssetIngestor';
import { validateGX10JobOutputContract } from './validateGX10ProcessorOutput';
import { mapGX10ContractToProcessorOutput } from './mapGX10OutputToProductionMotionAssetV2';
import { DefaultProductionMotionAssetIngestor } from './DefaultProductionMotionAssetIngestor';

export type GX10ProductionMotionPipelineInput = {
  jobOutput: GX10ProductionMotionJobOutputContract;
  assetProvenance: AssetProvenance;
};

export type GX10ProductionMotionPipelineResult = ProductionMotionAssetIngestResult & {
  /** Validated job output contract (immutable reference) */
  jobOutput: GX10ProductionMotionJobOutputContract;
};

/**
 * Canonical PHASE 14 pipeline entry:
 * validate wire contract → map → ingest authority + provenance seal.
 */
export function runGX10ProductionMotionPipeline(
  input: GX10ProductionMotionPipelineInput,
): GX10ProductionMotionPipelineResult {
  validateGX10JobOutputContract(input.jobOutput, input.assetProvenance);

  const processorOutput = mapGX10ContractToProcessorOutput(input.jobOutput);
  const ingestResult = new DefaultProductionMotionAssetIngestor().ingestCompletedJob({
    jobResult: {
      jobId: input.jobOutput.jobId,
      status: 'completed',
      productionAssetId: input.jobOutput.productionAssetId,
    },
    processorOutput,
    assetProvenance: input.assetProvenance,
  });

  return {
    ...ingestResult,
    jobOutput: input.jobOutput,
  };
}

export default runGX10ProductionMotionPipeline;
