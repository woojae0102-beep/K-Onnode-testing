// @ts-nocheck
/**
 * In-memory ingest marker (PHASE 10) — NOT distributed trust proof.
 *
 * @deprecated for trust boundary — use productionAuthorityProof (PHASE 12).
 * Symbol seal is lost on JSON.stringify / Firestore / API round-trip.
 */
const TRUSTED_PROVENANCE_SOURCE = 'production_ingest' as const;
const TRUSTED_SEAL = Symbol.for('k-onnode.trusted-real-production-provenance');

export type TrustedRealProductionProvenance = Readonly<{
  provenance: 'real_production';
  source: typeof TRUSTED_PROVENANCE_SOURCE;
  ingestJobId: string;
  productionAssetId: string;
  ingestedAt: string;
}>;

export type SealedTrustedRealProductionProvenance = TrustedRealProductionProvenance & {
  readonly [TRUSTED_SEAL]: true;
};

export function sealTrustedRealProductionProvenance(input: {
  ingestJobId: string;
  productionAssetId: string;
  ingestedAt?: string;
}): SealedTrustedRealProductionProvenance {
  if (!input.ingestJobId?.trim()) {
    throw new Error('ingestJobId required for trusted provenance');
  }
  if (!input.productionAssetId?.trim()) {
    throw new Error('productionAssetId required for trusted provenance');
  }
  return Object.freeze({
    provenance: 'real_production',
    source: TRUSTED_PROVENANCE_SOURCE,
    ingestJobId: input.ingestJobId.trim(),
    productionAssetId: input.productionAssetId.trim(),
    ingestedAt: input.ingestedAt ?? new Date().toISOString(),
    [TRUSTED_SEAL]: true as const,
  });
}

export function isTrustedRealProductionProvenance(
  value: unknown,
): value is SealedTrustedRealProductionProvenance {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string | symbol, unknown>;
  return (
    record[TRUSTED_SEAL] === true
    && record.provenance === 'real_production'
    && record.source === TRUSTED_PROVENANCE_SOURCE
    && typeof record.ingestJobId === 'string'
    && record.ingestJobId.length > 0
    && typeof record.productionAssetId === 'string'
    && record.productionAssetId.length > 0
    && typeof record.ingestedAt === 'string'
    && record.ingestedAt.length > 0
  );
}

export default sealTrustedRealProductionProvenance;
