// @ts-nocheck
import { STUDIO_SONGS } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';
import { matchStudioSong } from '../utils/matchStudioSong';
import { ensurePracticeSong } from '../utils/ensurePracticeSong';
import { getSongById } from '../data/groupStudioSongs';

const CACHE_KEY = 'onnode_group_weekly_trending_v3';
const DEFAULT_LIMIT = 10;

function getWeekKey() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function loadCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(entry) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

function enrichTrendingItem(raw, rank) {
  const matched = matchStudioSong(raw);
  const songId = ensurePracticeSong({
    song: matched,
    rank,
    title: matched?.title || raw.title,
    artist: raw.artist || raw.channel,
    thumbnail: raw.thumbnail || raw.albumArt,
  });
  const song = songId ? getSongById(songId) : null;
  return {
    rank: raw.rank || rank,
    songId,
    song,
    title: song?.title || raw.title,
    artist: song ? (GROUP_DATA[song.groupId]?.nameKr || raw.artist) : (raw.artist || raw.channel),
    thumbnail: song?.albumCover || raw.thumbnail || raw.albumArt || null,
    youtubeUrl: raw.youtubeUrl,
    source: raw.source || 'youtube',
  };
}

function fallbackTrending(limit = DEFAULT_LIMIT) {
  return STUDIO_SONGS
    .slice()
    .sort((a, b) => (b.baseTrending || 0) - (a.baseTrending || 0))
    .slice(0, limit)
    .map((song, i) => enrichTrendingItem({ ...song, song, source: 'fallback' }, i + 1));
}

export async function fetchWeeklyTrending(limit = DEFAULT_LIMIT) {
  const weekKey = getWeekKey();
  const cached = loadCache();
  if (cached?.weekKey === weekKey && cached?.items?.length >= limit) {
    const items = cached.items.slice(0, limit).map((item, i) => enrichTrendingItem(item, item.rank || i + 1));
    return { items, weekKey, lastUpdated: cached.lastUpdated, source: 'cache' };
  }

  try {
    const res = await fetch(`/api/discover?track=songs&limit=${limit}`);
    if (!res.ok) throw new Error('discover failed');
    const json = await res.json();
    const rows = json.data?.songs || [];

    if (rows.length) {
      const items = rows
        .slice(0, limit)
        .map((row, i) => enrichTrendingItem(row, row.rank || i + 1))
        .filter((item) => item.songId && item.song);
      const entry = { weekKey, items, lastUpdated: json.lastUpdated || new Date().toISOString() };
      saveCache(entry);
      return { ...entry, source: 'youtube' };
    }
  } catch (err) {
    console.warn('[groupStudioTrending]', err);
  }

  const items = fallbackTrending(limit);
  const entry = { weekKey, items, lastUpdated: new Date().toISOString() };
  saveCache(entry);
  return { ...entry, source: 'fallback' };
}

export function getWeekKeyLabel() {
  return getWeekKey();
}
