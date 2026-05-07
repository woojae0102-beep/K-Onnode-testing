// @ts-nocheck
// SM 최종 결과 화면 — HYBE와 동일 구조 + SM 색상/키 매핑

import React, { useEffect, useState } from 'react';
import { smJudges, type SmJudgeMeta } from '../../../data/smJudges';
import type { SmFinalResult } from '../../../hooks/useSmAudition';
import SmDebateScreen from './SmDebateScreen';

type Props = {
  result: SmFinalResult;
  onSaveCertificate?: () => void;
  onRetry?: () => void;
  onAskCoach?: () => void;
};

const VERDICT_BG: Record<string, string> = {
  pass: '#1A237E',
  conditional: '#E91E63',
  pending: '#00BCD4',
  fail: '#636E72',
};

const VERDICT_LABEL: Record<string, string> = {
  pass: '합격',
  conditional: '조건부 합격',
  pending: '보류',
  fail: '불합격',
};

export default function SmResultScreen({ result, onSaveCertificate, onRetry, onAskCoach }: Props) {
  const headerColor = VERDICT_BG[result.finalVerdict] || '#1C1C1E';

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#0A0A0A',
        color: '#FFFFFF',
        padding: 'clamp(20px, 4vw, 32px) clamp(14px, 3vw, 24px) 80px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <ResultHeader
          finalVerdict={result.finalVerdict}
          avgScore={result.avgScore}
          headerColor={headerColor}
          verdictInfo={result.verdictInfo}
        />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle text="심사위원별 평가" />
          {result.judgeSummaries.map((summary, idx) => (
            <JudgeResultCard
              key={summary.judgeId || idx}
              judgeMeta={smJudges[idx]}
              summary={summary}
            />
          ))}
        </section>

        {result.debateResult && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionTitle text="토론 하이라이트" />
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <SmDebateScreen debate={result.debateResult} />
            </div>
          </section>
        )}

        {result.routine && Array.isArray(result.routine.routine) && result.routine.routine.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionTitle text="4주 SM-Tailored 연습 루틴" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              {result.routine.routine.map((week) => (
                <WeekCard key={week.week} week={week} accentColor={headerColor} />
              ))}
            </div>
            {result.routine.smSpecificAdvice && (
              <div
                style={{
                  background: `${headerColor}22`,
                  border: `1px solid ${headerColor}66`,
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 22 }}>🎯</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 800,
                      color: headerColor,
                      letterSpacing: 1.5,
                    }}
                  >
                    SM 재도전 특별 조언
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55 }}>
                    {result.routine.smSpecificAdvice}
                  </p>
                  {result.routine.priorityImprovement && (
                    <p
                      style={{
                        margin: '8px 0 0',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <strong>최우선 개선:</strong> {result.routine.priorityImprovement} ·{' '}
                      <strong>재도전 시기:</strong> {result.routine.nextAuditionTarget}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {result.finalVerdict === 'pass' && onSaveCertificate && (
            <ActionButton onClick={onSaveCertificate} background={headerColor} label="합격증 저장" />
          )}
          {onRetry && <ActionButton onClick={onRetry} variant="outline" label="다시 도전하기" />}
          {onAskCoach && <ActionButton onClick={onAskCoach} variant="outline" label="AI 코치에게 물어보기" />}
        </div>
      </div>
    </div>
  );
}

function ResultHeader({
  finalVerdict,
  avgScore,
  headerColor,
  verdictInfo,
}: {
  finalVerdict: string;
  avgScore: number;
  headerColor: string;
  verdictInfo: SmFinalResult['verdictInfo'];
}) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * avgScore));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [avgScore]);

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${headerColor} 0%, ${headerColor}cc 100%)`,
        borderRadius: 22,
        padding: 28,
        textAlign: 'center',
        boxShadow: `0 0 60px ${headerColor}33`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        SM 엔터테인먼트 오디션 심사 결과
      </p>
      <h1 style={{ margin: '12px 0 4px', fontSize: 32, fontWeight: 900 }}>
        {verdictInfo?.title || VERDICT_LABEL[finalVerdict]}
      </h1>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
        {verdictInfo?.message}
      </p>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 6,
          background: 'rgba(0,0,0,0.25)',
          padding: '10px 20px',
          borderRadius: 14,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>평균</span>
        <span style={{ fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{displayScore}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>/ 100</span>
      </div>
      {verdictInfo?.next && (
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          → {verdictInfo.next}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 2.5,
        color: 'rgba(255,255,255,0.5)',
      }}
    >
      {text}
    </p>
  );
}

function JudgeResultCard({
  judgeMeta,
  summary,
}: {
  judgeMeta?: SmJudgeMeta;
  summary: any;
}) {
  if (!judgeMeta) return null;
  const accent = judgeMeta.accentColor;
  const score = Number(summary.score ?? 0);
  const maxTotal = judgeMeta.evaluationCriteria.reduce((sum, c) => sum + c.maxScore, 0);
  const passing = score >= judgeMeta.passingThreshold;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#0A0A0A',
            border: `2px solid ${accent}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
          }}
        >
          {judgeMeta.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{judgeMeta.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: accent, fontWeight: 600 }}>
            {judgeMeta.title}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: accent }}>
            {score}
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {' '}
              / {maxTotal}
            </span>
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              color: passing ? '#7BD389' : '#FFA500',
            }}
          >
            {passing ? '✓ 기준 통과' : `기준 ${judgeMeta.passingThreshold}점 미달`}
          </p>
        </div>
      </div>

      {summary.vetoTriggered && (
        <div
          style={{
            background: '#FF4757',
            color: '#FFFFFF',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          ⚠️ 거부권 발동 — {summary.vetoReason}
        </div>
      )}
      {summary.objectionRaised && (
        <div
          style={{
            background: '#FF8B3D',
            color: '#FFFFFF',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          🛑 이의 제기 — {summary.objectionReason}
        </div>
      )}
      {summary.strongOpposition && (
        <div
          style={{
            background: '#FFB400',
            color: '#0A0A0A',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          🌐 강력 반대 — {summary.oppositionReason}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {judgeMeta.evaluationCriteria.map((criterion, idx) => {
          const key = scoreKeyFor(judgeMeta.id, idx);
          const value = Number((summary.scores || {})[key] ?? 0);
          return (
            <ScoreBar
              key={criterion.name}
              label={criterion.name}
              value={value}
              max={criterion.maxScore}
              color={accent}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <BulletBox
          title="잘한 점"
          color="#7BD389"
          items={summary.strongPoints || []}
        />
        <BulletBox
          title="개선할 점"
          color="#FFA500"
          items={summary.improvements || []}
        />
      </div>

      {summary.closing && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontStyle: 'italic',
            color: accent,
            fontWeight: 600,
            paddingTop: 10,
            borderTop: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          "{summary.closing}"
        </p>
      )}
    </div>
  );
}

function scoreKeyFor(judgeId: string, idx: number): string {
  const map: Record<string, string[]> = {
    'sm-seongho': ['smAuraVisual', 'stageDominance', 'uniqueness', 'smWorldCompatibility'],
    'sm-yujin': ['smVocalTechnique', 'vocalUniqueColor', 'smpPerformanceVocal', 'musicalUnderstanding'],
    'sm-seoyoung': ['globalBrandPotential', 'smWorldviewCompatibility', 'mediaContentFriendliness', 'artistIdentityLongevity'],
  };
  return map[judgeId]?.[idx] || '';
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#FFFFFF', fontWeight: 800 }}>
          {value} / {max}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 700ms ease',
          }}
        />
      </div>
    </div>
  );
}

function BulletBox({ title, color, items }: { title: string; color: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color, letterSpacing: 1 }}>{title}</p>
      <ul style={{ margin: '6px 0 0', padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeekCard({
  week,
  accentColor,
}: {
  week: { week: number; focus: string; daily: string[]; goal: string };
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            background: accentColor,
            color: '#FFFFFF',
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          Week {week.week}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{week.focus}</span>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(week.daily || []).map((d, i) => (
          <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            {d}
          </li>
        ))}
      </ul>
      {week.goal && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontStyle: 'italic',
            color: accentColor,
            paddingTop: 6,
            borderTop: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          🎯 {week.goal}
        </p>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  background,
  variant,
}: {
  onClick: () => void;
  label: string;
  background?: string;
  variant?: 'outline';
}) {
  const isOutline = variant === 'outline';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 160,
        background: isOutline ? 'transparent' : background || '#1A237E',
        color: isOutline ? '#FFFFFF' : '#FFFFFF',
        border: isOutline ? '1px solid rgba(255,255,255,0.3)' : 'none',
        padding: '14px 20px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
