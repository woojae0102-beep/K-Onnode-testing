// @ts-nocheck
const STORAGE_KEY = 'onnode_dynamic_studio_songs_v1';

const memory = {};

function loadAll() {
  if (typeof window === 'undefined') return { ...memory };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...stored, ...memory };
  } catch {
    return { ...memory };
  }
}

function persist(all) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('onnode-dynamic-songs-update'));
  } catch {
    /* ignore */
  }
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\uD79D]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function getDynamicSong(id) {
  return loadAll()[id] || null;
}

export function getAllDynamicSongs() {
  return Object.values(loadAll());
}

export function registerDynamicSong(input) {
  const groupId = input.groupId;
  const title = input.title || 'Unknown';
  const baseKey = slugify(`${groupId}-${title}`);
  const id = input.id?.startsWith('dyn-') ? input.id : `dyn-${baseKey || Date.now()}`;

  const song = {
    id,
    title,
    groupId,
    bpm: input.bpm || 120,
    difficulty: input.difficulty || 3,
    duration: input.duration || 180,
    albumColor: input.albumColor || '#6C5CE7',
    albumColor2: input.albumColor2 || '#FF6B9D',
    albumCover: input.albumCover || input.thumbnail || '',
    coverFallbacks: input.coverFallbacks || [],
    baseTrending: input.baseTrending || 50,
    searchTags: input.searchTags || [title, groupId, input.artist].filter(Boolean),
    youtubeQuery: input.youtubeQuery || `${groupId} ${title} 안무 연습 dance practice`,
    youtubeUrl: '',
    isDynamic: true,
    sourceVideoId: input.videoId || null,
  };

  const all = loadAll();
  all[id] = { ...all[id], ...song, updatedAt: Date.now() };
  memory[id] = all[id];
  persist(all);
  return all[id];
}
