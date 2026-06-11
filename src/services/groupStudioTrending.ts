// @ts-nocheck
import { STUDIO_SONGS, getSongById } from '../data/groupStudioSongs';
import { GROUP_DATA } from '../data/groupPracticeData';
import { matchStudioSong } from '../utils/matchStudioSong';
import { ensurePracticeSong } from '../utils/ensurePracticeSong';

const CACHE_KEY = 'onnode_group_weekly_trending_v4';
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
  const matched = raw.song || matchStudioSong(raw);

  if (matched?.id) {
    ensurePracticeSong({
      song: matched,
      title: matched.title,
      artist: raw.artist || raw.channel,
      thumbnail: raw.thumbnail || raw.albumArt,
    });
    return {
      rank,
      songId: matched.id,
      song: matched,
      title: matched.title,
      artist: GROUP_DATA[matched.groupId]?.nameKr || raw.artist || raw.channel,
      thumbnail: matched.albumCover || raw.thumbnail || raw.albumArt || null,
      youtubeUrl: raw.youtubeUrl || null,
      source: raw.source || 'catalog',
    };
  }

  const songId = ensurePracticeSong({
    title: raw.title,
    artist: raw.artist || raw.channel,
    channel: raw.channel,
    thumbnail: raw.thumbnail || raw.albumArt,
  });
  const song = songId ? getSongById(songId) : null;

  if (song) {
    return {
      rank,
      songId: song.id,
      song,
      title: song.title,
      artist: GROUP_DATA[song.groupId]?.nameKr || raw.artist || raw.channel,
      thumbnail: song.albumCover || raw.thumbnail || raw.albumArt || null,
      youtubeUrl: raw.youtubeUrl || null,
      source: raw.source || 'dynamic',
    };
  }

  return {
    rank,
    songId: null,
    song: null,
    title: raw.title,
    artist: raw.artist || raw.channel,
    thumbnail: raw.thumbnail || raw.albumArt || null,
    youtubeUrl: raw.youtubeUrl || null,
    source: raw.source || 'youtube',
  };
}

function fillTrendingToLimit(items, limit = DEFAULT_LIMIT) {
  const result = [];
  const usedSongIds = new Set();

  items.forEach((item) => {
    if (result.length >= limit) return;
    if (item.songId && item.song && !usedSongIds.has(item.songId)) {
      result.push(item);
      usedSongIds.add(item.songId);
    }
  });

  const fillerPool = STUDIO_SONGS
    .slice()
    .sort((a, b) => (b.baseTrending || 0) - (a.baseTrending || 0))
    .filter((s) => !usedSongIds.has(s.id));

  while (result.length < limit && fillerPool.length) {
    const song = fillerPool.shift();
    result.push({
      rank: result.length + 1,
      songId: song.id,
      song,
      title: song.title,
      artist: GROUP_DATA[song.groupId]?.nameKr || song.groupId,
      thumbnail: song.albumCover || null,
      youtubeUrl: null,
      source: 'fallback',
    });
    usedSongIds.add(song.id);
  }

  return result.map((item, i) => ({ ...item, rank: i + 1 }));
}

function buildFallbackTrending(limit = DEFAULT_LIMIT) {
  return fillTrendingToLimit(
    STUDIO_SONGS
      .slice()
      .sort((a, b) => (b.baseTrending || 0) - (a.baseTrending || 0))
      .slice(0, limit)
      .map((song, i) => enrichTrendingItem({ ...song, song, source: 'fallback' }, i + 1)),
    limit,
  );
}

export async function fetchWeeklyTrending(limit = DEFAULT_LIMIT) {
  const weekKey = getWeekKey();
  const cached = loadCache();

  if (cached?.weekKey === weekKey && cached?.items?.length) {
    const items = fillTrendingToLimit(
      cached.items.map((item, i) => enrichTrendingItem(item, item.rank || i + 1)),
      limit,
    );
    return { items, weekKey, lastUpdated: cached.lastUpdated, source: 'cache' };
  }

  try {
    const res = await fetch(`/api/discover?track=songs&limit=${limit}`);
    if (!res.ok) throw new Error('discover failed');
    const json = await res.json();
    const rows = json.data?.songs || [];

    if (rows.length) {
      const enriched = rows
        .slice(0, limit)
        .map((row, i) => enrichTrendingItem(row, row.rank || i + 1));
      const items = fillTrendingToLimit(enriched, limit);
      const entry = { weekKey, items, lastUpdated: json.lastUpdated || new Date().toISOString() };
      saveCache(entry);
      return { ...entry, source: 'youtube' };
    }
  } catch (err) {
    console.warn('[groupStudioTrending]', err);
  }

  const items = buildFallbackTrending(limit);
  const entry = { weekKey, items, lastUpdated: new Date().toISOString() };
  saveCache(entry);
  return { ...entry, source: 'fallback' };
}

export function getWeekKeyLabel() {
  return getWeekKey();
}
