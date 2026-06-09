// @ts-nocheck
const STORAGE_KEY = 'onnode_group_studio_v1';

function load() {
  if (typeof window === 'undefined') return { favorites: [], favoriteMembers: [], recent: [], stats: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { favorites: [], favoriteMembers: [], recent: [], stats: {} };
  } catch {
    return { favorites: [], favoriteMembers: [], recent: [], stats: {} };
  }
}

function save(data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('onnode-group-studio-update'));
  } catch {
    /* ignore */
  }
}

export function getStudioData() {
  const d = load();
  return {
    favorites: d.favorites || [],
    favoriteMembers: d.favoriteMembers || [],
    recent: d.recent || [],
    stats: d.stats || {},
  };
}

export function toggleSongFavorite(songId) {
  const d = load();
  const set = new Set(d.favorites || []);
  if (set.has(songId)) set.delete(songId);
  else set.add(songId);
  d.favorites = [...set];
  save(d);
  return d.favorites;
}

export function isSongFavorite(songId) {
  return (load().favorites || []).includes(songId);
}

export function toggleMemberFavorite(groupId, memberId) {
  const d = load();
  const key = `${groupId}:${memberId}`;
  const set = new Set(d.favoriteMembers || []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  d.favoriteMembers = [...set];
  save(d);
  return d.favoriteMembers;
}

export function isMemberFavorite(groupId, memberId) {
  return (load().favoriteMembers || []).includes(`${groupId}:${memberId}`);
}

export function addRecentSong(songId) {
  const d = load();
  const prev = (d.recent || []).filter((id) => id !== songId);
  d.recent = [songId, ...prev].slice(0, 20);
  save(d);
}

export function recordPracticeSession(songId, result) {
  const d = load();
  if (!d.stats) d.stats = {};
  if (!d.stats[songId]) {
    d.stats[songId] = { count: 0, completions: 0, retries: 0, lastPracticed: 0, scores: [] };
  }
  const s = d.stats[songId];
  s.count += 1;
  s.lastPracticed = Date.now();
  if (result?.completed) s.completions += 1;
  if (result?.isRetry) s.retries += 1;
  if (typeof result?.overall === 'number') {
    s.scores = [...(s.scores || []), result.overall].slice(-30);
  }
  save(d);
  addRecentSong(songId);
}

export function getSongPracticeCount(songId) {
  return load().stats?.[songId]?.count || 0;
}

export function getTrendingSongIds(songs, limit = 8) {
  const d = load();
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const scored = songs.map((song) => {
    const stat = d.stats?.[song.id];
    let score = song.baseTrending || 50;

    if (stat) {
      const recent = stat.lastPracticed && now - stat.lastPracticed < weekMs;
      if (recent) score += stat.count * 3;
      const avgScore = stat.scores?.length
        ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
        : 0;
      const completionRate = stat.count > 0 ? stat.completions / stat.count : 0;
      const retryRate = stat.count > 1 ? stat.retries / stat.count : 0;
      score += completionRate * 15 + retryRate * 8 + avgScore * 0.1;
    }

    return { id: song.id, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.id);
}
