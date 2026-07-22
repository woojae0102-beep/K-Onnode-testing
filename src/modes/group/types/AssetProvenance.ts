// @ts-nocheck
/**
 * Production Motion Asset provenance — asset origin classification (PHASE 9B).
 *
 * NOT the same as sourceProcessor (gx10/deepmotion/manual_import).
 */

export type AssetProvenance =
  | 'real_production'
  | 'synthetic_test'
  | 'dev_fixture';

export const ASSET_PROVENANCE_VALUES: AssetProvenance[] = [
  'real_production',
  'synthetic_test',
  'dev_fixture',
];

export default AssetProvenance;
