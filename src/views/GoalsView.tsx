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
  green: '#1DB971',
  purple: '#8E56FF',
  warn: '#FF9F43',
  bgSoft: '#F9F9FB',
};

const TABS = [
  { id: 'active', label: '진행 중' },
  { id: 'completed', label: '달성' },
  { id: 'all', label: '전체' },
];

const GOALS = [
  {
    id: 'g-1',
    track: '댄스',
    icon: '💃',
    color: C.accent,
    title: 'NewJeans Hype Boy 안무 마스터',
    description: '풀버전 안무를 90점 이상으로 완주',
    progress: 68,
    target: 100,
    deadline: '2026-05-12',
    streak: 7,
    weeklyTarget: '주 3회 연습',
    weeklyDone: 2,
    weeklyTotal: 3,
    nextStep: '하이라이트 후렴 구간 카운트 5–8 정확도 올리기',
    status: 'active',
  },
  {
    id: 'g-2',
    track: '보컬',
    icon: '🎤',
    color: C.blue,
    title: '커버곡 1곡 녹음',
    description: '아이유 - 좋은 날, 풀버전 1테이크 80점 이상',
    progress: 42,
    target: 100,
    deadline: '2026-05-25',
    streak: 4,
    weeklyTarget: '주 2회 보컬 연습',
    weeklyDone: 1,
    weeklyTotal: 2,
    nextStep: '2절 고음 호흡 안정화',
    status: 'active',
  },
  {
    id: 'g-3',
    track: '한국어',
    icon: '🇰🇷',
    color: C.purple,
    title: '드라마 한 장면 따라 말하기',
    description: '5문장 모두 85점 이상',
    progress: 80,
    target: 100,
    deadline: '2026-05-04',
    streak: 9,
    weeklyTarget: '매일 5분 연습',
    weeklyDone: 5,
    weeklyTotal: 7,
    nextStep: '"같이 가도 될까요?" 받침 발음 다듬기',
    status: 'active',
  },
  {
    id: 'g-4',
    track: '오디션',
    icon: '🏆',
    color: C.warn,
    title: 'JYP 1차 오디션 통과 점수',
    description: '시뮬레이션에서 80점 이상 달성',
    progress: 100,
    target: 100,
    deadline: '2026-04-20',
    streak: 0,
    weeklyTarget: '완료',
    weeklyDone: 1,
    weeklyTotal: 1,
    nextStep: '✓ 달성 — 다음 단계: 2차 라운드 도전',
    status: 'completed',
  },
];

export default function GoalsView() {
  const [tab, setTab] = useState('active');

  const filtered = useMemo(() => {
    if (tab === 'all') return GOALS;
    return GOALS.filter((g) => g.status === tab);
  }, [tab]);

  const summary = useMemo(() => {
    const active = GOALS.filter((g) => g.status === 'active');
    const avg = active.length
      ? Math.round(active.reduce((acc, g) => acc + g.progress, 0) / active.length)
      : 0;
    return {
      active: active.length,
      completed: GOALS.filter((g) => g.status === 'completed').length,
      avg,
    };
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: '100%', padding: 'clamp(12px, 3vw, 24px)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <Header summary={summary} />

        <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: 4, marginBottom: 12, width: 'fit-content' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 999,
                background: tab === t.id ? C.accent : 'transparent',
                color: tab === t.id ? '#FFF' : C.textSecondary,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>

        <SuggestedGoals />
      </div>
    </div>
  );
}

function Header({ summary }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.15em' }}>GOALS</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: C.textPrimary }}>목표 진행률</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textSecondary }}>
            매주, 매월 목표를 잘게 나눠 꾸준히 달성해보세요
          </p>
        </div>
        <button
          type="button"
          style={{
            background: C.accent,
            color: '#FFF',
            border: 'none',
            borderRadius: 999,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 6px 18px #FF1F8E33',
          }}
        >
          + 새 목표 만들기
        </button>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Stat label="진행 중" value={`${summary.active}개`} accent={C.accent} />
        <Stat label="달성 완료" value={`${summary.completed}개`} accent={C.green} />
        <Stat label="평균 진행률" value={`${summary.avg}%`} accent={C.blue} />
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

function GoalCard({ goal }) {
  const dDay = useMemo(() => {
    if (!goal.deadline) return null;
    const today = new Date();
    const d = new Date(goal.deadline);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}일 지남`;
    if (diff === 0) return 'D-Day';
    return `D-${diff}`;
  }, [goal.deadline]);

  const isDone = goal.progress >= goal.target;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          background: `linear-gradient(to right, ${goal.color} 0%, ${goal.color} ${goal.progress}%, ${C.border} ${goal.progress}%)`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>{goal.icon}</div>
          <div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: goal.color,
                background: `${goal.color}14`,
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {goal.track}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{goal.title}</p>
          </div>
        </div>
        <ProgressRing value={goal.progress} color={goal.color} />
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 12, color: C.textSecondary }}>{goal.description}</p>

      {/* Weekly checklist */}
      <div style={{ marginTop: 12, padding: 10, background: C.bgSoft, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 11, color: C.textSecondary, fontWeight: 600 }}>이번주 목표</p>
          <p style={{ margin: 0, fontSize: 11, color: goal.color, fontWeight: 700 }}>
            {goal.weeklyDone} / {goal.weeklyTotal}
          </p>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textPrimary }}>{goal.weeklyTarget}</p>
        <div style={{ marginTop: 6, height: 6, background: '#EAEAEA', borderRadius: 999 }}>
          <div
            style={{
              width: `${(goal.weeklyDone / goal.weeklyTotal) * 100}%`,
              height: '100%',
              background: goal.color,
              borderRadius: 999,
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {goal.streak > 0 ? (
          <Pill color={C.warn} label={`🔥 ${goal.streak}일 연속`} />
        ) : null}
        {dDay ? <Pill color={isDone ? C.green : C.blue} label={dDay} /> : null}
        {isDone ? <Pill color={C.green} label="✓ 달성" /> : null}
      </div>

      <div style={{ marginTop: 10, padding: 10, background: '#FFF8F2', border: '1px solid #FFE4D1', borderRadius: 10 }}>
        <p style={{ margin: 0, fontSize: 11, color: C.warn, fontWeight: 700 }}>💡 다음 스텝</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textPrimary, lineHeight: 1.4 }}>{goal.nextStep}</p>
      </div>
    </div>
  );
}

function ProgressRing({ value, color, size = 56 }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - value / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EFEFEF" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.textPrimary }}>{value}%</span>
      </div>
    </div>
  );
}

function Pill({ color, label }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}16`,
        border: `1px solid ${color}33`,
        padding: '3px 9px',
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}

function SuggestedGoals() {
  const SUGGESTIONS = [
    { icon: '🎯', label: '주 5일 출석', sub: '꾸준함이 실력의 지름길', color: C.warn },
    { icon: '🎤', label: '한 곡 풀버전 도전', sub: '평균 75점 이상 목표', color: C.blue },
    { icon: '🇰🇷', label: '회화 문장 50개', sub: '한 달 안에 마스터', color: C.purple },
  ];
  return (
    <div style={{ marginTop: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.textPrimary }}>✨ 추천 목표</p>
      <p style={{ margin: '2px 0 10px', fontSize: 11, color: C.textTertiary }}>최근 활동을 분석한 AI 추천</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            style={{
              background: `${s.color}10`,
              border: `1px solid ${s.color}33`,
              borderRadius: 12,
              padding: 10,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{s.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSecondary }}>{s.sub}</p>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 16, color: s.color, fontWeight: 800 }}>+</span>
          </button>
        ))}
      </div>
    </div>
  );
}
