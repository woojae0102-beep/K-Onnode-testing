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
  warn: '#FF9F43',
  danger: '#E74C3C',
};

const TRACK_META = {
  dance: { label: '댄스', color: C.accent, icon: '💃' },
  vocal: { label: '보컬', color: C.blue, icon: '🎤' },
  korean: { label: '한국어', color: C.purple, icon: '🇰🇷' },
  audition: { label: '오디션', color: C.warn, icon: '🏆' },
};

const FEEDBACK = [
  {
    id: 'fb-1',
    when: 'Today · 14:08',
    track: 'dance',
    title: 'Hype Boy 후렴 구간 분석',
    score: 78,
    delta: '+3',
    summary: '리듬은 안정적이지만 팔 동작 확장이 부족합니다. 어깨가 잠겨있어요.',
    strengths: ['카운트 1–4 정확', '하체 무게중심 좋음', '표정 연결 자연스러움'],
    issues: [
      { label: '팔 확장 부족', severity: 'high' },
      { label: '카운트 6 살짝 늦음', severity: 'mid' },
    ],
    nextSteps: [
      '거울 앞 어깨 워밍업 5분 (오픈 → 클로즈)',
      '0:48–1:05 구간 0.75배속 5회 반복',
    ],
    aiQuote: '"팔 끝까지 뻗는다" 한 가지만 의식해도 점수가 +5점 오를 수 있어요.',
    pinned: true,
  },
  {
    id: 'fb-2',
    when: 'Yesterday · 21:15',
    track: 'vocal',
    title: '아이유 - 좋은 날 (Take 4)',
    score: 81,
    delta: '+5',
    summary: '고음 안정성이 눈에 띄게 좋아졌어요. 호흡 길이가 안정적입니다.',
    strengths: ['고음 음정 정확', '비브라토 자연스러움', '호흡 끊김 없음'],
    issues: [{ label: '도입부 발음이 살짝 흐려짐', severity: 'low' }],
    nextSteps: ['"오랜만이야" 자음 또렷이 — 입을 더 크게', '2절 전체 도전'],
    aiQuote: '🎉 새로운 베스트 점수예요! 같은 페이스로 일주일 더 가보세요.',
  },
  {
    id: 'fb-3',
    when: '2일 전 · 19:42',
    track: 'korean',
    title: '드라마 따라말하기 — 5문장',
    score: 84,
    delta: '+2',
    summary: '받침 발음이 훨씬 또렷해졌어요. 속도 균형이 좋습니다.',
    strengths: ['받침 ㄴ/ㅁ 명확', '문장 간 끊어 읽기 자연스러움'],
    issues: [{ label: '"같이 가도 될까요?" — ㅡ 발음 짧음', severity: 'mid' }],
    nextSteps: ['ㅡ 모음만 5초씩 길게 발음 연습', '드라마 0.5배속으로 한 번 더 듣기'],
    aiQuote: '발음의 70%는 입 모양이에요. 거울 보고 모음 모양을 점검해보세요.',
  },
  {
    id: 'fb-4',
    when: '3일 전 · 11:20',
    track: 'audition',
    title: 'JYP 오디션 시뮬레이션 — 1차',
    score: 76,
    delta: null,
    summary: 'JYP 심사위원 평균 76점. 보컬에서 강세, 인터뷰에서 긴장감이 보였어요.',
    strengths: ['JYP 자연스러움 부합', '보컬 라이브 안정적'],
    issues: [
      { label: '인터뷰 답변 짧음', severity: 'mid' },
      { label: '댄스 표정 굳음', severity: 'mid' },
    ],
    nextSteps: ['자기소개 30초 → 90초로 확장 (2가지 에피소드 추가)', '댄스 시작 직전 호흡 + 미소 세팅 루틴 만들기'],
    aiQuote: '"자기다움"이 JYP가 가장 중요하게 보는 가치예요. 본인 이야기를 더 담아보세요.',
  },
  {
    id: 'fb-5',
    when: '4일 전 · 22:05',
    track: 'dance',
    title: 'NewJeans Super Shy — 첫 시도',
    score: 65,
    delta: '-2',
    summary: '곡 자체가 어렵습니다. 카운트 1–8 동작이 새롭다 보니 박자가 흔들려요.',
    strengths: ['감정 표현 시도 좋음'],
    issues: [
      { label: '박자 0.3초 늦음', severity: 'high' },
      { label: '발 위치 부정확', severity: 'mid' },
    ],
    nextSteps: ['카운트만 따로 메트로놈 90 BPM 5분', '발 위치 표시(테이프) 후 천천히 5회'],
    aiQuote: '새 곡은 처음 점수가 낮아요. 정상적인 학습 곡선이니 3일만 더 해보세요.',
  },
  {
    id: 'fb-6',
    when: '6일 전 · 18:00',
    track: 'vocal',
    title: '발성 워밍업 세션',
    score: 73,
    delta: '+1',
    summary: '입 모양이 좁아 소리가 갇혀요. 입을 더 열면 음색이 풀립니다.',
    strengths: ['음정 안정', '호흡 시작 깨끗함'],
    issues: [{ label: '입 벌림 부족 (좁은 모음)', severity: 'mid' }],
    nextSteps: ['손가락 2개 입에 넣고 발성 1분', '아/에/이/오/우 단모음 또박또박 5초씩'],
    aiQuote: '입 크기 = 음색의 풍부함. 거울로 입 크기 체크하면서 연습하세요.',
  },
];

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'dance', label: '💃 댄스' },
  { id: 'vocal', label: '🎤 보컬' },
  { id: 'korean', label: '🇰🇷 한국어' },
  { id: 'audition', label: '🏆 오디션' },
];

export default function FeedbackHistoryView() {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(FEEDBACK[0]?.id || null);

  const filtered = useMemo(() => {
    if (filter === 'all') return FEEDBACK;
    return FEEDBACK.filter((f) => f.track === filter);
  }, [filter]);

  const stats = useMemo(() => {
    const scores = FEEDBACK.map((f) => f.score).filter(Boolean);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const best = Math.max(...scores);
    return { count: FEEDBACK.length, avg, best };
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: '100%', padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Header stats={stats} />

        <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: 4, marginBottom: 14, width: 'fit-content', flexWrap: 'wrap' }}>
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
                padding: '6px 12px',
                borderRadius: 999,
                background: filter === f.id ? C.accent : 'transparent',
                color: filter === f.id ? '#FFF' : C.textSecondary,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((fb) => (
            <FeedbackItem
              key={fb.id}
              feedback={fb}
              isOpen={openId === fb.id}
              onToggle={() => setOpenId(openId === fb.id ? null : fb.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ stats }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.15em' }}>AI FEEDBACK</p>
      <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: C.textPrimary }}>피드백 히스토리</h1>
      <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textSecondary }}>
        AI가 분석한 모든 코멘트 — 강점, 개선점, 다음 스텝까지 한 곳에서
      </p>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        <Stat label="총 피드백" value={`${stats.count}개`} accent={C.accent} />
        <Stat label="평균 점수" value={`${stats.avg}점`} accent={C.blue} />
        <Stat label="최고 기록" value={`${stats.best}점`} accent={C.green} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
      <p style={{ margin: 0, fontSize: 11, color: C.textTertiary }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: accent }}>{value}</p>
    </div>
  );
}

function FeedbackItem({ feedback, isOpen, onToggle }) {
  const track = TRACK_META[feedback.track] || TRACK_META.dance;
  const deltaPositive = feedback.delta?.startsWith('+');

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 14,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${track.color}14`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {track.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: track.color, background: `${track.color}14`, padding: '2px 8px', borderRadius: 999 }}>
              {track.label}
            </span>
            <span style={{ fontSize: 10, color: C.textTertiary }}>{feedback.when}</span>
            {feedback.pinned ? (
              <span style={{ fontSize: 10, color: C.warn, fontWeight: 700 }}>📌 고정</span>
            ) : null}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{feedback.title}</p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: C.textSecondary,
              display: '-webkit-box',
              WebkitLineClamp: isOpen ? 5 : 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {feedback.summary}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: feedback.score >= 85 ? C.green : feedback.score >= 70 ? track.color : C.textSecondary,
            }}
          >
            {feedback.score}
          </p>
          {feedback.delta ? (
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: deltaPositive ? C.green : C.danger }}>
              {feedback.delta}
            </p>
          ) : null}
        </div>
        <span style={{ flexShrink: 0, fontSize: 16, color: C.textTertiary, transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▾</span>
      </button>

      {isOpen ? (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* AI quote */}
          <div
            style={{
              background: `${track.color}10`,
              border: `1px solid ${track.color}33`,
              borderRadius: 12,
              padding: 12,
              fontSize: 12,
              color: C.textPrimary,
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}
          >
            🤖 {feedback.aiQuote}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <Section title="✅ 잘한 점" tint={C.green}>
              {feedback.strengths.map((s, i) => (
                <Bullet key={i} color={C.green}>{s}</Bullet>
              ))}
            </Section>
            <Section title="⚠️ 개선할 점" tint={C.warn}>
              {feedback.issues.map((iss, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <SeverityDot severity={iss.severity} />
                  <span style={{ fontSize: 12, color: C.textPrimary }}>{iss.label}</span>
                </div>
              ))}
            </Section>
          </div>

          <Section title="🎯 다음 스텝" tint={C.accent}>
            {feedback.nextSteps.map((s, i) => (
              <Bullet key={i} color={C.accent}>{s}</Bullet>
            ))}
          </Section>

          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <ActionButton primary>다시 연습하기</ActionButton>
            <ActionButton>저장</ActionButton>
            <ActionButton>공유</ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, tint, children }) {
  return (
    <div style={{ background: '#FAFAFB', border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: tint }}>{title}</p>
      {children}
    </div>
  );
}

function Bullet({ color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 7, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: C.textPrimary, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function SeverityDot({ severity }) {
  const map = {
    high: { color: C.danger, label: '높음' },
    mid: { color: C.warn, label: '중간' },
    low: { color: C.green, label: '낮음' },
  };
  const m = map[severity] || map.mid;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: m.color,
        background: `${m.color}1A`,
        border: `1px solid ${m.color}55`,
        padding: '2px 6px',
        borderRadius: 999,
      }}
    >
      {m.label}
    </span>
  );
}

function ActionButton({ primary, children }) {
  return (
    <button
      type="button"
      style={{
        background: primary ? C.accent : C.card,
        color: primary ? '#FFF' : C.textPrimary,
        border: primary ? 'none' : `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
