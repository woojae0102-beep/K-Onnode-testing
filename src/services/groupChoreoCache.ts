// @ts-nocheck
const DB_NAME = 'onnode_group_choreo_v1';
const DB_VERSION = 1;
const STORE = 'choreo';

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'cacheKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function buildChoreoCacheKey(songId, videoId) {
  return `${songId}:${videoId || 'default'}`;
}

export async function getCachedChoreo(cacheKey) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(cacheKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function saveCachedChoreo(entry) {
  const db = await openDb();
  if (!db || !entry?.cacheKey) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      ...entry,
      savedAt: entry.savedAt || new Date().toISOString(),
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function deleteCachedChoreo(cacheKey) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(cacheKey);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
