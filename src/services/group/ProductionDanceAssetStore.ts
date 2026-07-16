// @ts-nocheck
import type { ProductionDanceAsset } from '../../types/productionDanceAsset';

const DB_NAME = 'onnode_production_dance_v1';
const STORE = 'assets';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function buildProductionAssetId(groupId: string, songId: string) {
  return `${groupId}/${songId}`;
}

export async function saveProductionAssetToIndexedDb(asset: ProductionDanceAsset): Promise<void> {
  const db = await openDb();
  if (!db) throw new Error('IndexedDB unavailable');
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProductionAssetFromIndexedDb(
  groupId: string,
  songId: string,
): Promise<ProductionDanceAsset | null> {
  const db = await openDb();
  if (!db) return null;
  const id = buildProductionAssetId(groupId, songId);
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as ProductionDanceAsset) || null);
    req.onerror = () => resolve(null);
  });
}

export default {
  saveProductionAssetToIndexedDb,
  loadProductionAssetFromIndexedDb,
  buildProductionAssetId,
};
