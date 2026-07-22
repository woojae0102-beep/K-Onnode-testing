// @ts-nocheck
export type {
  GX10ProductionMotionProcessor,
  GX10ProductionMotionProcessorInput,
  GX10MemberMapping,
  GX10SourceVideoMetadata,
  GX10SourceVideoType,
} from '../contracts/GX10ProductionMotionProcessor';
export type {
  GX10ProductionMotionJob,
  GX10ProductionMotionJobResult,
  GX10ProductionMotionJobStatus,
} from '../contracts/GX10ProductionMotionJob';
export type {
  GX10ProductionMotionOutput,
  GX10GeneratedMemberMotion,
  GX10SourceProcessor,
} from '../contracts/GX10ProductionMotionOutput';
export type {
  ProductionMotionAssetIngestor,
  ProductionMotionAssetIngestResult,
} from '../contracts/ProductionMotionAssetIngestor';
export type {
  GX10ProductionMotionJobOutputContract,
  GX10ProductionMotionMemberOutputRecord,
  GX10ProductionMotionProvider,
} from '../contracts/GX10ProductionMotionOutputContract';
export { GX10_OUTPUT_CONTRACT_VERSION } from '../contracts/GX10ProductionMotionOutputContract';
export {
  validateGX10JobOutputContract,
  validateGX10ProductionMotionOutput,
} from '../ingest/validateGX10ProcessorOutput';
export {
  mapGX10ContractToProcessorOutput,
  mapGX10JobOutputToProductionMotionAssetV2,
} from '../ingest/mapGX10OutputToProductionMotionAssetV2';
export {
  computeGX10MemberOutputChecksum,
  computeGX10MemberOutputChecksumSync,
  buildCanonicalGX10MemberChecksumPayload,
  memberRecordMatchesChecksum,
} from '../ingest/computeGX10MemberOutputChecksum';
export {
  runGX10ProductionMotionPipeline,
} from '../ingest/GX10ProductionMotionPipeline';
export { DefaultProductionMotionAssetIngestor } from '../ingest/DefaultProductionMotionAssetIngestor';
export type { TrustedRealProductionProvenance } from '../ingest/trustedProvenance';
export { isTrustedRealProductionProvenance } from '../ingest/trustedProvenance';
export type { ProductionAuthorityProof } from '../ingest/productionAuthorityProof';
export {
  createProductionAuthorityProof,
  isValidProductionAuthorityProof,
  proofSurvivesJsonSerialization,
} from '../ingest/productionAuthorityProof';
export type {
  ProductionAuthorityRecord,
  ProductionAuthorityVerification,
} from '../ingest/productionAuthorityVerification';
export {
  verifyProductionAuthority,
  assertAuthorityVerificationMatchesAsset,
} from '../ingest/verifyProductionAuthority';
/** @deprecated use GX10ProductionMotionProcessor */
export type { ProductionDanceProcessor, ProductionDanceProcessorOptions } from '../contracts/ProductionDanceProcessor';
