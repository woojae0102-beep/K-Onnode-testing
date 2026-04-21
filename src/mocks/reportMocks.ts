// @ts-nocheck

export const TRACK_LABELS = {
  dance: '댄스',
  vocal: '보컬',
  korean: '한국어',
};

export const TRACK_ICONS = {
  dance: '🕺',
  vocal: '🎤',
  korean: '🇰🇷',
};

export const TRACK_COLORS = {
  dance: '#FF1F8E',
  vocal: '#4A6BFF',
  korean: '#1DB971',
};

export const DETAIL_FIELDS = {
  dance: [
    { key: 'posture', label: '자세 정확도' },
    { key: 'rhythm', label: '리듬 정확도' },
    { key: 'completion', label: '동작 완성도' },
    { key: 'expression', label: '표현력' },
  ],
  vocal: [
    { key: 'pitch', label: '음정 정확도' },
    { key: 'tempo', label: '박자 정확도' },
    { key: 'voice', label: '발성 점수' },
    { key: 'emotion', label: '감정 표현' },
  ],
  korean: [
    { key: 'pronunciation', label: '발음 정확도' },
    { key: 'intonation', label: '억양' },
    { key: 'fluency', label: '유창성' },
    { key: 'vocabulary', label: '어휘 정확도' },
  ],
};

export const MOCK_REPORTS = [
  {
    id: 'r-2025-04-20-dance-1',
    userId: 'user-1',
    track: 'dance',
    date: '2025-04-20',
    contentName: 'NewJeans — Hype Boy 안무',
    overallScore: 82,
    detailScores: { posture: 78, rhythm: 86, completion: 81, expression: 83 },
    aiComment: '팔 동작 개선 필요',
    aiFeedback:
      '전반적으로 리듬 감각이 좋고 박자에 잘 맞춰 움직였어요. 다만 후렴 구간에서 팔 동작이 작게 느껴졌습니다. 거울 앞에서 팔의 궤적을 크게 그리듯 연습하면 표현력이 더 살아날 거예요.',
    timeline: [
      { startTime: '0:00', endTime: '0:15', comment: '인트로 자세 안정', score: 88, kind: 'good' },
      { startTime: '0:16', endTime: '0:35', comment: '리듬 일부 빠름', score: 74, kind: 'warn' },
      { startTime: '0:36', endTime: '0:55', comment: '후렴 팔 동작 작음', score: 70, kind: 'bad' },
      { startTime: '0:56', endTime: '1:20', comment: '브릿지 안정적', score: 86, kind: 'good' },
    ],
    recommendedRoutine: [
      { day: 1, track: 'dance', activity: '팔 동작 집중 연습', duration: 10 },
      { day: 2, track: 'dance', activity: '거울 보고 후렴 반복', duration: 12 },
      { day: 3, track: 'vocal', activity: '호흡 트레이닝', duration: 8 },
    ],
    recommendedContent: [
      { id: 'c-1', title: 'Hype Boy 1절 풀버전', track: 'dance', thumbnailColor: '#FFE5F1' },
      { id: 'c-2', title: '팔 동작 기초 드릴', track: 'dance', thumbnailColor: '#FFD1E6' },
      { id: 'c-3', title: '리듬 트레이닝 베이직', track: 'dance', thumbnailColor: '#FFF0F7' },
    ],
    createdAt: '2025-04-20T18:42:00.000Z',
  },
  {
    id: 'r-2025-04-20-vocal-1',
    userId: 'user-1',
    track: 'vocal',
    date: '2025-04-20',
    contentName: 'IU — 밤편지',
    overallScore: 76,
    detailScores: { pitch: 80, tempo: 74, voice: 72, emotion: 78 },
    aiComment: '저음에서 호흡이 흔들립니다',
    aiFeedback:
      '음정은 전반적으로 안정적이지만, 1절 도입부 저음 구간에서 호흡이 흔들리는 모습이 보였어요. 복식 호흡을 좀 더 의식하면서 천천히 첫 소절을 부르는 연습을 권장합니다.',
    timeline: [
      { startTime: '0:00', endTime: '0:20', comment: '도입부 호흡 흔들림', score: 70, kind: 'bad' },
      { startTime: '0:21', endTime: '0:50', comment: '1절 안정', score: 82, kind: 'good' },
      { startTime: '0:51', endTime: '1:20', comment: '후렴 음정 정확', score: 84, kind: 'good' },
    ],
    recommendedRoutine: [
      { day: 1, track: 'vocal', activity: '복식 호흡 5분 트레이닝', duration: 5 },
      { day: 2, track: 'vocal', activity: '저음 음정 반복', duration: 10 },
      { day: 3, track: 'vocal', activity: '밤편지 1절 완창', duration: 12 },
    ],
    recommendedContent: [
      { id: 'c-4', title: '밤편지 라이브 커버', track: 'vocal', thumbnailColor: '#E5ECFF' },
      { id: 'c-5', title: '저음 안정화 가이드', track: 'vocal', thumbnailColor: '#D6E0FF' },
      { id: 'c-6', title: '발성 워밍업 루틴', track: 'vocal', thumbnailColor: '#F0F4FF' },
    ],
    createdAt: '2025-04-20T20:12:00.000Z',
  },
  {
    id: 'r-2025-04-19-korean-1',
    userId: 'user-1',
    track: 'korean',
    date: '2025-04-19',
    contentName: '발음 교정 — 받침 ㄹ/ㅎ',
    overallScore: 88,
    detailScores: { pronunciation: 92, intonation: 84, fluency: 86, vocabulary: 90 },
    aiComment: '받침 발음이 매우 좋아졌어요',
    aiFeedback:
      '받침 ㄹ과 ㅎ 발음의 정확도가 크게 향상되었습니다. 다음 단계로 문장 사이 억양을 좀 더 자연스럽게 연결하는 연습을 추천합니다.',
    timeline: [
      { startTime: '0:00', endTime: '0:15', comment: '단어 발음 정확', score: 92, kind: 'good' },
      { startTime: '0:16', endTime: '0:35', comment: '문장 억양 살짝 단조', score: 80, kind: 'warn' },
      { startTime: '0:36', endTime: '1:00', comment: '회화 흐름 자연스러움', score: 88, kind: 'good' },
    ],
    recommendedRoutine: [
      { day: 1, track: 'korean', activity: '문장 억양 따라 말하기', duration: 8 },
      { day: 2, track: 'korean', activity: '받침 ㄹ 단어 20개 연습', duration: 10 },
      { day: 3, track: 'korean', activity: 'K-POP 가사 회화 5문장', duration: 12 },
    ],
    recommendedContent: [
      { id: 'c-7', title: '받침 ㄹ 발음 드릴', track: 'korean', thumbnailColor: '#DCF5E5' },
      { id: 'c-8', title: '자연스러운 억양 패턴', track: 'korean', thumbnailColor: '#E8FAEF' },
      { id: 'c-9', title: 'K-POP 회화 100문장', track: 'korean', thumbnailColor: '#F0FBF5' },
    ],
    createdAt: '2025-04-19T11:05:00.000Z',
  },
  {
    id: 'r-2025-04-18-dance-1',
    userId: 'user-1',
    track: 'dance',
    date: '2025-04-18',
    contentName: 'LE SSERAFIM — Easy 안무',
    overallScore: 71,
    detailScores: { posture: 68, rhythm: 74, completion: 70, expression: 72 },
    aiComment: '리듬 시작점을 더 빠르게',
    aiFeedback:
      '전반적으로 동작은 잘 따라가지만 박자의 시작점이 반 박자 정도 늦는 패턴이 반복되고 있어요. 메트로놈을 들으며 다운비트에 맞춰 시작하는 연습을 권장합니다.',
    timeline: [
      { startTime: '0:00', endTime: '0:20', comment: '시작점 늦음', score: 66, kind: 'bad' },
      { startTime: '0:21', endTime: '0:50', comment: '중반 안정', score: 76, kind: 'good' },
    ],
    recommendedRoutine: [
      { day: 1, track: 'dance', activity: '메트로놈 박자 연습', duration: 8 },
      { day: 2, track: 'dance', activity: 'Easy 1절 반복', duration: 15 },
    ],
    recommendedContent: [
      { id: 'c-10', title: 'Easy 안무 클립', track: 'dance', thumbnailColor: '#FFE5F1' },
      { id: 'c-11', title: '박자 트레이닝', track: 'dance', thumbnailColor: '#FFD1E6' },
    ],
    createdAt: '2025-04-18T09:32:00.000Z',
  },
];

export function fetchMockReports({ track = 'all', limit = 10, offset = 0 } = {}) {
  const filtered = MOCK_REPORTS.filter((r) => (track === 'all' ? true : r.track === track));
  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    items: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

export function fetchMockReportById(id) {
  return MOCK_REPORTS.find((r) => r.id === id) || null;
}

export function formatReportDateLabel(dateStr, locale = 'ko') {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (locale?.startsWith('ko')) return `${y}년 ${m}월 ${d}일`;
  if (locale?.startsWith('ja')) return `${y}年${m}月${d}日`;
  if (locale?.startsWith('zh')) return `${y}年${m}月${d}日`;
  try {
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
}

export function formatReportDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

export function groupReportsByDate(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date).push(item);
  });
  return Array.from(groups.entries()).map(([date, list]) => ({ date, items: list }));
}
