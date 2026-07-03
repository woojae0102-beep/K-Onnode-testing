// @ts-nocheck
import { MOTION_PIPELINE_VERSION } from './motion/GroupMotionPipeline';

const DB_NAME = 'onnode_group_choreo_v2';
const DB_VERSION = 1;
const STORE = 'choreo';

export const CHOREO_CACHE_PIPELINE_VERSION = MOTION_PIPELINE_VERSION;

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

export function buildFileCacheKey(songId, file) {
  if (!file) return buildChoreoCacheKey(songId, 'default');
  return buildChoreoCacheKey(songId, `file:${file.name}:${file.size}:${file.lastModified}`);
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
      pipelineVersion: entry.pipelineVersion || CHOREO_CACHE_PIPELINE_VERSION,
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

/** 캐시 유효성 — 파이프라인 버전·프레임 메타데이터·Holistic(손/얼굴) 확인 */
export function isChoreoCacheValid(entry) {
  if (!entry?.frames?.length) return false;
  if (entry.pipelineVersion && entry.pipelineVersion !== CHOREO_CACHE_PIPELINE_VERSION) return false;
  const sample = entry.frames[Math.floor(entry.frames.length / 2)];
  const member = sample?.members?.[0];
  return (
    sample?.frameIndex != null
    && sample?.beat != null
    && sample?.poseQuality != null
    && sample?.memberTracks != null
    && (member?.leftHand != null || member?.rightHand != null || member?.face != null)
  );
}
