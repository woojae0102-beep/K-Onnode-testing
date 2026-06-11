// @ts-nocheck
import { STUDIO_SONGS } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\(\)\[\]'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchStudioSong(trendItem) {
  const title = norm(trendItem?.title || '');
  const artist = norm(trendItem?.artist || trendItem?.channel || '');
  const combined = `${title} ${artist}`;

  let best = null;
  let bestScore = 0;

  for (const song of STUDIO_SONGS) {
    const group = GROUP_DATA[song.groupId];
    const songTitle = norm(song.title);
    const groupNames = [group?.name, group?.nameKr, song.groupId].map(norm).filter(Boolean);

    let score = 0;
    if (title.includes(songTitle) || combined.includes(songTitle)) score += 10;
    if (groupNames.some((g) => artist.includes(g) || combined.includes(g))) score += 6;
    if (song.searchTags.some((tag) => {
      const t = norm(tag);
      return t.length > 2 && (title.includes(t) || combined.includes(t));
    })) score += 4;

    if (score > bestScore) {
      bestScore = score;
      best = song;
    }
  }

  return bestScore >= 8 ? best : null;
}

export default matchStudioSong;
