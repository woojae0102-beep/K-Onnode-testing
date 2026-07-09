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
import { buildFormationTimeline, analyzeFormationTimeline } from './FormationTimelineBuilder';
import {
  MOTION_PIPELINE_VERSION,
  runGroupMotionPipeline,
} from '../motion/GroupMotionPipeline';
import { saveCachedChoreo, buildChoreoCacheKey, getCachedChoreo, CHOREO_CACHE_PIPELINE_VERSION } from '../groupChoreoCache';
import {
  normalizeTrackMemberMap,
  normalizePositionMap,
  normalizeSkeletonFrames,
  validateSkeletonForPractice,
  buildSkeletonData,
  calculateTimelineCoverage,
  SKELETON_MIN_TIMELINE_COVERAGE,
} from '../../utils/skeletonDataUtils';
import { resolvePracticeDurationSec } from '../../utils/buildPracticeSessionData';
import {
  CHOREO_DEFAULT_SAMPLE_FPS,
  normalizeChoreoSampleFps,
} from '../../config/choreoExtractConfig';

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

export async function buildDanceDatabase({
  groupId,
  songId,
  userMemberId,
  analysisResult,
  trackToMember,
  videoId,
  sampleFps,
}: {
  groupId: string;
  songId: string;
  userMemberId: string;
  analysisResult: AnalysisResult;
  trackToMember: Map<number, string> | Record<string | number, string>;
  videoId?: string;
  sampleFps?: number;
}): Promise<DanceDatabase> {
  const normalizedMap = normalizeTrackMemberMap(trackToMember);
  const extractionFps = normalizeChoreoSampleFps(sampleFps ?? analysisResult.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS);

  const rawSkeletonFrames = buildSkeletonFramesFromAnalysis(
    analysisResult,
    normalizedMap,
    userMemberId,
  );

  const allMemberIds = [
    userMemberId,
    ...[...normalizedMap.values()].filter((id) => id && id !== userMemberId),
  ];

  const positionMap = buildPositionMap(userMemberId, normalizedMap, groupId);
  const dbMemberTracks = buildMemberTracks(analysisResult, normalizedMap);

  const sourceVideoDurationSec = resolvePracticeDurationSec(
    analysisResult.sourceVideoDurationSec,
    rawSkeletonFrames,
  );
  if (!sourceVideoDurationSec) {
    throw new Error('영상 길이(sourceVideoDurationSec)가 없습니다. 안무를 다시 추출해 주세요.');
  }

  const bpmMeta = resolveBpm(songId);

  const pipeline = await runGroupMotionPipeline({
    rawFrames: rawSkeletonFrames,
    groupId,
    songId,
    userMemberId,
    allMemberIds,
    videoDurationSec: sourceVideoDurationSec,
    fps: extractionFps,
    bpm: bpmMeta.bpm,
    trackToMember: Object.fromEntries(
      [...normalizedMap.entries()].filter(([, id]) => id !== userMemberId),
    ),
    memberTracks: dbMemberTracks,
    applySmoothing: false,
    preserveExtractionFrames: true,
  });

  const skeletonFrames = pipeline.frames;
  const timeline = pipeline.timeline;
  const validation = pipeline.validation;

  const formation = pipeline.formationTimeline ?? analyzeFormationTimeline({
    groupId,
    songId,
    userMemberId,
    frames: skeletonFrames,
    trackToMember: normalizedMap,
  });

  const motionTimelines = pipeline.motionTimelines
    ? [...pipeline.motionTimelines.values()]
    : [];

  const aiMemberCount = (GROUP_DATA[groupId]?.members.length || 1) - 1;
  const mappedAiCount = new Set(
    [...normalizedMap.values()].filter((id) => id && id !== userMemberId),
  ).size;
  const expectedTotalMemberCount = GROUP_DATA[groupId]?.members.length || analysisResult.detectedMemberCount || 0;
  if (expectedTotalMemberCount > 0 && analysisResult.detectedMemberCount < expectedTotalMemberCount) {
    throw new Error(
      `Motion Database 생성 차단: 추출 멤버 수 부족 `
      + `(${analysisResult.detectedMemberCount}/${expectedTotalMemberCount}). `
      + '전체 멤버가 보이는 영상으로 다시 추출해 주세요.',
    );
  }
  if (mappedAiCount < aiMemberCount) {
    throw new Error(
      `Motion Database 생성 차단: AI 멤버 매칭 부족 `
      + `(${mappedAiCount}/${aiMemberCount}). `
      + '트랙→멤버 매칭을 확인하거나 전체 멤버가 보이는 영상으로 다시 추출해 주세요.',
    );
  }

  if (import.meta.env?.DEV) {
    console.debug(
      `[DanceDatabase] 저장: ${skeletonFrames.length}프레임, AI ${validation.aiMemberCount}명 (${validation.aiMemberIds.join(', ')})`,
    );
  }

  const coverageReport = calculateTimelineCoverage(skeletonFrames, timeline.duration);
  const skeletonEnd = coverageReport.lastTimestamp;

  console.table({
    'DanceDatabase Coverage': {
      videoDuration: timeline.duration,
      analysisDuration: timeline.duration,
      frameCount: coverageReport.frameCount,
      firstTimestamp: coverageReport.firstTimestamp,
      lastTimestamp: coverageReport.lastTimestamp,
      coverage: coverageReport.coverage,
      cacheUsed: false,
      cacheValid: false,
    },
  });

  if (coverageReport.coverage < SKELETON_MIN_TIMELINE_COVERAGE) {
    throw new Error(
      `DanceDatabase 저장 차단: coverage 부족 `
      + `(duration=${timeline.duration.toFixed(2)}s, `
      + `lastTimestamp=${coverageReport.lastTimestamp.toFixed(2)}s, `
      + `coverage=${Math.round(coverageReport.coverage * 100)}%)`,
    );
  }

  const skeletonData = buildSkeletonData(skeletonFrames, extractionFps, timeline.duration);

  return {
    version: '2.0',
    pipelineVersion: MOTION_PIPELINE_VERSION,
    motionPipelineAudit: pipeline.audit,
    groupId,
    songId,
    videoId,
    detectedMemberCount: analysisResult.detectedMemberCount,
    durationSec: timeline.duration,
    sourceVideoDurationSec: timeline.duration,
    skeletonCoverageSec: skeletonEnd,
    sampleFps: extractionFps,
    skeletonData,
    bpm: resolveBpm(songId),
    skeletonFrames,
    memberTracks: pipeline.memberIdentification?.memberTracks ?? dbMemberTracks,
    formation,
    motionTimelines,
    positionMap,
    formationHole: buildFormationHole(userMemberId, groupId, analysisResult),
    savedAt: new Date().toISOString(),
  };
}

export async function saveDanceDatabase(danceDb: DanceDatabase) {
  const coverageReport = calculateTimelineCoverage(danceDb.skeletonFrames, danceDb.durationSec);
  if (coverageReport.coverage < SKELETON_MIN_TIMELINE_COVERAGE) {
    throw new Error(
      `DanceDatabase 저장 차단: coverage 부족 `
      + `(duration=${Number(danceDb.durationSec || 0).toFixed(2)}s, `
      + `lastTimestamp=${coverageReport.lastTimestamp.toFixed(2)}s, `
      + `coverage=${Math.round(coverageReport.coverage * 100)}%)`,
    );
  }

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
    pipelineVersion: danceDb.pipelineVersion || CHOREO_CACHE_PIPELINE_VERSION,
    sampleFps: danceDb.sampleFps,
    skeletonData: danceDb.skeletonData,
    positionMap: danceDb.positionMap,
    formationHole: danceDb.formationHole,
    bpm: danceDb.bpm?.bpm,
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
      const expectedAiMemberCount = Math.max(0, (GROUP_DATA[groupId]?.members.length ?? 1) - 1);
      const validation = uid
        ? validateSkeletonForPractice(normalized, uid, {
          skipNormalize: true,
          expectedDurationSec: stored.durationSec,
          expectedAiMemberCount,
        })
        : { valid: normalized.length > 0 };
      if (validation.valid) {
        return { ...stored, skeletonFrames: normalized } as DanceDatabase;
      }
      console.warn('[loadDanceDatabase] 저장된 패키지가 유효하지 않음 — 무시합니다.', validation.reason);
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(packageKey);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    }
  }

  const cacheKey = buildChoreoCacheKey(songId, videoId || 'default');
  const cached = await getCachedChoreo(cacheKey);
  if (cached?.frames?.length) {
    const normalized = normalizeSkeletonFrames(cached.frames);
    const uid = userMemberId || cached.positionMap?.userMemberId || '';
    const expectedAiMemberCount = Math.max(0, (GROUP_DATA[groupId]?.members.length ?? 1) - 1);
    const validation = uid
      ? validateSkeletonForPractice(normalized, uid, {
        skipNormalize: true,
        expectedDurationSec: cached.durationSec,
        expectedAiMemberCount,
      })
      : { valid: normalized.length > 0 };
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
      sampleFps: cached.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS,
      skeletonData: cached.skeletonData ?? buildSkeletonData(
        normalized,
        cached.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS,
        cached.durationSec || 0,
      ),
      bpm: resolveBpm(songId),
      skeletonFrames: normalized,
      memberTracks: [],
      formation: { groupId, songId, userMemberId: uid, defaultFormation: 'diamond', segments: [], keyframes: [] },
      positionMap: cached.positionMap || { userMemberId: uid, aiMemberIds: [], trackToMember: {}, memberToTrack: {} },
      formationHole: cached.formationHole || { memberId: uid, anchor: { x: 0.5, y: 0.5, z: 0 }, label: 'YOU', color: '#FF1F8E' },
      savedAt: cached.savedAt || '',
    } as DanceDatabase;
  }

  return null;
}
