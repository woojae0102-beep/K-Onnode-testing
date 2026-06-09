// @ts-nocheck
import { GROUP_DATA } from './groupPracticeData';

export interface StudioSong {
  id: string;
  title: string;
  groupId: string;
  bpm: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  duration: number;
  albumColor: string;
  albumColor2: string;
  baseTrending: number;
  searchTags: string[];
}

function tags(groupId, title, extra = []) {
  const group = GROUP_DATA[groupId];
  const memberTags = (group?.members || []).flatMap((m) => [m.name, m.nameKr, m.id]);
  return [
    title,
    title.toLowerCase(),
    group?.name,
    group?.nameKr,
    groupId,
    ...memberTags,
    ...extra,
  ].filter(Boolean);
}

export const STUDIO_SONGS: StudioSong[] = [
  { id: 'love-dive', title: 'LOVE DIVE', groupId: 'ive', bpm: 118, difficulty: 3, duration: 30, albumColor: '#6C5CE7', albumColor2: '#FF6B9D', baseTrending: 98, searchTags: tags('ive', 'LOVE DIVE', ['love dive', '러브다이브']) },
  { id: 'after-like', title: 'After LIKE', groupId: 'ive', bpm: 125, difficulty: 3, duration: 30, albumColor: '#FF6348', albumColor2: '#FFD700', baseTrending: 85, searchTags: tags('ive', 'After LIKE', ['after like', '애프터라이크']) },
  { id: 'i-am', title: 'I AM', groupId: 'ive', bpm: 122, difficulty: 4, duration: 30, albumColor: '#E91E63', albumColor2: '#9C27B0', baseTrending: 80, searchTags: tags('ive', 'I AM', ['i am', '아이엠']) },
  { id: 'supernova', title: 'Supernova', groupId: 'aespa', bpm: 120, difficulty: 4, duration: 30, albumColor: '#00BCD4', albumColor2: '#E91E63', baseTrending: 95, searchTags: tags('aespa', 'Supernova', ['슈퍼노바']) },
  { id: 'how-you-like-that', title: 'How You Like That', groupId: 'blackpink', bpm: 130, difficulty: 4, duration: 30, albumColor: '#FF1F8E', albumColor2: '#FFD700', baseTrending: 92, searchTags: tags('blackpink', 'How You Like That', ['how you like that', '하우유라이크댓']) },
  { id: 'pink-venom', title: 'Pink Venom', groupId: 'blackpink', bpm: 128, difficulty: 4, duration: 30, albumColor: '#FF6B9D', albumColor2: '#6C5CE7', baseTrending: 88, searchTags: tags('blackpink', 'Pink Venom', ['pink venom', '핑크베놈']) },
  { id: 'shut-down', title: 'Shut Down', groupId: 'blackpink', bpm: 132, difficulty: 5, duration: 30, albumColor: '#1a1a2e', albumColor2: '#FF1F8E', baseTrending: 82, searchTags: tags('blackpink', 'Shut Down', ['shut down', '셧다운']) },
  { id: 'magnetic', title: 'Magnetic', groupId: 'newjeans', bpm: 110, difficulty: 2, duration: 30, albumColor: '#FF1F8E', albumColor2: '#A78BFA', baseTrending: 90, searchTags: tags('newjeans', 'Magnetic', ['magnetic', '마그네틱']) },
  { id: 'whiplash', title: 'Whiplash', groupId: 'aespa', bpm: 126, difficulty: 4, duration: 30, albumColor: '#9C27B0', albumColor2: '#00BCD4', baseTrending: 87, searchTags: tags('aespa', 'Whiplash', ['whip lash', '위플래시']) },
  { id: 'fancy', title: 'FANCY', groupId: 'twice', bpm: 120, difficulty: 3, duration: 30, albumColor: '#FF6348', albumColor2: '#FF1F8E', baseTrending: 75, searchTags: tags('twice', 'FANCY') },
  { id: 'dynamite', title: 'Dynamite', groupId: 'bts', bpm: 114, difficulty: 2, duration: 30, albumColor: '#FFD700', albumColor2: '#FF6348', baseTrending: 78, searchTags: tags('bts', 'Dynamite', ['다이나마이트']) },
  { id: 'wannabe', title: 'WANNABE', groupId: 'itzy', bpm: 128, difficulty: 4, duration: 30, albumColor: '#FF1F8E', albumColor2: '#FF6348', baseTrending: 72, searchTags: tags('itzy', 'WANNABE', ['wannabe', '워너비']) },
];

export const SONG_MAP = Object.fromEntries(STUDIO_SONGS.map((s) => [s.id, s]));

export function getSongById(id) {
  return SONG_MAP[id] || null;
}

export function getGroupForSong(songId) {
  const song = getSongById(songId);
  return song ? GROUP_DATA[song.groupId] : null;
}
