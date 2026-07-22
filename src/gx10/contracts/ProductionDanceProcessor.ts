// @ts-nocheck
/**
 * GX10 Production Pipeline — contract only (PHASE 1: implementation 없음).
 */
import type { ProductionDanceAsset } from '../../types/productionDanceAsset';

export type ProductionDanceProcessorOptions = {
  groupId: string;
  songId: string;
  memberCount?: number;
};

export interface ProductionDanceProcessor {
  process(sourceVideo: Blob | string, options: ProductionDanceProcessorOptions): Promise<ProductionDanceAsset>;
}

export default ProductionDanceProcessor;
