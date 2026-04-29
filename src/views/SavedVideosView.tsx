// @ts-nocheck
import React, { useMemo, useState } from 'react';

const C = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  border: '#F0F0F0',
  textPrimary: '#111111',
  textSecondary: '#666666',
  textTertiary: '#999999',
  accent: '#FF1F8E',
  blue: '#4A6BFF',
  purple: '#8E56FF',
  green: '#1DB971',
};

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'practice', label: '내 연습 영상' },
  { id: 'reference', label: '참고 영상' },
  { id: 'highlight', label: '하이라이트' },
];

// Real YouTube IDs so thumbnails actually load (matches Discover patterns).
const VIDEOS = [
  {
    id: 'sv-1',
    type: 'practice',
    track: 'dance',
    title: 'Hype Boy 안무 연습 #3',
    sub: '5일 전 · 2분 12초 · 점수 78',
    score: 78,
    duration: '2:12',
    savedAt: '2026-04-23',
    thumbVideoId: 'PICoOvEMaTo',
    note: '카운트 5–8 동작이 살짝 늦음. 거울 보고 5분 더 연습 필요.',
  },
  {
    id: 'sv-2',
    type: 'reference',
    track: 'dance',
    title: 'NewJeans Hype Boy Dance Practice (원본)',
    sub: '참고 · NewJeans 공식',
    score: null,
    duration: '3:01',
    savedAt: '2026-04-22',
    thumbVideoId: 'YUVrKcQiqS0',
    note: '후렴 동선 참고용. 0:48–1:05 구간 반복 연습.',
  },
  {
    id: 'sv-3',
    type: 'practice',
    track: 'vocal',
    title: '아이유 - 좋은 날 (1절)',
    sub: '3일 전 · 0:52 · 점수 81',
    score: 81,
    duration: '0:52',
    savedAt: '2026-04-25',
    thumbVideoId: 'phuiiNCxRMg',
    note: '고음 안정성 좋음. 2절 도전해보기.',
  },
  {
    id: 'sv-4',
    type: 'highlight',
    track: 'dance',
    title: '🔥 베스트 5초 클립 — 후렴 시작 동작',
    sub: '하이라이트 · 4월 21일',
    score: 92,
    duration: '0:05',
    savedAt: '2026-04-21',
    thumbVideoId: 'BiAUMzn_RAQ',
    note: 'AI가 자동 추출 — "표현력 92점, 베스트 순간"',
  },
  {
    id: 'sv-5',
    type: 'reference',
    track: 'vocal',
    title: 'aespa Supernova MV',
    sub: '참고 · 곡 분석용',
    score: null,
    duration: '3:21',
    savedAt: '2026-04-20',
    thumbVideoId: 'phuiiNCxRMg',
    note: '도입부 호흡 길이 측정용.',
  },
  {
    id: 'sv-6',
    type: 'practice',
    track: 'korean',
    title: '드라마 따라말하기 — Take 2',
    sub: '오늘 · 5문장 · 평균 84',
    score: 84,
    duration: '1:34',
    savedAt: '2026-04-28',
    thumbVideoId: 'QnBdaeu8VC8',
    note: '받침 발음이 또렷해짐. "처음 뵙겠습니다" 완벽.',
  },
  {
    id: 'sv-7',
    type: 'highlight',
    track: 'vocal',
    title: '🔥 고음 베스트 — "잘 지내" 후렴',
    sub: '하이라이트 · 4월 19일',
    score: 88,
    duration: '0:08',
    savedAt: '2026-04-19',
    thumbVideoId: 'OBFb2YzG2Lk',
    note: '음정 안정 + 음색 ↑',
  },
  {
    id: 'sv-8',
    type: 'reference',
    track: 'dance',
    title: 'STUDIO CHOOM — CORTIS REDRED',
    sub: '참고 · 4K 퍼포먼스',
    score: null,
    duration: '3:14',
    savedAt: '2026-04-18',
    thumbVideoId: 'PiTQH40JjcA',
    note: '카메라 워크 + 동작 강약 참고.',
  },
];

const TRACK_META = {
  dance: { label: '댄스', color: C.accent, icon: '💃' },
  vocal: { label: '보컬', color: C.blue, icon: '🎤' },
  korean: { label: '한국어', color: C.purple, icon: '🇰🇷' },
};

const TYPE_META = {
  practice: { label: '연습', color: C.accent },
  reference: { label: '참고', color: C.blue },
  highlight: { label: '하이라이트', color: '#FF6F00' },
};

export default function SavedVideosView() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return VIDEOS.filter((v) => {
      if (filter !== 'all' && v.type !== filter) return false;
      if (query && !v.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [filter, query]);

  const counts = useMemo(() => {
    return {
      total: VIDEOS.length,
      practice: VIDEOS.filter((v) => v.type === 'practice').length,
      reference: VIDEOS.filter((v) => v.type === 'reference').length,
      highlight: VIDEOS.filter((v) => v.type === 'highlight').length,
    };
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: '100%', padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Header counts={counts} query={query} setQuery={setQuery} />

        <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: 4, marginBottom: 12, width: 'fit-content' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 999,
                background: filter === f.id ? C.accent : 'transparent',
                color: filter === f.id ? '#FFF' : C.textSecondary,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {filtered.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ counts, query, setQuery }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.15em' }}>SAVED VIDEOS</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: C.textPrimary }}>저장한 영상</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textSecondary }}>
            연습 기록 · 참고 영상 · AI가 자동 추출한 하이라이트 클립을 한 곳에
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 검색..."
            style={{
              padding: '8px 12px 8px 30px',
              fontSize: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              background: C.card,
              outline: 'none',
              minWidth: 180,
            }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textTertiary }}>🔍</span>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <CountChip label="전체" value={counts.total} color={C.accent} />
        <CountChip label="연습" value={counts.practice} color={C.accent} />
        <CountChip label="참고" value={counts.reference} color={C.blue} />
        <CountChip label="하이라이트" value={counts.highlight} color="#FF6F00" />
      </div>
    </div>
  );
}

function CountChip({ label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, color: C.textTertiary }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function VideoCard({ video }) {
  const track = TRACK_META[video.track] || TRACK_META.dance;
  const type = TYPE_META[video.type] || TYPE_META.practice;
  const thumbUrl = video.thumbVideoId
    ? `https://i.ytimg.com/vi/${video.thumbVideoId}/mqdefault.jpg`
    : null;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#1B1B1F' }}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={video.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}

        {/* play overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.55)',
              border: '2px solid rgba(255,255,255,0.85)',
              display: 'grid',
              placeItems: 'center',
              color: '#FFF',
              fontSize: 14,
              paddingLeft: 3,
            }}
          >
            ▶
          </div>
        </div>

        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontSize: 10,
            fontWeight: 700,
            background: `${type.color}E6`,
            color: '#FFF',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {type.label}
        </span>
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 10,
            fontWeight: 700,
            background: 'rgba(0,0,0,0.6)',
            color: '#FFF',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {track.icon} {track.label}
        </span>
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontSize: 10,
            fontWeight: 700,
            background: 'rgba(0,0,0,0.6)',
            color: '#FFF',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {video.duration}
        </span>
        {video.score != null ? (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              fontSize: 11,
              fontWeight: 800,
              background: video.score >= 85 ? C.green : video.score >= 70 ? C.accent : C.textSecondary,
              color: '#FFF',
              padding: '3px 9px',
              borderRadius: 999,
            }}
          >
            {video.score}
          </span>
        ) : null}
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: C.textPrimary,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {video.title}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: C.textTertiary }}>{video.sub}</p>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11,
            color: C.textSecondary,
            background: '#FAFAFA',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 8,
            lineHeight: 1.4,
          }}
        >
          💬 {video.note}
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button
            type="button"
            style={{
              flex: 1,
              background: C.accent,
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              padding: '7px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ▶ 재생
          </button>
          <button
            type="button"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '7px 10px',
              fontSize: 11,
              color: C.textSecondary,
              cursor: 'pointer',
            }}
          >
            ⋯
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px dashed ${C.border}`,
        borderRadius: 14,
        padding: 36,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
        {query ? `"${query}"에 해당하는 영상이 없습니다` : '저장한 영상이 없습니다'}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textSecondary }}>
        연습 후 ⭐ 버튼을 누르면 여기에 자동 저장됩니다.
      </p>
    </div>
  );
}
