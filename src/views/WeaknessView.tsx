// @ts-nocheck
import React from 'react';

const COLORS = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  border: '#F0F0F0',
  textPrimary: '#111111',
  textSecondary: '#666666',
  textTertiary: '#999999',
  accent: '#FF1F8E',
  accentBg: '#FFF0F7',
  warning: '#FF9F43',
  danger: '#E74C3C',
  success: '#1DB971',
  info: '#4A6BFF',
};

const SAMPLE_OVERALL = {
  totalSessions: 24,
  recentScore: 82,
  trend: '+4',
  topWeakness: '댄스 — 팔 동작 확장',
  topImprovement: '보컬 — 호흡 안정성',
};

const SAMPLE_WEAKNESSES = [
  {
    id: 'dance',
    icon: '🕺',
    track: '댄스',
    color: '#FF1F8E',
    overallScore: 78,
    issues: [
      {
        title: '팔 동작 확장 부족',
        severity: 'high',
        frequency: '최근 8회 중 6회 감지',
        impact: '안무 완성도 -12%',
        aiTip: '거울을 보면서 팔을 끝까지 뻗는 연습을 매일 5분씩 해보세요. 어깨 근육이 풀리면 자연스럽게 확장이 커집니다.',
        practice: '쉐도우 댄스 5분 + 안무 1구간 반복',
      },
      {
        title: '카운트 4-5에서 박자 늦음',
        severity: 'medium',
        frequency: '최근 5회 중 4회 감지',
        impact: '리듬 정확도 -8%',
        aiTip: '메트로놈 90 BPM에서 발 카운트만 따로 연습해보세요.',
        practice: '메트로놈 카운트 연습 3분',
      },
    ],
  },
  {
    id: 'vocal',
    icon: '🎤',
    track: '보컬',
    color: '#4A6BFF',
    overallScore: 81,
    issues: [
      {
        title: '후렴 고음 호흡 흔들림',
        severity: 'high',
        frequency: '최근 6회 중 5회 감지',
        impact: '음정 정확도 -15%',
        aiTip: '복식 호흡으로 횡격막 지지를 강화하세요. "스스스" 발성으로 30초 유지 훈련이 효과적입니다.',
        practice: '복식호흡 5분 + 립트릴 2분',
      },
      {
        title: '비강 공명 약함',
        severity: 'low',
        frequency: '최근 4회 중 2회 감지',
        impact: '음색 풍부도 -5%',
        aiTip: '"미야~" 발성으로 비강 공명 자리를 찾아보세요.',
        practice: '공명 발성 연습 3분',
      },
    ],
  },
  {
    id: 'korean',
    icon: '🇰🇷',
    track: '한국어',
    color: '#1DB971',
    overallScore: 88,
    issues: [
      {
        title: '받침 ㄹ 발음 흐림',
        severity: 'medium',
        frequency: '최근 7회 중 4회 감지',
        impact: '발음 정확도 -7%',
        aiTip: '"달, 별, 살" 같은 받침 ㄹ 단어를 또박또박 반복해서 혀끝 위치를 익히세요.',
        practice: '받침 ㄹ 단어 30개 낭독',
      },
    ],
  },
];

const PRIORITY_ACTIONS = [
  { rank: 1, label: '복식 호흡 강화', track: '보컬', minutes: 10 },
  { rank: 2, label: '팔 확장 쉐도우 댄스', track: '댄스', minutes: 5 },
  { rank: 3, label: '받침 ㄹ 발음 연습', track: '한국어', minutes: 5 },
];

export default function WeaknessView() {
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
      <OverallCard data={SAMPLE_OVERALL} />
      <PrioritySection actions={PRIORITY_ACTIONS} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {SAMPLE_WEAKNESSES.map((w) => (
          <TrackWeaknessCard key={w.id} data={w} />
        ))}
      </div>
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
        AI Weakness Analysis
      </span>
      <h1
        style={{
          margin: '10px 0 4px',
          fontSize: 'clamp(20px, 5vw, 24px)',
          fontWeight: 700,
          color: COLORS.textPrimary,
        }}
      >
        📈 약점 분석
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
        최근 연습 데이터를 AI가 분석해 집중 보완할 포인트를 정리했어요.
      </p>
    </div>
  );
}

function OverallCard({ data }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>
          최근 7일 분석 요약
        </p>
        <span style={{ fontSize: 11, color: COLORS.textTertiary }}>2026.04.21 ~ 04.27</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat label="연습 세션" value={data.totalSessions} unit="회" color={COLORS.textPrimary} />
        <Stat
          label="최근 평균"
          value={data.recentScore}
          unit="점"
          color={COLORS.accent}
          tag={data.trend}
          tagColor={COLORS.success}
        />
        <Stat label="개선 추세" value={data.trend} unit="" color={COLORS.success} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        <KVPill label="가장 약한 부분" value={data.topWeakness} color={COLORS.danger} />
        <KVPill label="가장 발전한 부분" value={data.topImprovement} color={COLORS.success} />
      </div>
    </div>
  );
}

function Stat({ label, value, unit, color, tag, tagColor }) {
  return (
    <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12 }}>
      <p style={{ margin: 0, fontSize: 11, color: COLORS.textSecondary, fontWeight: 500 }}>{label}</p>
      <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: color || COLORS.textPrimary }}>{value}</span>
        {unit ? <span style={{ fontSize: 12, color: COLORS.textSecondary }}>{unit}</span> : null}
        {tag ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 6,
              background: `${tagColor}22`,
              color: tagColor,
            }}
          >
            {tag}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function KVPill({ label, value, color }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: COLORS.bg,
        borderLeft: `3px solid ${color}`,
        padding: '10px 12px',
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: 10, color: COLORS.textTertiary, fontWeight: 600, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function PrioritySection({ actions }) {
  return (
    <div
      style={{
        background: '#0F1721',
        borderRadius: 14,
        padding: 18,
        color: '#FFFFFF',
        marginBottom: 4,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#FFD66B' }}>
        🎯 TODAY'S TOP 3
      </p>
      <p style={{ margin: '6px 0 14px', fontSize: 14, fontWeight: 600 }}>
        오늘 우선 연습할 약점 베스트 3
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a) => (
          <div
            key={a.rank}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: '#FFD66B',
                color: '#0F1721',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {a.rank}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{a.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                {a.track} · 약 {a.minutes}분
              </p>
            </div>
            <button
              type="button"
              style={{
                background: '#FF1F8E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              시작
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackWeaknessCard({ data }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${data.color}18`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
          }}
        >
          {data.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: COLORS.textPrimary }}>
            {data.track}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.textSecondary }}>
            현재 평균 점수 · {data.overallScore}점
          </p>
        </div>
        <ScoreCircle score={data.overallScore} color={data.color} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.issues.map((issue, idx) => (
          <IssueItem key={idx} issue={issue} accent={data.color} />
        ))}
      </div>
    </div>
  );
}

function ScoreCircle({ score, color }) {
  const pct = Math.max(0, Math.min(100, score));
  const dash = `${pct}, 100`;
  return (
    <svg width="42" height="42" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <path
        d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
        fill="none"
        stroke={`${color}22`}
        strokeWidth="3"
      />
      <path
        d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
      <text x="18" y="21" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function IssueItem({ issue, accent }) {
  const severityMap = {
    high: { label: '심각', bg: '#FFE5E5', color: COLORS.danger },
    medium: { label: '중간', bg: '#FFF4E5', color: COLORS.warning },
    low: { label: '낮음', bg: '#E5F7EE', color: COLORS.success },
  };
  const sev = severityMap[issue.severity] || severityMap.low;
  return (
    <div
      style={{
        background: COLORS.bg,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, flex: 1 }}>
          {issue.title}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 999,
            background: sev.bg,
            color: sev.color,
          }}
        >
          {sev.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, flexWrap: 'wrap' }}>
        <span>📊 {issue.frequency}</span>
        <span>⚠️ {issue.impact}</span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: COLORS.textPrimary,
          lineHeight: 1.55,
          background: '#FFFFFF',
          padding: '8px 10px',
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        🤖 <strong style={{ color: accent }}>AI 코치:</strong> {issue.aiTip}
      </p>
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: COLORS.textSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>👉 추천 연습:</span>
        <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{issue.practice}</span>
      </div>
    </div>
  );
}

function BottomNote() {
  return (
    <p
      style={{
        margin: '20px 0 0',
        fontSize: 11,
        color: COLORS.textTertiary,
        textAlign: 'center',
        lineHeight: 1.6,
      }}
    >
      샘플 데이터로 기능 미리보기 중입니다. 실제 연습이 누적되면 자동으로 업데이트돼요.
    </p>
  );
}
