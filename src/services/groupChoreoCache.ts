// @ts-nocheck
import { MOTION_PIPELINE_VERSION } from './motion/GroupMotionPipeline';
import {
  calculateTimelineCoverage,
  SKELETON_MIN_TIMELINE_COVERAGE,
} from '../utils/skeletonDataUtils';

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
    req.onsuccess = () => {
      const entry = req.result || null;
      if (entry && !isChoreoCacheValid(entry)) {
        console.warn('[ChoreoCache] 불량 캐시 자동 삭제', { cacheKey });
        deleteCachedChoreo(cacheKey);
        resolve(null);
        return;
      }
      resolve(entry);
    };
    req.onerror = () => resolve(null);
  });
}

export async function saveCachedChoreo(entry) {
  const db = await openDb();
  if (!db || !entry?.cacheKey) return false;
  if (entry?.frames?.length) {
    const report = calculateTimelineCoverage(entry.frames, entry.durationSec);
    if (
      report.duration <= 0
      || report.coverage < SKELETON_MIN_TIMELINE_COVERAGE
    ) {
      throw new Error(
        `ChoreoCache 저장 차단: coverage 부족 `
        + `(duration=${Number(report.duration || 0).toFixed(2)}s, `
        + `lastTimestamp=${report.lastTimestamp.toFixed(2)}s, `
        + `coverage=${Math.round(report.coverage * 100)}%)`,
      );
    }
  }
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

function logCacheCoverage(label, entry, cacheValid) {
  const report = calculateTimelineCoverage(entry?.frames, entry?.durationSec);
  console.table({
    [label]: {
      videoDuration: entry?.durationSec ?? 0,
      analysisDuration: entry?.durationSec ?? 0,
      frameCount: report.frameCount,
      firstTimestamp: report.firstTimestamp,
      lastTimestamp: report.lastTimestamp,
      coverage: report.coverage,
      cacheUsed: true,
      cacheValid,
    },
  });
  return report;
}

/** 캐시 유효성 — 파이프라인 버전·프레임 메타데이터·Holistic(손/얼굴)·Timeline Coverage 확인 */
export function isChoreoCacheValid(entry) {
  if (!entry?.frames?.length) return false;
  if (entry.pipelineVersion && entry.pipelineVersion !== CHOREO_CACHE_PIPELINE_VERSION) return false;
  const coverageProbe = calculateTimelineCoverage(entry.frames, entry.durationSec);
  const coverageValid = coverageProbe.duration > 0
    && coverageProbe.coverage >= SKELETON_MIN_TIMELINE_COVERAGE;
  const coverageReport = logCacheCoverage('Choreo Cache Coverage', entry, coverageValid);
  if (!coverageValid) {
    console.warn('[ChoreoCache] coverage 부족 캐시 무효화', {
      cacheKey: entry.cacheKey,
      durationSec: coverageReport.duration,
      firstTimestamp: coverageReport.firstTimestamp,
      lastTimestamp: coverageReport.lastTimestamp,
      coverage: coverageReport.coverage,
    });
    return false;
  }
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

export async function cleanupInvalidChoreoCache() {
  const db = await openDb();
  if (!db) return { checked: 0, deleted: 0 };

  const entries = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  let deleted = 0;
  await Promise.all(
    entries.map(async (entry) => {
      if (isChoreoCacheValid(entry)) return;
      await deleteCachedChoreo(entry.cacheKey);
      deleted += 1;
    }),
  );

  if (deleted > 0) {
    console.info('[ChoreoCache] 불량 캐시 자동 정리 완료', {
      checked: entries.length,
      deleted,
    });
  }

  return { checked: entries.length, deleted };
}
