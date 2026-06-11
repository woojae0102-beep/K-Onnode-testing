// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

const STORAGE_KEY = 'onnode_album_covers_v1';
const memoryCache = {};

function norm(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function loadStore() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveToStore(songId, url) {
  if (typeof window === 'undefined' || !url) return;
  try {
    const store = loadStore();
    store[songId] = url;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    memoryCache[songId] = url;
  } catch {
    /* ignore */
  }
}

export function getCachedSongCover(songId) {
  if (memoryCache[songId]) return memoryCache[songId];
  const store = loadStore();
  if (store[songId]) {
    memoryCache[songId] = store[songId];
    return store[songId];
  }
  return null;
}

export function getSongCoverCandidates(song) {
  if (!song) return [];
  const cached = getCachedSongCover(song.id);
  const candidates = [
    cached,
    `/album-covers/${song.id}.jpg`,
    `/album-covers/${song.id}.png`,
    song.albumCover,
    ...(song.coverFallbacks || []),
  ].filter(Boolean);
  return [...new Set(candidates)];
}

export async function resolveSongCover(song) {
  if (!song) return null;
  const cached = getCachedSongCover(song.id);
  if (cached) return cached;

  const group = GROUP_DATA[song.groupId];
  const terms = [
    `${group?.name || ''} ${song.title}`,
    `${group?.nameKr || ''} ${song.title}`,
    song.title,
  ].filter(Boolean);

  const songTitle = norm(song.title);

  for (const term of terms) {
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5&country=KR`,
      );
      if (!res.ok) continue;
      const json = await res.json();
      const results = json.results || [];
      const hit = results.find((r) => norm(r.trackName || '').includes(songTitle))
        || results.find((r) => songTitle.includes(norm(r.trackName || '')))
        || results[0];
      if (hit?.artworkUrl100) {
        const url = hit.artworkUrl100.replace(/100x100bb/, '600x600bb');
        saveToStore(song.id, url);
        return url;
      }
    } catch {
      /* try next term */
    }
  }

  return getSongCoverCandidates(song)[0] || null;
}

export function prefetchAllSongCovers(songs) {
  songs.forEach((song) => {
    resolveSongCover(song).catch(() => {});
  });
}
