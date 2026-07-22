// @ts-nocheck
/**
 * Group Mode — 참고 영상 로드 (UI 재생용만, extraction 금지).
 */
import {
  buildReferenceVideoCacheKey,
  getReferenceVideoObjectUrl,
} from '../../../services/referenceVideoStore';

export type ReferenceVideoPlayback = {
  blobCacheKey: string;
  localPlaybackUrl: string;
};

export async function loadReferenceVideoForPractice(
  songId: string,
  videoId?: string | null,
): Promise<ReferenceVideoPlayback | null> {
  const cacheKey = buildReferenceVideoCacheKey(songId, videoId || 'default');
  const url = await getReferenceVideoObjectUrl(cacheKey);
  return url ? { blobCacheKey: cacheKey, localPlaybackUrl: url } : null;
}

export default loadReferenceVideoForPractice;
