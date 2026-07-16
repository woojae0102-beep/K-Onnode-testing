// @ts-nocheck
/**
 * Production Dance Asset Loader — Server Source of Truth, IndexedDB cache only.
 */
import type { ProductionDanceAsset } from '../../types/productionDanceAsset';
import { PRODUCTION_ERRORS } from '../../types/productionDanceAsset';
import { loadProductionAssetFromIndexedDb, saveProductionAssetToIndexedDb } from './ProductionDanceAssetStore';
import { fetchProductionDanceAssetFromServer } from './ProductionDanceAssetApi';

const memoryCache = new Map<string, ProductionDanceAsset>();

function cacheKey(groupId: string, songId: string) {
  return `${groupId}:${songId}`;
}

export type LoadProductionDanceAssetOptions = {
  groupId: string;
  songId: string;
};

export type LoadProductionDanceAssetResult = {
  asset: ProductionDanceAsset;
  source: 'server' | 'indexeddb_cache';
};

export async function loadProductionDanceAsset(
  opts: LoadProductionDanceAssetOptions,
): Promise<LoadProductionDanceAssetResult> {
  const { groupId, songId } = opts;
  const key = cacheKey(groupId, songId);

  if (memoryCache.has(key)) {
    const asset = memoryCache.get(key)!;
    if (asset.status !== 'ready') {
      throw new Error(`${PRODUCTION_ERRORS.PRODUCTION_NOT_READY}: ${asset.status}`);
    }
    return { asset, source: 'server' };
  }

  try {
    const fromServer = await fetchProductionDanceAssetFromServer(groupId, songId);
    if (fromServer?.status === 'ready') {
      memoryCache.set(key, fromServer);
      await saveProductionAssetToIndexedDb(fromServer);
      return { asset: fromServer, source: 'server' };
    }
  } catch (err) {
    const msg = (err as Error)?.message || '';
    if (msg.includes(PRODUCTION_ERRORS.PRODUCTION_NOT_READY) || msg.includes('404')) {
      throw new Error(
        '이 곡은 아직 Production Dance Data가 준비되지 않았습니다. '
        + 'Admin Production Dance Studio에서 콘텐츠를 제작해 주세요.',
      );
    }
    console.warn('[ProductionDanceAssetLoader] server fetch failed', err);
  }

  const fromCache = await loadProductionAssetFromIndexedDb(groupId, songId);
  if (fromCache?.status === 'ready') {
    console.warn('[ProductionDanceAssetLoader] Using IndexedDB cache — server unavailable');
    memoryCache.set(key, fromCache);
    return { asset: fromCache, source: 'indexeddb_cache' };
  }

  throw new Error(
    '이 곡은 아직 Production Dance Data가 준비되지 않았습니다. '
    + 'Admin Production Dance Studio에서 콘텐츠를 제작해 주세요.',
  );
}

export function clearProductionDanceAssetCache(): void {
  memoryCache.clear();
}

export default loadProductionDanceAsset;
