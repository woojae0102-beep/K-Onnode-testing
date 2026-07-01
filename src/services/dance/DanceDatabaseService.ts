// @ts-nocheck
import type { SkeletonFrameData } from '../../types/groupPractice';
import type { AnalysisResult } from '../videoAnalysisTypes';
import type {
  DanceDatabase,
  DanceBpmMeta,
  FormationHole,
  MemberTrackMeta,
  PositionMap,
} from '../../types/danceDatabase';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import { buildSkeletonFramesFromAnalysis } from '../videoAnalysisUtils';
import { identifyUserTrackId } from '../formationMatching';
import { buildFormationTimeline } from './FormationTimelineBuilder';
import { smoothSkeletonFrames } from '../motion/JointKalmanFilter';
import { saveCachedChoreo, buildChoreoCacheKey, getCachedChoreo } from '../groupChoreoCache';
import {
  normalizeTrackMemberMap,
  normalizePositionMap,
  normalizeSkeletonFrames,
  validateSkeletonForPractice,
} from '../../utils/skeletonDataUtils';

const DB_NAME = 'onnode_dance_data_v2';
const DB_VERSION = 1;
const STORE = 'dancePackages';

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'packageKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function buildDancePackageKey(groupId: string, songId: string, videoId?: string) {
  return `${groupId}/${songId}/${videoId || 'default'}`;
}

function buildPositionMap(
  userMemberId: string,
  trackToMember: Map<number, string> | Record<string | number, string>,
  groupId: string,
): PositionMap {
  const map = normalizeTrackMemberMap(trackToMember);
  const group = GROUP_DATA[groupId];
  const trackToMemberObj: Record<number, string> = {};
  const memberToTrackObj: Record<string, number> = {};
  map.forEach((memberId, trackId) => {
    if (memberId === userMemberId) return;
    trackToMemberObj[trackId] = memberId;
    memberToTrackObj[memberId] = trackId;
  });
  const aiMemberIds = (group?.members || [])
    .filter((m) => m.id !== userMemberId)
    .map((m) => m.id)
    .filter((id) => memberToTrackObj[id]);

  return {
    userMemberId,
    aiMemberIds,
    trackToMember: trackToMemberObj,
    memberToTrack: memberToTrackObj,
  };
}

function buildFormationHole(
  userMemberId: string,
  groupId: string,
  analysisResult?: AnalysisResult,
): FormationHole {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === userMemberId);
  let anchor = { x: member?.defaultX ?? 0.5, y: member?.defaultY ?? 0.5, z: 0 };

  if (analysisResult?.trackIdToInitialPosition) {
    const positions = normalizePositionMap(analysisResult.trackIdToInitialPosition as any);
    const userTrackId = identifyUserTrackId(groupId, userMemberId, positions);
    const videoPos = userTrackId != null ? positions.get(userTrackId) : null;
    if (videoPos) {
      anchor = { x: videoPos.x, y: videoPos.y, z: 0 };
    }
  }

  return {
    memberId: userMemberId,
    anchor,
    label: member?.nameKr || 'YOU',
    color: member?.color || '#FF1F8E',
  };
}

function buildMemberTracks(
  analysisResult: AnalysisResult,
  trackToMember: Map<number, string> | Record<string | number, string>,
): MemberTrackMeta[] {
  const map = normalizeTrackMemberMap(trackToMember);
  const confidenceSum = new Map<number, { sum: number; count: number }>();
  analysisResult.frames.forEach((frame) => {
    frame.detectedPeople.forEach((p) => {
      const tid = Number(p.trackId);
      const cur = confidenceSum.get(tid) || { sum: 0, count: 0 };
      confidenceSum.set(tid, { sum: cur.sum + p.confidence, count: cur.count + 1 });
    });
  });

  return Array.from(normalizePositionMap(analysisResult.trackIdToInitialPosition as any).entries()).map(
    ([trackId, pos]) => {
      const stats = confidenceSum.get(trackId);
      return {
        trackId,
        memberId: map.get(trackId) || null,
        initialPosition: pos,
        avgConfidence: stats ? stats.sum / stats.count : 0,
      };
    },
  );
}

function resolveBpm(songId: string): DanceBpmMeta {
  const song = getSongById(songId);
  if (song?.bpm) return { bpm: song.bpm, estimated: false, source: 'song' };
  return { bpm: 120, estimated: true, source: 'default' };
}

export function buildDanceDatabase({
  groupId,
  songId,
  userMemberId,
  analysisResult,
  trackToMember,
  videoId,
  sampleFps = 15,
}: {
  groupId: string;
  songId: string;
  userMemberId: string;
  analysisResult: AnalysisResult;
  trackToMember: Map<number, string> | Record<string | number, string>;
  videoId?: string;
  sampleFps?: number;
}): DanceDatabase {
  const normalizedMap = normalizeTrackMemberMap(trackToMember);

  const skeletonFrames = normalizeSkeletonFrames(
    smoothSkeletonFrames(
      buildSkeletonFramesFromAnalysis(analysisResult, normalizedMap, userMemberId),
    ),
  );

  const validation = validateSkeletonForPractice(skeletonFrames, userMemberId);
  if (!validation.valid) {
    throw new Error(validation.reason || '스켈레톤 데이터가 유효하지 않습니다.');
  }

  const aiMemberCount = (GROUP_DATA[groupId]?.members.length || 1) - 1;
  const mappedAiCount = new Set(
    [...normalizedMap.values()].filter((id) => id && id !== userMemberId),
  ).size;
  if (mappedAiCount < aiMemberCount) {
    console.warn(
      `[DanceDatabase] AI 멤버 매칭 ${mappedAiCount}/${aiMemberCount} — 일부 멤버 스켈레톤이 누락될 수 있습니다.`,
    );
  }

  if (import.meta.env?.DEV) {
    console.debug(
      `[DanceDatabase] 저장: ${skeletonFrames.length}프레임, AI ${validation.aiMemberCount}명 (${validation.aiMemberIds.join(', ')})`,
    );
  }

  const positionMap = buildPositionMap(userMemberId, normalizedMap, groupId);
  const formation = buildFormationTimeline({
    groupId,
    songId,
    userMemberId,
    frames: analysisResult.frames,
    trackToMember: normalizedMap,
  });

  const skeletonEnd =
    skeletonFrames[skeletonFrames.length - 1]?.timestamp ||
    analysisResult.frames[analysisResult.frames.length - 1]?.timestamp ||
    0;
  const sourceVideoDurationSec =
    analysisResult.sourceVideoDurationSec || skeletonEnd || 0;

  return {
    version: '2.0',
    groupId,
    songId,
    videoId,
    detectedMemberCount: analysisResult.detectedMemberCount,
    durationSec: Math.max(sourceVideoDurationSec, skeletonEnd),
    sourceVideoDurationSec,
    skeletonCoverageSec: skeletonEnd,
    sampleFps,
    bpm: resolveBpm(songId),
    skeletonFrames,
    memberTracks: buildMemberTracks(analysisResult, normalizedMap),
    formation,
    positionMap,
    formationHole: buildFormationHole(userMemberId, groupId, analysisResult),
    savedAt: new Date().toISOString(),
  };
}

export async function saveDanceDatabase(danceDb: DanceDatabase) {
  const packageKey = buildDancePackageKey(danceDb.groupId, danceDb.songId, danceDb.videoId);
  const db = await openDb();
  if (db) {
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...danceDb, packageKey });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  const cacheKey = buildChoreoCacheKey(danceDb.songId, danceDb.videoId || 'default');
  await saveCachedChoreo({
    cacheKey,
    songId: danceDb.songId,
    videoId: danceDb.videoId || 'default',
    groupId: danceDb.groupId,
    frames: danceDb.skeletonFrames,
    frameCount: danceDb.skeletonFrames.length,
    durationSec: danceDb.durationSec,
    danceDatabaseVersion: '2.0',
    positionMap: danceDb.positionMap,
    formationHole: danceDb.formationHole,
  });

  return packageKey;
}

export async function loadDanceDatabase(
  groupId: string,
  songId: string,
  videoId?: string,
  userMemberId?: string,
) {
  const packageKey = buildDancePackageKey(groupId, songId, videoId);
  const db = await openDb();
  if (db) {
    const stored = await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(packageKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (stored?.skeletonFrames?.length) {
      const normalized = normalizeSkeletonFrames(stored.skeletonFrames);
      const uid = userMemberId || stored.positionMap?.userMemberId || '';
      const validation = uid ? validateSkeletonForPractice(normalized, uid) : { valid: normalized.length > 0 };
      if (validation.valid) {
        return { ...stored, skeletonFrames: normalized } as DanceDatabase;
      }
      console.warn('[loadDanceDatabase] 저장된 패키지가 유효하지 않음 — 무시합니다.', validation.reason);
    }
  }

  const cacheKey = buildChoreoCacheKey(songId, videoId || 'default');
  const cached = await getCachedChoreo(cacheKey);
  if (cached?.frames?.length) {
    const normalized = normalizeSkeletonFrames(cached.frames);
    const uid = userMemberId || cached.positionMap?.userMemberId || '';
    const validation = uid ? validateSkeletonForPractice(normalized, uid) : { valid: normalized.length > 0 };
    if (!validation.valid) {
      console.warn('[loadDanceDatabase] 캐시가 유효하지 않음 — 무시합니다.', validation.reason);
      return null;
    }
    return {
      version: '2.0',
      groupId,
      songId,
      videoId,
      detectedMemberCount: validation.aiMemberCount || normalized[0]?.members?.length || 0,
      durationSec: cached.durationSec || 0,
      sampleFps: 15,
      bpm: resolveBpm(songId),
      skeletonFrames: normalized,
      memberTracks: [],
      formation: { groupId, songId, userMemberId: uid, defaultFormation: 'diamond', keyframes: [] },
      positionMap: cached.positionMap || { userMemberId: uid, aiMemberIds: [], trackToMember: {}, memberToTrack: {} },
      formationHole: cached.formationHole || { memberId: uid, anchor: { x: 0.5, y: 0.5, z: 0 }, label: 'YOU', color: '#FF1F8E' },
      savedAt: cached.savedAt || '',
    } as DanceDatabase;
  }

  return null;
}
