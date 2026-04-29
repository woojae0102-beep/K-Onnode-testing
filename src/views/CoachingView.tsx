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
  success: '#1DB971',
  warning: '#F39C12',
  info: '#4A6BFF',
  done: '#1DB971',
  current: '#FF1F8E',
  upcoming: '#999999',
};

const ACTIVE_GOAL = {
  title: 'BLACKPINK — Pink Venom 커버 영상 완성',
  category: '댄스 + 보컬 커버',
  deadline: '2026.05.18',
  daysLeft: 20,
  progressPct: 45,
  startedAt: '2026.04.07',
  weeklyHours: 5,
  difficulty: '중급',
};

const MILESTONES = [
  {
    week: 'WEEK 1',
    period: '04.07 - 04.13',
    title: '기초 다지기',
    status: 'done',
    score: 92,
    tasks: [
      { label: '곡 분석 + 가사 익히기', done: true },
      { label: '안무 영상 5회 시청', done: true },
      { label: '음정 듣기 테스트', done: true },
    ],
    aiTip: '시작이 좋아요. 곡 구조 이해도가 평균 이상입니다.',
  },
  {
    week: 'WEEK 2',
    period: '04.14 - 04.20',
    title: '구간 분리 학습',
    status: 'done',
    score: 86,
    tasks: [
      { label: '벌스 1 안무 + 보컬', done: true },
      { label: '프리코러스 안무', done: true },
      { label: '코러스 보컬 (피치 포함)', done: true },
    ],
    aiTip: '코러스 고음에서 호흡 흔들림이 감지됐어요. 다음 주 워밍업 강화 필요.',
  },
  {
    week: 'WEEK 3',
    period: '04.21 - 04.27',
    title: '구간 통합 + 약점 보완',
    status: 'current',
    score: null,
    progressPct: 60,
    tasks: [
      { label: '1절 통합 (안무 + 보컬)', done: true },
      { label: '2절 안무', done: true },
      { label: '복식호흡 강화 훈련', done: false, current: true },
      { label: '댄스 브레이크 마무리', done: false },
    ],
    aiTip: '약점 1순위인 호흡 안정성에 집중하세요. 복식호흡 5분 × 매일이 효과적입니다.',
  },
  {
    week: 'WEEK 4',
    period: '04.28 - 05.04',
    title: '풀 런스루 + 표현력',
    status: 'upcoming',
    tasks: [
      { label: '풀 곡 1회 런스루' },
      { label: '표정/시선 연습' },
      { label: '카메라 앞 리허설' },
    ],
    aiTip: '컨셉 메이크업 + 의상 미리 준비해두면 영상 촬영 시 시간 절약돼요.',
  },
  {
    week: 'WEEK 5',
    period: '05.05 - 05.11',
    title: '영상 촬영 + 편집',
    status: 'upcoming',
    tasks: [
      { label: '카메라 셋업 + 조명' },
      { label: '본 촬영 3 테이크' },
      { label: '편집 + 컬러 보정' },
    ],
    aiTip: '풀샷 + 클로즈업 두 카메라 권장. 동선 좁은 곳 피하기.',
  },
  {
    week: 'WEEK 6',
    period: '05.12 - 05.18',
    title: '최종 점검 + 업로드',
    status: 'upcoming',
    tasks: [
      { label: '커뮤니티 미리 공유 + 피드백' },
      { label: '썸네일/제목 최적화' },
      { label: 'YouTube + TikTok 업로드' },
    ],
    aiTip: '챌린지 해시태그 #PinkVenomChallenge 활용 추천.',
  },
];

const TODAY_FOCUS = {
  title: '오늘 추천 액션',
  steps: [
    { icon: '🌬️', label: '복식 호흡 훈련', minutes: 10, link: '약점 분석' },
    { icon: '🎤', label: '코러스 고음 안정화', minutes: 15, link: '보컬 트레이닝' },
    { icon: '💃', label: '댄스 브레이크 카운트 연습', minutes: 20, link: '댄스 트레이닝' },
  ],
};

const ALTERNATIVE_GOALS = [
  { icon: '🏆', label: 'HYBE 오디션 합격 도전', period: '8주 플랜' },
  { icon: '🎙️', label: 'NewJeans 빠더쥐 보컬 마스터', period: '4주 플랜' },
  { icon: '🇰🇷', label: '한국어 일상 회화 마스터', period: '6주 플랜' },
];

export default function CoachingView() {
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
      <ActiveGoalCard goal={ACTIVE_GOAL} />
      <TodayFocusCard data={TODAY_FOCUS} />
      <MilestoneTimeline milestones={MILESTONES} />
      <AlternativeGoals goals={ALTERNATIVE_GOALS} />
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
        Goal-based Coaching
      </span>
      <h1
        style={{
          margin: '10px 0 4px',
          fontSize: 'clamp(20px, 5vw, 24px)',
          fontWeight: 700,
          color: COLORS.textPrimary,
        }}
      >
        🎯 목표 기반 코칭
      </h1>
      <p style={{ margin: 0, fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
        설정한 목표까지 단계별 플랜으로 AI가 함께합니다.
      </p>
    </div>
  );
}

function ActiveGoalCard({ goal }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #FF1F8E 0%, #C71585 100%)',
        borderRadius: 16,
        padding: 20,
        color: '#FFFFFF',
        marginBottom: 14,
        boxShadow: '0 8px 24px rgba(255, 31, 142, 0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.85 }}>
            ACTIVE GOAL · {goal.category}
          </p>
          <h2 style={{ margin: '6px 0 0', fontSize: 'clamp(16px, 4.5vw, 19px)', fontWeight: 800, lineHeight: 1.3 }}>
            {goal.title}
          </h2>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.2)',
            whiteSpace: 'nowrap',
          }}
        >
          D-{goal.daysLeft}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <MiniStat label="목표 일자" value={goal.deadline} />
        <MiniStat label="시작일" value={goal.startedAt} />
        <MiniStat label="주간 시간" value={`${goal.weeklyHours}h`} />
        <MiniStat label="난이도" value={goal.difficulty} />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>전체 진행률</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{goal.progressPct}%</span>
        </div>
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${goal.progressPct}%`,
              height: '100%',
              background: '#FFFFFF',
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.12)',
        borderRadius: 8,
        padding: '8px 10px',
      }}
    >
      <p style={{ margin: 0, fontSize: 10, opacity: 0.8, fontWeight: 500 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function TodayFocusCard({ data }) {
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
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
        ⚡ {data.title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.steps.map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: COLORS.bg,
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
                {s.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.textSecondary }}>
                {s.minutes}분 · {s.link}
              </p>
            </div>
            <button
              type="button"
              style={{
                background: COLORS.accent,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              실행
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneTimeline({ milestones }) {
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
      <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
        📍 단계별 마일스톤
      </p>
      <div style={{ position: 'relative' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 14,
            top: 8,
            bottom: 8,
            width: 2,
            background: COLORS.border,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {milestones.map((m, idx) => (
            <MilestoneItem key={idx} milestone={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MilestoneItem({ milestone }) {
  const dotColor =
    milestone.status === 'done' ? COLORS.done : milestone.status === 'current' ? COLORS.current : COLORS.upcoming;
  const isCurrent = milestone.status === 'current';
  return (
    <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
      <div style={{ position: 'relative', width: 30, flexShrink: 0 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: milestone.status === 'upcoming' ? COLORS.bg : dotColor,
            border: milestone.status === 'upcoming' ? `2px dashed ${COLORS.upcoming}` : `2px solid ${dotColor}`,
            display: 'grid',
            placeItems: 'center',
            color: milestone.status === 'upcoming' ? COLORS.upcoming : '#FFFFFF',
            fontSize: 12,
            fontWeight: 800,
            position: 'relative',
            zIndex: 1,
            boxShadow: isCurrent ? `0 0 0 4px ${dotColor}33` : 'none',
          }}
        >
          {milestone.status === 'done' ? '✓' : milestone.status === 'current' ? '▶' : '·'}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          background: isCurrent ? `${COLORS.current}08` : COLORS.bg,
          border: isCurrent ? `1.5px solid ${COLORS.current}55` : `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 999,
              background: `${dotColor}22`,
              color: dotColor,
              letterSpacing: '0.06em',
            }}
          >
            {milestone.week}
          </span>
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{milestone.period}</span>
          {milestone.score != null ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                marginLeft: 'auto',
                padding: '2px 8px',
                borderRadius: 999,
                background: `${COLORS.success}18`,
                color: COLORS.success,
              }}
            >
              평가 {milestone.score}점
            </span>
          ) : null}
        </div>
        <p style={{ margin: '4px 0 8px', fontSize: 14, fontWeight: 700, color: COLORS.textPrimary }}>
          {milestone.title}
        </p>

        {milestone.progressPct != null ? (
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                height: 5,
                background: '#FFFFFF',
                borderRadius: 999,
                overflow: 'hidden',
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  width: `${milestone.progressPct}%`,
                  height: '100%',
                  background: dotColor,
                }}
              />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: COLORS.textSecondary, textAlign: 'right' }}>
              {milestone.progressPct}% 진행
            </p>
          </div>
        ) : null}

        <ul style={{ margin: '6px 0 8px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {milestone.tasks.map((t, idx) => (
            <li
              key={idx}
              style={{
                fontSize: 12,
                color: t.done ? COLORS.textTertiary : COLORS.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                textDecoration: t.done ? 'line-through' : 'none',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: t.done ? COLORS.success : t.current ? COLORS.current : '#FFFFFF',
                  border: `1px solid ${t.done ? COLORS.success : t.current ? COLORS.current : COLORS.border}`,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#FFFFFF',
                  fontSize: 9,
                  flexShrink: 0,
                }}
              >
                {t.done ? '✓' : t.current ? '▶' : ''}
              </span>
              {t.label}
            </li>
          ))}
        </ul>

        {milestone.aiTip ? (
          <div
            style={{
              fontSize: 11,
              color: COLORS.textSecondary,
              background: '#FFFFFF',
              border: `1px solid ${COLORS.border}`,
              borderLeft: `3px solid ${dotColor}`,
              padding: '8px 10px',
              borderRadius: 6,
              lineHeight: 1.5,
            }}
          >
            🤖 <strong style={{ color: dotColor }}>AI 코치:</strong> {milestone.aiTip}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AlternativeGoals({ goals }) {
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
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
        🌟 다른 목표 만들기
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {goals.map((g, idx) => (
          <button
            key={idx}
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              background: '#FFFFFF',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 22 }}>{g.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
                {g.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: COLORS.textSecondary }}>
                {g.period}
              </p>
            </div>
            <span style={{ color: COLORS.textTertiary, fontSize: 16 }}>›</span>
          </button>
        ))}
      </div>
    </div>
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
      샘플 데이터로 기능 미리보기 중입니다. 실제 목표 설정 시 자동으로 마일스톤이 생성돼요.
    </p>
  );
}
