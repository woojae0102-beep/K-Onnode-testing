// @ts-nocheck
const DB_NAME = 'onnode_reference_video_v1';
const DB_VERSION = 1;
const STORE = 'videos';

export interface ReferenceVideoRecord {
  cacheKey: string;
  songId: string;
  videoId: string;
  groupId?: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  blob: Blob;
  savedAt: string;
}

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

export function buildReferenceVideoCacheKey(songId: string, videoId: string) {
  return `ref:${songId}:${videoId || 'default'}`;
}

/** Reference Video Blob 영구 저장 — 추출 후 video.src="" 해도 재생 가능 */
export async function saveReferenceVideo(record: Omit<ReferenceVideoRecord, 'savedAt'>) {
  const db = await openDb();
  if (!db || !record?.cacheKey || !record.blob) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      ...record,
      savedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getReferenceVideo(cacheKey: string): Promise<ReferenceVideoRecord | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(cacheKey);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function getReferenceVideoObjectUrl(cacheKey: string): Promise<string | null> {
  const record = await getReferenceVideo(cacheKey);
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

export async function deleteReferenceVideo(cacheKey: string) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(cacheKey);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
