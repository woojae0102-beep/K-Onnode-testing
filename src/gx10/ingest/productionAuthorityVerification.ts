// @ts-nocheck
/**
 * Production authority verification types (PHASE 13 / 13.5 / 15).
 */
import type { ProductionAuthorityToken } from './ProductionAuthorityToken';
import type { ProductionAuthorityVerificationSuccess } from './productionAuthorityVerificationResult';

export type ProductionAuthorityVerification = ProductionAuthorityVerificationSuccess;

export type ProductionAuthorityRecord = {
  source: 'production_ingest';
  productionAssetId: string;
  authorityRecordId: string;
  ingestJobId: string;
  ingestedAt: string;
  ingestedBy?: string;
  groupId: string;
  songId: string;
  memberIds: string[];
  status: 'active' | 'revoked';
  authorityVersion: number;
  nonce: string;
  assetHash: string;
  authorityToken: ProductionAuthorityToken;
};

export type { ProductionAuthorityVerificationResult, ProductionAuthorityVerificationFailure, ProductionAuthorityVerificationSuccess } from './productionAuthorityVerificationResult';

export default ProductionAuthorityVerification;
