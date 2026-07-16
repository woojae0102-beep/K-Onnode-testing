// @ts-nocheck
/**
 * Admin — Pre-built 콘텐츠 저장 + static JSON export
 */
import type { DanceDatabase } from '../../types/danceDatabase';
import type { GroupMotionContent } from '../../types/groupMotionContent';
import type { ChoreographyDataset } from '../../types/groupChoreography';
import { saveDanceDatabase, buildDancePackageKey } from '../dance/DanceDatabaseService';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import type { GroupContentPersistResult } from '../../types/groupContentAdmin';
import { clearGroupMotionContentCache } from '../group/GroupMotionContentLoader';

export function danceDatabaseToChoreographyDataset(db: DanceDatabase): ChoreographyDataset {
  const group = GROUP_DATA[db.groupId];
  const song = getSongById(db.songId);
  const members = (group?.members || []).map((m) => ({
    memberId: m.id,
    displayName: m.name,
    displayNameKr: m.nameKr,
    persona: {
      styleId: m.id,
      energy: 0.85,
      sharpness: 0.85,
      groove: 0.8,
      accentColor: m.color || '#FF1F8E',
      lineScale: 1,
    },
    formationAnchor: {
      x: m.defaultX ?? 0.5,
      y: m.defaultY ?? 0.5,
      z: 0,
    },
  }));

  return {
    meta: {
      groupId: db.groupId,
      songId: db.songId,
      title: song?.title,
      bpm: db.bpm?.bpm,
      durationSec: db.durationSec,
      formation: (db.formation?.defaultFormation as ChoreographyDataset['meta']['formation']) || 'diamond',
      fps: db.sampleFps,
      version: '2',
      preserveVideoFormation: true,
    },
    members,
    frames: db.skeletonFrames.map((frame) => ({
      timestamp: frame.sourceVideoTime ?? frame.timestamp ?? 0,
      members: (frame.members || []).map((m) => ({
        memberId: m.estimatedMemberId,
        joints: Object.fromEntries(
          Object.entries(m.joints || {}).map(([name, j]) => [
            name,
            { x: j.x, y: j.y, z: j.z ?? 0, visibility: j.visibility ?? 1 },
          ]),
        ),
      })),
    })),
  };
}

export function downloadChoreographyJson(
  dataset: ChoreographyDataset,
  filename?: string,
): string {
  const name = filename || `${dataset.meta.groupId}-${dataset.meta.songId}.json`;
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}

export async function persistGroupMotionContent(
  danceDatabase: DanceDatabase,
  content: GroupMotionContent,
): Promise<GroupContentPersistResult> {
  await saveDanceDatabase(danceDatabase);
  clearGroupMotionContentCache();

  const dataset = danceDatabaseToChoreographyDataset(danceDatabase);
  const exportedJsonFilename = downloadChoreographyJson(dataset);

  const packageKey = buildDancePackageKey(
    danceDatabase.groupId,
    danceDatabase.songId,
    danceDatabase.videoId,
  );

  console.info('[GroupContentAdmin] Persisted pre-built content', {
    packageKey,
    members: content.members.map((m) => m.memberId),
    durationSec: content.durationSec,
    source: content.source,
  });

  return {
    packageKey,
    indexedDb: true,
    choreoCache: true,
    exportedJsonFilename,
  };
}
