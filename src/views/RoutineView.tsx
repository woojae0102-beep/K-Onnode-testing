// @ts-nocheck
import React, { useState } from 'react';

const COLORS = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  border: '#F0F0F0',
  textPrimary: '#111111',
  textSecondary: '#666666',
  textTertiary: '#999999',
  accent: '#FF1F8E',
  accentBg: '#FFF0F7',
  dance: '#FF1F8E',
  vocal: '#4A6BFF',
  korean: '#1DB971',
  warmup: '#F39C12',
  cooldown: '#9B59B6',
};

const TODAY_BLOCKS = [
  { time: '07:30', duration: 5, type: 'warmup', icon: '🌅', title: '웜업 스트레칭', desc: '목·어깨 풀고 발성 워밍업', done: true },
  { time: '08:00', duration: 15, type: 'vocal', icon: '🎤', title: '복식 호흡 + 립트릴', desc: '호흡 안정화 — 약점 보완', done: true },
  { time: '12:30', duration: 20, type: 'dance', icon: '🕺', title: 'Pink Venom 1절 안무', desc: '카운트 4-5 박자 정확히', done: false, current: true },
  { time: '19:00', duration: 10, type: 'korean', icon: '🇰🇷', title: '받침 ㄹ 발음', desc: '단어 30개 또박또박', done: false },
  { time: '21:00', duration: 8, type: 'cooldown', icon: '🌙', title: '쿨다운 + 일일 리포트', desc: '오늘 점수 확인 + 스트레칭', done: false },
];

const WEEK_PLAN = [
  { day: '월', short: 'MON', focus: '댄스', minutes: 45, color: COLORS.dance, blocks: 3, done: true },
  { day: '화', short: 'TUE', focus: '보컬', minutes: 35, color: COLORS.vocal, blocks: 4, done: true },
  { day: '수', short: 'WED', focus: '한국어', minutes: 25, color: COLORS.korean, blocks: 2, done: true },
  { day: '목', short: 'THU', focus: '댄스+보컬', minutes: 50, color: COLORS.dance, blocks: 4, done: true },
  { day: '금', short: 'FRI', focus: '복합', minutes: 58, color: COLORS.accent, blocks: 5, today: true },
  { day: '토', short: 'SAT', focus: '댄스', minutes: 60, color: COLORS.dance, blocks: 3 },
  { day: '일', short: 'SUN', focus: '리커버리', minutes: 20, color: COLORS.cooldown, blocks: 2 },
];

const ROUTINE_PRINCIPLES = [
  { icon: '🎯', label: '약점 우선', desc: '복식호흡 · 팔 확장 · 받침 ㄹ을 매일 분산 배치' },
  { icon: '⏱️', label: '짧고 자주', desc: '한 번에 60분보다 20분 × 3회가 효과적이에요' },
  { icon: '📈', label: '점진적 강도', desc: '주말로 갈수록 난이도/시간을 점진적으로 늘립니다' },
];

export default function RoutineView() {
  const [tab, setTab] = useState('today');
  return (
    <div
      style={{
        padding: 'clamp(16px, 4vw, 24px)',
        maxWidth: 920,
        margin: '0 auto',
        minHeight: '100%',
        background: COLORS.bg,
        boxSizing: 'border-box',
      }}
    >
      <Header />
      <Tabs tab={tab} onChange={setTab} />
      {tab === 'today' && <TodayPlan blocks={TODAY_BLOCKS} />}
      {tab === 'week' && <WeekPlan week={WEEK_PLAN} />}
      <PrinciplesCard items={ROUTINE_PRINCIPLES} />
      <RegenerateCta />
      <BottomNote />
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 16 }}>
      <span
        style={{
          display: 'inline-block',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          padding: '4px 10px',
          borderRadius: 999,
          background: COLORS.accentBg,
          color: COLORS.accent,
          textTransform: 'uppercase',
        }}
      >
        AI Custom Routine
      </span>
      <h1
        style={{
          margin: '10px 0 4px',
          fontSize: 'clamp(20px, 5vw, 24px)',
          fontWeight: 700,
          color: COLORS.textPrimary,
        }}
      >
        📅 맞춤 루틴
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
        Lv.12 · 주간 5일 연습 · 약점 보완 우선으로 자동 구성된 루틴이에요.
      </p>
    </div>
  );
}

function Tabs({ tab, onChange }) {
  const items = [
    { id: 'today', label: '오늘 (Day)' },
    { id: 'week', label: '이번 주 (Week)' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 4,
        marginBottom: 14,
      }}
    >
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            style={{
              flex: 1,
              border: 'none',
              padding: '10px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              color: active ? '#FFFFFF' : COLORS.textSecondary,
              background: active ? COLORS.accent : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function TodayPlan({ blocks }) {
  const totalMin = blocks.reduce((s, b) => s + b.duration, 0);
  const doneMin = blocks.filter((b) => b.done).reduce((s, b) => s + b.duration, 0);
  const pct = Math.round((doneMin / totalMin) * 100);

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
            오늘의 타임라인
          </p>
          <p style={{ margin: 0, fontSize: 11, color: COLORS.textSecondary }}>
            {doneMin} / {totalMin}분 진행
          </p>
        </div>
        <div
          style={{
            marginTop: 8,
            height: 6,
            background: COLORS.bg,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: COLORS.accent,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {blocks.map((b, idx) => (
          <TimelineBlock key={idx} block={b} />
        ))}
      </div>
    </div>
  );
}

function TimelineBlock({ block }) {
  const color = COLORS[block.type] || COLORS.accent;
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        background: block.current ? `${color}10` : COLORS.bg,
        border: block.current ? `1.5px solid ${color}` : '1px solid transparent',
        borderRadius: 10,
        opacity: block.done ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56, gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary }}>{block.time}</span>
        <span
          style={{
            fontSize: 10,
            color: COLORS.textTertiary,
            background: '#FFFFFF',
            padding: '2px 6px',
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {block.duration}분
        </span>
      </div>

      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${color}22`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {block.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.textPrimary,
              textDecoration: block.done ? 'line-through' : 'none',
            }}
          >
            {block.title}
          </p>
          {block.done ? (
            <span style={{ fontSize: 10, color: COLORS.textSecondary }}>✓ 완료</span>
          ) : block.current ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 999,
                background: color,
                color: '#FFFFFF',
              }}
            >
              지금
            </span>
          ) : null}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
          {block.desc}
        </p>
      </div>

      {!block.done ? (
        <button
          type="button"
          style={{
            alignSelf: 'center',
            background: block.current ? color : 'transparent',
            color: block.current ? '#FFFFFF' : color,
            border: `1px solid ${color}`,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          시작
        </button>
      ) : null}
    </div>
  );
}

function WeekPlan({ week }) {
  const max = Math.max(...week.map((d) => d.minutes));
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
        주간 트레이닝 플랜 (총 {week.reduce((s, d) => s + d.minutes, 0)}분)
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          alignItems: 'end',
          minHeight: 140,
          marginBottom: 12,
        }}
      >
        {week.map((d, idx) => {
          const h = (d.minutes / max) * 100;
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.textSecondary }}>
                {d.minutes}m
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: 32,
                  height: `${h}%`,
                  minHeight: 12,
                  background: d.today ? d.color : `${d.color}55`,
                  borderRadius: 6,
                  border: d.today ? `2px solid ${d.color}` : 'none',
                  position: 'relative',
                }}
              >
                {d.done ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#1DB971',
                      color: '#FFFFFF',
                      fontSize: 9,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: d.today ? 700 : 500,
                  color: d.today ? d.color : COLORS.textSecondary,
                }}
              >
                {d.day}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {week.map((d, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              background: d.today ? `${d.color}11` : 'transparent',
              borderRadius: 8,
              borderLeft: `3px solid ${d.color}`,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textPrimary, minWidth: 36 }}>
              {d.short}
            </span>
            <span style={{ fontSize: 12, color: COLORS.textPrimary, flex: 1, fontWeight: d.today ? 700 : 500 }}>
              {d.focus}
            </span>
            <span style={{ fontSize: 11, color: COLORS.textSecondary }}>
              {d.blocks}블록 · {d.minutes}분
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrinciplesCard({ items }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
        🤖 AI가 이 루틴을 설계한 이유
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, lineHeight: 1.2 }}>{it.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>
                {it.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                {it.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegenerateCta() {
  return (
    <button
      type="button"
      style={{
        width: '100%',
        background: COLORS.accent,
        color: '#FFFFFF',
        border: 'none',
        padding: '14px 20px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      ✨ AI 루틴 다시 생성하기
    </button>
  );
}

function BottomNote() {
  return (
    <p
      style={{
        margin: '14px 0 0',
        fontSize: 11,
        color: COLORS.textTertiary,
        textAlign: 'center',
        lineHeight: 1.6,
      }}
    >
      샘플 데이터로 기능 미리보기 중입니다. 실제 약점 분석/목표 기반으로 자동 갱신돼요.
    </p>
  );
}
