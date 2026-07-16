// @ts-nocheck
/**
 * Pre-built Group Motion Content Loader — 사용자 런타임 API/추출 호출 없음.
 */
import { loadDanceDatabase } from '../dance/DanceDatabaseService';
import { loadChoreographyDataset } from './ChoreographyDatasetLoader';
import type { GroupMotionContent } from '../../types/groupMotionContent';
import {
  adaptChoreographyDatasetToGroupMotionContent,
  adaptDanceDatabaseToGroupMotionContent,
} from './GroupMotionContentAdapter';
import { getSongVideo } from '../groupStudioStorage';

const memoryCache = new Map<string, GroupMotionContent>();

function cacheKey(groupId: string, songId: string, videoId?: string) {
  return `${groupId}:${songId}:${videoId || 'default'}`;
}

export type LoadGroupMotionContentOptions = {
  groupId: string;
  songId: string;
  videoId?: string | null;
  userMemberId?: string;
  /** true면 demo/bundled fallback 없음 — Production 미준비 시 throw */
  productionOnly?: boolean;
};

export type LoadGroupMotionContentResult = {
  content: GroupMotionContent;
  source: GroupMotionContent['source'];
};

/**
 * 1) IndexedDB DanceDatabase (admin pre-built)
 * 2) /data/choreography/{groupId}-{songId}.json
 * 3) dev fallback: {groupId}-demo.json
 */
export async function loadGroupMotionContent(
  opts: LoadGroupMotionContentOptions,
): Promise<LoadGroupMotionContentResult> {
  const { groupId, songId } = opts;
  const saved = getSongVideo(songId);
  const videoId = opts.videoId ?? saved?.videoId ?? undefined;
  const key = cacheKey(groupId, songId, videoId);

  if (memoryCache.has(key)) {
    return { content: memoryCache.get(key)!, source: memoryCache.get(key)!.source };
  }

  const db = await loadDanceDatabase(groupId, songId, videoId, opts.userMemberId);
  if (db?.skeletonFrames?.length) {
    const content = adaptDanceDatabaseToGroupMotionContent(db, 'indexeddb');
    memoryCache.set(key, content);
    return { content, source: 'indexeddb' };
  }

  try {
    const dataset = await loadChoreographyDataset(groupId, songId);
    const content = adaptChoreographyDatasetToGroupMotionContent(dataset, 'static_json');
    memoryCache.set(key, content);
    return { content, source: 'static_json' };
  } catch {
    // song-specific JSON missing
  }

  if (opts.productionOnly) {
    throw new Error(
      '이 곡은 아직 Production Dance Data가 준비되지 않았습니다. '
      + 'Admin Production Dance Studio에서 콘텐츠를 제작해 주세요.',
    );
  }

  if (songId !== 'demo') {
    try {
      const demo = await loadChoreographyDataset(groupId, 'demo');
      const content = adaptChoreographyDatasetToGroupMotionContent(demo, 'bundled');
      content.songId = songId;
      content.id = `${groupId}/${songId}`;
      memoryCache.set(key, content);
      console.info(`[GroupMotionContentLoader] Using bundled demo content for ${groupId}/${songId}`);
      return { content, source: 'bundled' };
    } catch {
      // no demo
    }
  }

  throw new Error(
    `Pre-built motion content not found for ${groupId}/${songId}. `
    + 'Admin에서 콘텐츠를 먼저 제작·저장해 주세요.',
  );
}

export function clearGroupMotionContentCache(): void {
  memoryCache.clear();
}
