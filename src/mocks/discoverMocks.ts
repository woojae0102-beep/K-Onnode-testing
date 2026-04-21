// @ts-nocheck

const NEXT_SUNDAY = (() => {
  const d = new Date();
  const diff = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
})();

export const MOCK_TRENDING = [
  {
    id: 't1',
    title: 'aespa - Supernova (Dance Practice)',
    artist: 'aespa',
    thumbnail: '#FF1F8E',
    viewCount: 12_400_000,
    likeCount: 412_000,
    youtubeUrl: 'https://www.youtube.com/results?search_query=aespa+supernova',
  },
  {
    id: 't2',
    title: 'NewJeans - Hype Boy MV',
    artist: 'NewJeans',
    thumbnail: '#FF8AB6',
    viewCount: 88_200_000,
    likeCount: 1_220_000,
    youtubeUrl: 'https://www.youtube.com/results?search_query=newjeans+hype+boy',
  },
  {
    id: 't3',
    title: 'IVE - I AM (Stage Cam)',
    artist: 'IVE',
    thumbnail: '#FFB7CC',
    viewCount: 9_800_000,
    likeCount: 220_000,
    youtubeUrl: 'https://www.youtube.com/results?search_query=ive+iam',
  },
];

export const MOCK_DANCE = [
  { id: 'd1', title: 'Hype Boy', artist: 'NewJeans', thumbnail: '#FFE5F1', difficulty: 'normal' },
  { id: 'd2', title: 'Supernova', artist: 'aespa', thumbnail: '#FFD1E6', difficulty: 'hard' },
  { id: 'd3', title: 'Easy', artist: 'LE SSERAFIM', thumbnail: '#FFF0F7', difficulty: 'easy' },
  { id: 'd4', title: 'Magnetic', artist: 'ILLIT', thumbnail: '#FFEBF4', difficulty: 'normal' },
  { id: 'd5', title: 'Fact Check', artist: 'NCT 127', thumbnail: '#FFD9E9', difficulty: 'hard' },
];

export const MOCK_SONGS = [
  { id: 's1', title: '밤편지', artist: 'IU', albumArt: '#E5ECFF', bpm: 78 },
  { id: 's2', title: 'Through the Night', artist: 'IU', albumArt: '#D6E0FF', bpm: 72 },
  { id: 's3', title: 'Spring Day', artist: 'BTS', albumArt: '#F0F4FF', bpm: 80 },
  { id: 's4', title: 'Antifragile', artist: 'LE SSERAFIM', albumArt: '#E0E8FF', bpm: 100 },
  { id: 's5', title: 'OMG', artist: 'NewJeans', albumArt: '#EAF0FF', bpm: 92 },
];

export const MOCK_CHALLENGES = [
  {
    id: 'c1',
    name: '#SuperShyChallenge',
    thumbnail: '#FFE5F1',
    participants: 18420,
    deadline: NEXT_SUNDAY,
  },
  {
    id: 'c2',
    name: '#HypeBoyChallenge',
    thumbnail: '#E5ECFF',
    participants: 32100,
    deadline: NEXT_SUNDAY,
  },
  {
    id: 'c3',
    name: '#MagneticChallenge',
    thumbnail: '#DCF5E5',
    participants: 9740,
    deadline: NEXT_SUNDAY,
  },
];

export const MOCK_KOREAN = [
  { id: 'k1', icon: '🇰🇷', title: '받침 ㄹ/ㅎ 발음', duration: '8분', level: 1 },
  { id: 'k2', icon: '🎵', title: 'K-POP 가사로 배우는 회화 10문장', duration: '15분', level: 2 },
  { id: 'k3', icon: '🗣️', title: '자연스러운 억양 패턴 따라하기', duration: '12분', level: 2 },
  { id: 'k4', icon: '📖', title: '아이돌 인터뷰 듣기 연습', duration: '10분', level: 3 },
];

export const MOCK_LAST_UPDATED = new Date().toISOString();

export function fetchMockDiscover() {
  return {
    trending: MOCK_TRENDING,
    dance: MOCK_DANCE,
    songs: MOCK_SONGS,
    challenges: MOCK_CHALLENGES,
    korean: MOCK_KOREAN,
    lastUpdated: MOCK_LAST_UPDATED,
    source: 'mock',
  };
}
