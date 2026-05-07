// @ts-nocheck
// JYP 최종 결과 화면 — 박진영 철학 기반 리치 결과 렌더링
// 심사위원 총평·강·약점 / 토론 하이라이트 + 박진영 철학 모먼트 / 최종 투표 카드
// 4주 루틴 (주간 박진영 어록 포함) / 박진영이 직접 했을 한마디 박스

import React, { useEffect, useState } from 'react';
import { jypJudges, type JypJudgeMeta } from '../../../data/jypJudges';
import type { JypFinalResult, JypJudgeSummary, JypRoutineWeek } from '../../../hooks/useJypAudition';
import JypDebateScreen from './JypDebateScreen';

type Props = {
  result: JypFinalResult;
  onSaveCertificate?: () => void;
  onRetry?: () => void;
  onAskCoach?: () => void;
};

const VERDICT_BG: Record<string, string> = {
  pass: '#FF6348',
  conditional: '#FF9F43',
  pending: '#6C5CE7',
  fail: '#636E72',
};

const VERDICT_LABEL: Record<string, string> = {
  pass: '합격',
  conditional: '조건부 합격',
  pending: '보류',
  fail: '불합격',
};

export default function JypResultScreen({ result, onSaveCertificate, onRetry, onAskCoach }: Props) {
  const headerColor = VERDICT_BG[result.finalVerdict] || '#FF6348';

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
              judgeMeta={jypJudges[idx]}
              summary={summary}
            />
          ))}
        </section>

        {(result.debateHighlight || result.jypPhilosophyHighlight || result.finalVotes) && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionTitle text="토론 하이라이트" />
            {result.debateHighlight && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {result.debateHighlight}
              </div>
            )}
            {result.jypPhilosophyHighlight && (
              <div
                style={{
                  background: 'rgba(108,92,231,0.12)',
                  border: '1px dashed #6C5CE7',
                  borderRadius: 14,
                  padding: '14px 16px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 2,
                    color: '#A29BFE',
                  }}
                >
                  🌱 박진영 철학 모먼트
                </p>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 13,
                    fontStyle: 'italic',
                    color: 'rgba(255,255,255,0.92)',
                    lineHeight: 1.6,
                  }}
                >
                  "{result.jypPhilosophyHighlight}"
                </p>
              </div>
            )}
            <FinalVotesCard
              votes={result.finalVotes || {}}
              decisionMethod={result.decisionMethod}
              tiebreakerLine={result.debateResult?.debateScript?.tiebreakerLine || null}
            />
          </section>
        )}

        {result.debateResult && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionTitle text="토론 진행 전체 보기" />
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <JypDebateScreen debate={result.debateResult} />
            </div>
          </section>
        )}

        {Array.isArray(result.routine) && result.routine.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionTitle text="4주 JYP-Tailored 연습 루틴" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {result.routine.map((week) => (
                <WeekCard key={week.week} week={week} accentColor={headerColor} />
              ))}
            </div>

            {result.jypSpecialAdvice && (
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
                    JYP 재도전 — 박진영 철학 조언
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55 }}>
                    {result.jypSpecialAdvice}
                  </p>
                  {result.nextAuditionTarget && (
                    <p
                      style={{
                        margin: '8px 0 0',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <strong>재도전 권장 시기:</strong> {result.nextAuditionTarget}
                    </p>
                  )}
                </div>
              </div>
            )}

            {result.parkJinyoungWouldSay && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255,99,72,0.16) 0%, rgba(255,159,67,0.10) 100%)',
                  border: '1px solid rgba(255,99,72,0.45)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 28 }}>🎤</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#FF6348',
                      letterSpacing: 1.5,
                    }}
                  >
                    박진영이 직접 해줄 것 같은 한마디
                  </p>
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: 14,
                      lineHeight: 1.6,
                      fontStyle: 'italic',
                      color: 'rgba(255,255,255,0.95)',
                    }}
                  >
                    "{result.parkJinyoungWouldSay}"
                  </p>
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
  verdictInfo: JypFinalResult['verdictInfo'];
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
        JYP 엔터테인먼트 오디션 심사 결과
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
      {verdictInfo?.jypPhilosophy && (
        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.92)', fontStyle: 'italic' }}>
          🌱 {verdictInfo.jypPhilosophy}
        </p>
      )}
      {(verdictInfo?.nextStep || verdictInfo?.next) && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          → {verdictInfo.nextStep || verdictInfo.next}
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
  judgeMeta?: JypJudgeMeta;
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
            background: judgeMeta.id === 'jyp-seonghyeon' ? '#6C5CE7' : '#FF8B3D',
            color: '#FFFFFF',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {judgeMeta.id === 'jyp-seonghyeon' ? '⚖️' : '🛑'} {judgeMeta.id === 'jyp-seonghyeon' ? 'JYP 인성 거부권' : (judgeMeta.id === 'jyp-jaewon' ? '발성 이의 제기' : '에너지 강력 반대')} — {summary.vetoReason}
        </div>
      )}

      {summary.summary && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          {summary.summary}
        </p>
      )}

      {summary.scores && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {judgeMeta.evaluationCriteria.map((criterion, idx) => {
            const scoreKeys = getScoreKeyForCriterion(judgeMeta.id, idx);
            const cScore = Number(summary.scores[scoreKeys] ?? 0);
            const ratio = Math.min(1, cScore / criterion.maxScore);
            return (
              <div key={criterion.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{criterion.name}</span>
                  <span style={{ color: accent, fontWeight: 700 }}>
                    {cScore} / {criterion.maxScore}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${ratio * 100}%`,
                      height: '100%',
                      background: accent,
                      borderRadius: 3,
                      transition: 'width 600ms ease-out',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {Array.isArray(summary.strongPoints) && summary.strongPoints.length > 0 && (
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              color: '#7BD389',
              letterSpacing: 1.5,
            }}
          >
            ✓ 강점
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12, lineHeight: 1.55 }}>
            {summary.strongPoints.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(summary.improvements) && summary.improvements.length > 0 && (
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              color: '#FFA500',
              letterSpacing: 1.5,
            }}
          >
            ✎ 개선 + JYP 트레이닝 방향
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12, lineHeight: 1.55 }}>
            {summary.improvements.map((p: string, i: number) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <JudgeMetaChips judgeId={judgeMeta.id} summary={summary} accent={accent} />

      {summary.closing && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.75)',
            paddingLeft: 12,
            borderLeft: `2px solid ${accent}`,
          }}
        >
          "{summary.closing}"
        </p>
      )}
    </div>
  );
}

function JudgeMetaChips({
  judgeId,
  summary,
  accent,
}: {
  judgeId: JypJudgeMeta['id'];
  summary: JypJudgeSummary;
  accent: string;
}) {
  const chips: { label: string; value: string }[] = [];
  if (judgeId === 'jyp-jaewon') {
    if (summary.habitDetected) chips.push({ label: '발성 습관', value: summary.habitDetected });
    if (summary.habitCorrectionTime) chips.push({ label: '교정 예상', value: summary.habitCorrectionTime });
    if (summary.liveRating) chips.push({ label: '라이브', value: summary.liveRating });
  } else if (judgeId === 'jyp-minji') {
    if (summary.jypGroupLine) chips.push({ label: 'JYP 라인', value: summary.jypGroupLine });
    if (summary.choreographyAbsorptionSpeed)
      chips.push({ label: '안무 흡수', value: summary.choreographyAbsorptionSpeed });
  } else if (judgeId === 'jyp-seonghyeon') {
    if (summary.characterRating) chips.push({ label: '인성 등급', value: summary.characterRating });
    if (summary.longTermPotential)
      chips.push({ label: '장기 적합성', value: summary.longTermPotential });
  }
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            background: `${accent}1A`,
            border: `1px solid ${accent}55`,
            padding: '4px 10px',
            borderRadius: 999,
            letterSpacing: 0.4,
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.6)', marginRight: 6 }}>{c.label}</span>
          {c.value}
        </span>
      ))}
    </div>
  );
}

// 심사위원 평가 항목 → 응답 점수 키 매핑
function getScoreKeyForCriterion(judgeId: JypJudgeMeta['id'], idx: number): string {
  const KEY_MAP: Record<JypJudgeMeta['id'], string[]> = {
    'jyp-jaewon': ['naturalVocalHabit', 'liveAbilityStamina', 'musicalSensitivity', 'trainingPotential'],
    'jyp-minji': ['energyVitality', 'danceTechniqueAccuracy', 'expressionEyeContact', 'jypStyleFit'],
    'jyp-seonghyeon': ['characterAttitude', 'purposeVision', 'teamworkRelationship', 'jypLifeFit'],
  };
  return KEY_MAP[judgeId]?.[idx] || '';
}

function WeekCard({ week, accentColor }: { week: JypRoutineWeek; accentColor: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: accentColor,
            letterSpacing: 1.5,
          }}
        >
          WEEK {week.week}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{week.focus}</p>
      {Array.isArray(week.daily) && week.daily.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>
          {week.daily.map((d: string, i: number) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {week.goal && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            fontStyle: 'italic',
          }}
        >
          🎯 {week.goal}
        </p>
      )}
      {week.jypPhilosophyPoint && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 10,
            color: '#A29BFE',
            background: 'rgba(108,92,231,0.10)',
            border: '1px dashed rgba(108,92,231,0.35)',
            borderRadius: 8,
            padding: '6px 8px',
            fontStyle: 'italic',
            lineHeight: 1.45,
          }}
        >
          🌱 {week.jypPhilosophyPoint}
        </p>
      )}
    </div>
  );
}

const VOTE_LABEL: Record<string, string> = {
  pass: '합격',
  conditional: '조건부',
  pending: '보류',
  fail: '불합격',
};

const VOTE_COLOR: Record<string, string> = {
  pass: '#FF6348',
  conditional: '#FF9F43',
  pending: '#6C5CE7',
  fail: '#636E72',
};

const DECISION_METHOD_LABEL: Record<string, string> = {
  unanimous: '만장일치',
  majority: '다수결',
  tiebreaker: '이성현 최종 결정권',
};

function FinalVotesCard({
  votes,
  decisionMethod,
  tiebreakerLine,
}: {
  votes: Record<string, string>;
  decisionMethod?: string;
  tiebreakerLine?: string | null;
}) {
  const entries = Object.entries(votes || {});
  if (!entries.length) return null;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(255,255,255,0.6)' }}>
          최종 투표
        </p>
        {decisionMethod && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#A29BFE',
              background: 'rgba(108,92,231,0.18)',
              border: '1px solid rgba(108,92,231,0.4)',
              padding: '3px 8px',
              borderRadius: 999,
              letterSpacing: 0.4,
            }}
          >
            ⚖️ {DECISION_METHOD_LABEL[decisionMethod] || decisionMethod}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entries.map(([speaker, vote]) => {
          const judge = jypJudges.find((j) => j.name === speaker);
          const color = VOTE_COLOR[vote] || '#636E72';
          return (
            <div
              key={speaker}
              style={{
                flex: '1 1 140px',
                minWidth: 140,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>{judge?.avatar || '🎤'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{speaker}</p>
                <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                  {judge?.title || ''}
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  background: color,
                  padding: '4px 8px',
                  borderRadius: 8,
                }}
              >
                {VOTE_LABEL[vote] || vote}
              </span>
            </div>
          );
        })}
      </div>
      {decisionMethod === 'tiebreaker' && tiebreakerLine && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'rgba(255,255,255,0.8)',
            fontStyle: 'italic',
            paddingLeft: 12,
            borderLeft: '2px solid #6C5CE7',
            lineHeight: 1.55,
          }}
        >
          "{tiebreakerLine}"
        </p>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  background,
  variant = 'solid',
}: {
  onClick: () => void;
  label: string;
  background?: string;
  variant?: 'solid' | 'outline';
}) {
  const isOutline = variant === 'outline';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: '1 1 160px',
        padding: '14px 18px',
        background: isOutline ? 'transparent' : background || '#FF6348',
        border: isOutline ? '1px solid rgba(255,255,255,0.3)' : 'none',
        color: '#FFFFFF',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
