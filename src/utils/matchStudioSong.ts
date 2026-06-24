// @ts-nocheck
import { STUDIO_SONGS } from '../data/groupStudioSongs';
import { getGroupData } from '../data/groupPracticeData';
import { resolveGroupFromTrendItem } from '../services/groupRegistryService';

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\(\)\[\]'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupNamesFor(song) {
  const group = getGroupData(song.groupId);
  return [group?.name, group?.nameKr, song.groupId].map(norm).filter(Boolean);
}

function scoreSongMatch(song, title, artist, combined, requiredGroupId) {
  if (requiredGroupId && song.groupId !== requiredGroupId) return 0;

  const songTitle = norm(song.title);
  const groupNames = groupNamesFor(song);

  const titleMatch = songTitle.length >= 2
    && (title === songTitle
      || title.includes(songTitle)
      || combined.includes(songTitle)
      || song.searchTags.some((tag) => {
        const t = norm(tag);
        return t.length > 2 && (title.includes(t) || combined.includes(t));
      }));

  if (!titleMatch) return 0;

  const groupMatch = groupNames.some((g) => g.length > 2 && (artist.includes(g) || combined.includes(g)));

  let score = 10;
  if (groupMatch) score += 8;
  if (requiredGroupId && song.groupId === requiredGroupId) score += 6;

  return score;
}

export function matchStudioSong(trendItem, options = {}) {
  const title = norm(trendItem?.title || '');
  const artist = norm(trendItem?.artist || trendItem?.channel || '');
  const combined = `${title} ${artist}`;
  const resolved = resolveGroupFromTrendItem(trendItem);
  const requiredGroupId = options.groupId || resolved.groupId || null;

  if (!requiredGroupId) return null;

  let best = null;
  let bestScore = 0;

  for (const song of STUDIO_SONGS) {
    if (song.groupId !== requiredGroupId) continue;
    const score = scoreSongMatch(song, title, artist, combined, requiredGroupId);
    if (score > bestScore) {
      bestScore = score;
      best = song;
    }
  }

  return bestScore >= 10 ? best : null;
}

export default matchStudioSong;
