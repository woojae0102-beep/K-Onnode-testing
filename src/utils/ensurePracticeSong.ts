// @ts-nocheck
import { getSongById } from '../data/groupStudioSongs';
import { registerDynamicSong } from '../services/dynamicStudioSongs';
import { saveSongVideo } from '../services/groupStudioStorage';
import { matchStudioSong } from './matchStudioSong';
import {
  ensureGroupForTrendItem,
  assertSongGroupMatch,
  extractTitleArtist,
} from '../services/groupRegistryService';
import { isMusicVideoTitle, isDancePracticeTitle } from './dancePracticeVideo';

function cleanTitle(raw) {
  const t = String(raw || '').trim();
  const stripped = t
    .replace(/\(official[^)]*\)/gi, '')
    .replace(/\[official[^\]]*\]/gi, '')
    .replace(/official\s*(mv|music video|audio)/gi, '')
    .replace(/\(mv\)/gi, '')
    .replace(/['"]/g, '');
  const parts = stripped.split(/\s*[-|–]\s*/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim();
    if (last.length >= 2 && last.length <= 60) return last;
  }
  const quoted = stripped.match(/['"]([^'"]+)['"]/);
  if (quoted?.[1]) return quoted[1].trim();
  return stripped.slice(0, 60) || 'K-POP Song';
}

function extractVideoId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:v=|youtu\.be\/|\/embed\/)([\w-]{11})/);
  return m?.[1] || '';
}

function attachPracticeVideo(songId, source) {
  const videoId = source.videoId || extractVideoId(source.youtubeUrl);
  const title = source.title || '';
  const canSaveVideo = videoId
    && !isMusicVideoTitle(title)
    && (isDancePracticeTitle(title) || source.videoType === 'dance_practice');
  if (canSaveVideo) {
    saveSongVideo(songId, {
      videoId,
      youtubeUrl: source.youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`,
      title,
      videoType: 'dance_practice',
    });
  }
}

export function ensurePracticeSong(source) {
  if (!source) return null;

  if (typeof source === 'string') {
    const existing = getSongById(source);
    return existing ? existing.id : null;
  }

  if (source.id && getSongById(source.id)) {
    return source.id;
  }

  const groupId = ensureGroupForTrendItem(source);
  if (!groupId) return null;

  const matched = source.song || matchStudioSong(source, { groupId });

  if (matched?.id && assertSongGroupMatch(matched, source)) {
    attachPracticeVideo(matched.id, source);
    return matched.id;
  }

  const title = cleanTitle(source.title);
  const artistLabel = extractTitleArtist(source.title) || source.artist || source.channel || groupId;
  const song = registerDynamicSong({
    title,
    groupId,
    artist: artistLabel,
    albumCover: source.thumbnail || source.albumArt || source.albumCover,
    thumbnail: source.thumbnail,
    youtubeUrl: source.youtubeUrl || '',
    searchTags: [title, artistLabel, source.channel, groupId].filter(Boolean),
    videoId: source.videoId || extractVideoId(source.youtubeUrl),
  });

  attachPracticeVideo(song.id, source);
  return song.id;
}

export default ensurePracticeSong;
