// @ts-nocheck
import { getSongById, STUDIO_SONGS } from '../data/groupStudioSongs';
import { registerDynamicSong } from '../services/dynamicStudioSongs';
import { saveSongVideo } from '../services/groupStudioStorage';
import { matchStudioSong } from './matchStudioSong';
import { inferGroupId } from './inferGroupId';

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

export function ensurePracticeSong(source) {
  if (!source) return null;

  if (typeof source === 'string') {
    const existing = getSongById(source);
    return existing ? existing.id : null;
  }

  if (source.id && getSongById(source.id)) {
    return source.id;
  }

  const matched = source.song || matchStudioSong(source);
  if (matched?.id) {
    const videoId = source.videoId || extractVideoId(source.youtubeUrl);
    if (videoId) {
      saveSongVideo(matched.id, {
        videoId,
        youtubeUrl: source.youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`,
        title: source.title || matched.title,
      });
    }
    return matched.id;
  }

  const groupId = inferGroupId(source.artist, source.channel, source.title);
  if (!groupId) return null;

  const title = cleanTitle(source.title);
  const videoId = source.videoId || extractVideoId(source.youtubeUrl);
  const song = registerDynamicSong({
    title,
    groupId,
    artist: source.artist || source.channel,
    albumCover: source.thumbnail || source.albumArt || source.albumCover,
    thumbnail: source.thumbnail,
    youtubeUrl: source.youtubeUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
    videoId,
    searchTags: [title, source.artist, source.channel, groupId].filter(Boolean),
  });

  if (videoId) {
    saveSongVideo(song.id, {
      videoId,
      youtubeUrl: song.youtubeUrl,
      title: source.title || title,
    });
  }

  return song.id;
}

export default ensurePracticeSong;
