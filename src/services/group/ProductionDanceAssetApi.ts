// @ts-nocheck
/**
 * Production Dance Asset API — Firestore Source of Truth (server proxy).
 */
import type { ProductionDanceAsset } from '../../types/productionDanceAsset';
import { PRODUCTION_ERRORS } from '../../types/productionDanceAsset';
import { authHeaders } from '../../utils/apiAuth';
import { saveProductionAssetToIndexedDb } from './ProductionDanceAssetStore';

const API = '/api/group?path=production-dance';

export async function fetchProductionDanceAssetFromServer(
  groupId: string,
  songId: string,
): Promise<ProductionDanceAsset | null> {
  const res = await fetch(`${API}&groupId=${encodeURIComponent(groupId)}&songId=${encodeURIComponent(songId)}`);
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.hint || data.error || PRODUCTION_ERRORS.PRODUCTION_NOT_READY);
  }
  return data.asset as ProductionDanceAsset;
}

export async function saveProductionDanceAssetToServer(
  asset: ProductionDanceAsset,
  status?: ProductionDanceAsset['status'],
): Promise<ProductionDanceAsset> {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ asset, status: status || asset.status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data.error || PRODUCTION_ERRORS.PRODUCTION_ASSET_SAVE_FAILED;
    throw new Error(`${code}: ${data.hint || res.statusText}`);
  }
  const saved = data.asset as ProductionDanceAsset;
  await saveProductionAssetToIndexedDb(saved);
  return saved;
}

export default {
  fetchProductionDanceAssetFromServer,
  saveProductionDanceAssetToServer,
};
