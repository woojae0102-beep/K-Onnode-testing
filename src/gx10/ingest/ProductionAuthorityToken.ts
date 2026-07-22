// @ts-nocheck
/**
 * Production Authority Token contract (PHASE 13.5).
 */
export const PRODUCTION_AUTHORITY_TOKEN_VERSION = 1 as const;
export const PRODUCTION_AUTHORITY_ISSUER = 'k-onnode-production-authority' as const;
export const PRODUCTION_AUTHORITY_ALGORITHM = 'RSASSA-PKCS1-v1_5-SHA256' as const;

export type ProductionAuthorityAlgorithm = typeof PRODUCTION_AUTHORITY_ALGORITHM;

export type ProductionAuthorityToken = Readonly<{
  version: typeof PRODUCTION_AUTHORITY_TOKEN_VERSION;
  issuer: typeof PRODUCTION_AUTHORITY_ISSUER;
  issuedAt: string;
  expiresAt: string;
  productionAssetId: string;
  authorityRecordId: string;
  groupId: string;
  songId: string;
  memberIds: string[];
  authorityVersion: number;
  nonce: string;
  assetHash: string;
  algorithm: ProductionAuthorityAlgorithm;
  signature: string;
}>;

export type ProductionAuthorityTokenPayload = Omit<ProductionAuthorityToken, 'signature'>;

export default ProductionAuthorityToken;
