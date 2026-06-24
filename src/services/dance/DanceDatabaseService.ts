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
import { buildFormationTimeline } from './FormationTimelineBuilder';
import { saveCachedChoreo, buildChoreoCacheKey, getCachedChoreo } from '../groupChoreoCache';

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
  trackToMember: Map<number, string>,
  groupId: string,
): PositionMap {
  const group = GROUP_DATA[groupId];
  const trackToMemberObj: Record<number, string> = {};
  const memberToTrackObj: Record<string, number> = {};
  trackToMember.forEach((memberId, trackId) => {
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

function buildFormationHole(userMemberId: string, groupId: string): FormationHole {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === userMemberId);
  return {
    memberId: userMemberId,
    anchor: { x: member?.defaultX ?? 0.5, y: member?.defaultY ?? 0.5, z: 0 },
    label: member?.nameKr || 'YOU',
    color: member?.color || '#FF1F8E',
  };
}

function buildMemberTracks(
  analysisResult: AnalysisResult,
  trackToMember: Map<number, string>,
): MemberTrackMeta[] {
  const confidenceSum = new Map<number, { sum: number; count: number }>();
  analysisResult.frames.forEach((frame) => {
    frame.detectedPeople.forEach((p) => {
      const cur = confidenceSum.get(p.trackId) || { sum: 0, count: 0 };
      confidenceSum.set(p.trackId, { sum: cur.sum + p.confidence, count: cur.count + 1 });
    });
  });

  return Array.from(analysisResult.trackIdToInitialPosition.entries()).map(([trackId, pos]) => {
    const stats = confidenceSum.get(trackId);
    return {
      trackId,
      memberId: trackToMember.get(trackId) || null,
      initialPosition: pos,
      avgConfidence: stats ? stats.sum / stats.count : 0,
    };
  });
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
  trackToMember: Map<number, string>;
  videoId?: string;
  sampleFps?: number;
}): DanceDatabase {
  const skeletonFrames = buildSkeletonFramesFromAnalysis(
    analysisResult,
    trackToMember,
    userMemberId,
  );
  const positionMap = buildPositionMap(userMemberId, trackToMember, groupId);
  const formation = buildFormationTimeline({
    groupId,
    songId,
    userMemberId,
    frames: analysisResult.frames,
    trackToMember,
  });

  return {
    version: '2.0',
    groupId,
    songId,
    videoId,
    detectedMemberCount: analysisResult.detectedMemberCount,
    durationSec:
      skeletonFrames[skeletonFrames.length - 1]?.timestamp ||
      analysisResult.frames[analysisResult.frames.length - 1]?.timestamp ||
      0,
    sampleFps,
    bpm: resolveBpm(songId),
    skeletonFrames,
    memberTracks: buildMemberTracks(analysisResult, trackToMember),
    formation,
    positionMap,
    formationHole: buildFormationHole(userMemberId, groupId),
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

export async function loadDanceDatabase(groupId: string, songId: string, videoId?: string) {
  const packageKey = buildDancePackageKey(groupId, songId, videoId);
  const db = await openDb();
  if (db) {
    const stored = await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(packageKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (stored?.skeletonFrames?.length) return stored as DanceDatabase;
  }

  const cacheKey = buildChoreoCacheKey(songId, videoId || 'default');
  const cached = await getCachedChoreo(cacheKey);
  if (cached?.frames?.length) {
    return {
      version: '2.0',
      groupId,
      songId,
      videoId,
      detectedMemberCount: cached.frames[0]?.members?.length || 0,
      durationSec: cached.durationSec || 0,
      sampleFps: 15,
      bpm: resolveBpm(songId),
      skeletonFrames: cached.frames as SkeletonFrameData[],
      memberTracks: [],
      formation: { groupId, songId, userMemberId: '', defaultFormation: 'diamond', keyframes: [] },
      positionMap: cached.positionMap || { userMemberId: '', aiMemberIds: [], trackToMember: {}, memberToTrack: {} },
      formationHole: cached.formationHole || { memberId: '', anchor: { x: 0.5, y: 0.5, z: 0 }, label: 'YOU', color: '#FF1F8E' },
      savedAt: cached.savedAt || '',
    } as DanceDatabase;
  }

  return null;
}

export default DanceDatabaseService;
