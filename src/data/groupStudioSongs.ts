// @ts-nocheck
import { GROUP_DATA } from './groupPracticeData';
import { getAllDynamicSongs, getDynamicSong } from '../services/dynamicStudioSongs';

export interface StudioSong {
  id: string;
  title: string;
  groupId: string;
  bpm: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  duration: number;
  albumColor: string;
  albumColor2: string;
  albumCover: string;
  coverFallbacks?: string[];
  baseTrending: number;
  searchTags: string[];
  youtubeQuery?: string;
  youtubeUrl?: string;
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

function song(
  id,
  title,
  groupId,
  bpm,
  difficulty,
  duration,
  albumColor,
  albumColor2,
  albumCover,
  baseTrending,
  extraTags = [],
  youtubeUrl = '',
) {
  const group = GROUP_DATA[groupId];
  return {
    id,
    title,
    groupId,
    bpm,
    difficulty,
    duration,
    albumColor,
    albumColor2,
    albumCover: `/album-covers/${id}.jpg`,
    coverFallbacks: [albumCover].filter(Boolean),
    baseTrending,
    searchTags: tags(groupId, title, extraTags),
    youtubeQuery: `${group?.name || groupId} ${group?.nameKr || ''} ${title} 안무 연습 dance practice`,
    youtubeUrl,
  };
}

export const STUDIO_SONGS: StudioSong[] = [
  song('love-dive', 'LOVE DIVE', 'ive', 118, 3, 174, '#6C5CE7', '#FF6B9D', 'https://upload.wikimedia.org/wikipedia/en/4/4f/Ive_-_Love_Dive.png', 98, ['love dive', '러브다이브']),
  song('after-like', 'After LIKE', 'ive', 125, 3, 178, '#FF6348', '#FFD700', 'https://upload.wikimedia.org/wikipedia/en/9/9e/Ive_-_After_Like.png', 85, ['after like', '애프터라이크']),
  song('i-am', 'I AM', 'ive', 122, 4, 184, '#E91E63', '#9C27B0', 'https://upload.wikimedia.org/wikipedia/en/1/1f/Ive_-_I%27ve_Ive.png', 80, ['i am', '아이엠']),
  song('supernova', 'Supernova', 'aespa', 120, 4, 196, '#00BCD4', '#E91E63', 'https://upload.wikimedia.org/wikipedia/en/8/8a/Aespa_-_Supernova.png', 95, ['슈퍼노바']),
  song('how-you-like-that', 'How You Like That', 'blackpink', 130, 4, 181, '#FF1F8E', '#FFD700', 'https://upload.wikimedia.org/wikipedia/en/0/0c/Blackpink_How_You_Like_That.png', 92, ['how you like that', '하우유라이크댓']),
  song('pink-venom', 'Pink Venom', 'blackpink', 128, 4, 187, '#FF6B9D', '#6C5CE7', 'https://upload.wikimedia.org/wikipedia/en/f/f5/Blackpink_-_Pink_Venom.png', 88, ['pink venom', '핑크베놈']),
  song('shut-down', 'Shut Down', 'blackpink', 132, 5, 176, '#1a1a2e', '#FF1F8E', 'https://upload.wikimedia.org/wikipedia/en/8/8e/Blackpink_-_Born_Pink.png', 82, ['shut down', '셧다운']),
  song('magnetic', 'Magnetic', 'newjeans', 110, 2, 168, '#FF1F8E', '#A78BFA', 'https://upload.wikimedia.org/wikipedia/en/5/5f/NewJeans_-_Get_Up.png', 90, ['magnetic', '마그네틱']),
  song('whiplash', 'Whiplash', 'aespa', 126, 4, 183, '#9C27B0', '#00BCD4', 'https://upload.wikimedia.org/wikipedia/en/2/2d/Aespa_-_Armageddon.png', 87, ['whip lash', '위플래시']),
  song('fancy', 'FANCY', 'twice', 120, 3, 214, '#FF6348', '#FF1F8E', 'https://upload.wikimedia.org/wikipedia/en/4/4f/Twice_-_Fancy_You.png', 75, []),
  song('dynamite', 'Dynamite', 'bts', 114, 2, 199, '#FFD700', '#FF6348', 'https://upload.wikimedia.org/wikipedia/en/4/4b/BTS_-_Dynamite.png', 78, ['다이나마이트']),
  song('wannabe', 'WANNABE', 'itzy', 128, 4, 194, '#FF1F8E', '#FF6348', 'https://upload.wikimedia.org/wikipedia/en/8/8e/Itzy_-_It%27z_Me.png', 72, ['wannabe', '워너비']),
];

export const SONG_MAP = Object.fromEntries(STUDIO_SONGS.map((s) => [s.id, s]));

export function getSongById(id) {
  if (!id) return null;
  return SONG_MAP[id] || getDynamicSong(id) || null;
}

export function getAllStudioSongs() {
  const byId = { ...SONG_MAP };
  getAllDynamicSongs().forEach((s) => { byId[s.id] = s; });
  return Object.values(byId);
}

export function getGroupForSong(songId) {
  const song = getSongById(songId);
  return song ? GROUP_DATA[song.groupId] : null;
}
