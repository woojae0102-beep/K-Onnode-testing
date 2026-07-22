// @ts-nocheck
/**
 * Serializable Production Authority Proof (PHASE 12).
 *
 * Distributed trust boundary — survives JSON.stringify / Firestore / API.
 * NOT a client-controlled boolean. Requires structural fields issued at ingest.
 */
export const PRODUCTION_AUTHORITY_SOURCE = 'production_ingest' as const;

export type ProductionAuthorityProof = Readonly<{
  source: typeof PRODUCTION_AUTHORITY_SOURCE;
  productionAssetId: string;
  /** Firestore authority record key — immutable server reference */
  authorityRecordId: string;
  ingestJobId: string;
  ingestedAt: string;
  /** Admin/service uid when issued server-side */
  ingestedBy?: string;
}>;

export function createProductionAuthorityProof(input: {
  productionAssetId: string;
  authorityRecordId: string;
  ingestJobId: string;
  ingestedAt?: string;
  ingestedBy?: string;
}): ProductionAuthorityProof {
  if (!input.productionAssetId?.trim()) {
    throw new Error('productionAssetId required for authority proof');
  }
  if (!input.authorityRecordId?.trim()) {
    throw new Error('authorityRecordId required for authority proof');
  }
  if (!input.ingestJobId?.trim()) {
    throw new Error('ingestJobId required for authority proof');
  }
  return Object.freeze({
    source: PRODUCTION_AUTHORITY_SOURCE,
    productionAssetId: input.productionAssetId.trim(),
    authorityRecordId: input.authorityRecordId.trim(),
    ingestJobId: input.ingestJobId.trim(),
    ingestedAt: input.ingestedAt ?? new Date().toISOString(),
    ingestedBy: input.ingestedBy?.trim() || undefined,
  });
}

export function isValidProductionAuthorityProof(
  proof: unknown,
  expectedProductionAssetId?: string,
): proof is ProductionAuthorityProof {
  if (typeof proof !== 'object' || proof === null) return false;
  const record = proof as ProductionAuthorityProof;
  if (record.source !== PRODUCTION_AUTHORITY_SOURCE) return false;
  if (typeof record.productionAssetId !== 'string' || !record.productionAssetId.trim()) return false;
  if (typeof record.authorityRecordId !== 'string' || !record.authorityRecordId.trim()) return false;
  if (typeof record.ingestJobId !== 'string' || !record.ingestJobId.trim()) return false;
  if (typeof record.ingestedAt !== 'string' || !record.ingestedAt.trim()) return false;
  if (expectedProductionAssetId && record.productionAssetId !== expectedProductionAssetId) {
    return false;
  }
  return true;
}

export function proofSurvivesJsonSerialization(proof: ProductionAuthorityProof): boolean {
  const parsed = JSON.parse(JSON.stringify(proof));
  return isValidProductionAuthorityProof(parsed, proof.productionAssetId);
}

export default createProductionAuthorityProof;
