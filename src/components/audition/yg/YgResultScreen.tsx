// @ts-nocheck
// YG 최종 결과 화면 — YG 스타성 철학 기반 리치 결과 렌더링
// 심사위원 총평·강·약점 (양태준/이나래/Marcus 고유 메타) / 토론 하이라이트 + YG 철학 모먼트 / 최종 투표 카드
// 4주 루틴 (주간 YG 어록 포함) / 양태준이 직접 했을 한마디 박스

import React, { useEffect, useState } from 'react';
import { ygJudges, type YgJudgeMeta } from '../../../data/ygJudges';
import type {
  YgFinalResult,
  YgJudgeSummary,
  YgRoutineWeek,
} from '../../../hooks/useYgAudition';
import YgDebateScreen from './YgDebateScreen';

type Props = {
  result: YgFinalResult;
  onSaveCertificate?: () => void;
  onRetry?: () => void;
  onAskCoach?: () => void;
};

const VERDICT_BG: Record<string, string> = {
  pass: '#111111',
  hold: '#2F3640',
  training_recommended: '#57606F',
  fail: '#000000',
};

const VERDICT_ACCENT: Record<string, string> = {
  pass: '#FFD700',
  hold: '#A29BFE',
  training_recommended: '#FF4757',
  fail: '#FF0000',
};

const VERDICT_LABEL: Record<string, string> = {
  pass: 'PASS',
  hold: 'HOLD',
  training_recommended: 'TRAINING RECOMMENDED',
  fail: 'FAIL',
};

export default function YgResultScreen({ result, onSaveCertificate, onRetry, onAskCoach }: Props) {
  const headerColor = VERDICT_BG[result.finalVerdict] || '#2F3640';
  const accentColor = VERDICT_ACCENT[result.finalVerdict] || '#FFD700';

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#050505',
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
          accentColor={accentColor}
          verdictInfo={result.verdictInfo}
        />

        <YgKeyCriteriaCard
          starPotentialPassed={!!result.starPotentialPassed}
          characterPotentialPassed={!!result.characterPotentialPassed}
          marketabilityPassed={!!result.marketabilityPassed}
          allCriteriaPass={!!result.allCriteriaPass}
        />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionTitle text="심사위원별 평가" />
          {result.judgeSummaries.map((summary, idx) => (
            <JudgeResultCard
              key={summary.judgeId || idx}
              judgeMeta={ygJudges[idx]}
              summary={summary}
            />
          ))}
        </section>

        {(result.debateHighlight || result.ygPhilosophyHighlight || result.finalVotes) && (
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
            {result.ygPhilosophyHighlight && (
              <div
                style={{
                  background: 'rgba(255,215,0,0.08)',
                  border: '1px dashed #FFD700',
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
                    color: '#FFD700',
                  }}
                >
                  🖤 YG PHILOSOPHY MOMENT
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
                  "{result.ygPhilosophyHighlight}"
                </p>
              </div>
            )}
            {result.finalMarketEvaluation && (
              <MarketEvaluationCard evaluation={result.finalMarketEvaluation} />
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
            <SectionTitle text="회의 진행 전체 보기" />
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <YgDebateScreen debate={result.debateResult} />
            </div>
          </section>
        )}

        {Array.isArray(result.routine) && result.routine.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SectionTitle text="4주 YG 스타일 성장 루틴" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {result.routine.map((week) => (
                <WeekCard key={week.week} week={week} accentColor={accentColor} />
              ))}
            </div>

            {result.ygSpecialAdvice && (
              <div
                style={{
                  background: `${accentColor}1A`,
                  border: `1px solid ${accentColor}66`,
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
                      color: accentColor,
                      letterSpacing: 1.5,
                    }}
                  >
                    YG 재도전 — 핵심 조언
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55 }}>
                    {result.ygSpecialAdvice}
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

            {result.yangTaejunWouldSay && (
              <div
                style={{
                  background:
                    'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(255,215,0,0.08) 100%)',
                  border: '1px solid rgba(255,215,0,0.45)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 28 }}>🖤</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#FFD700',
                      letterSpacing: 1.5,
                    }}
                  >
                    양태준이 마지막으로 할 법한 말
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
                    "{result.yangTaejunWouldSay}"
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          {result.finalVerdict === 'pass' && onSaveCertificate && (
            <ActionButton onClick={onSaveCertificate} background={accentColor} label="합격증 저장" />
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
  accentColor,
  verdictInfo,
}: {
  finalVerdict: string;
  avgScore: number;
  headerColor: string;
  accentColor: string;
  verdictInfo: YgFinalResult['verdictInfo'];
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
        background: `linear-gradient(135deg, ${headerColor} 0%, #050505 100%)`,
        borderRadius: 22,
        padding: 28,
        textAlign: 'center',
        border: `1px solid ${accentColor}55`,
        boxShadow: `0 0 60px ${accentColor}22`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 4,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        YG ENTERTAINMENT — GLOBAL AUDITION RESULT
      </p>
      <h1
        style={{
          margin: '12px 0 4px',
          fontSize: 32,
          fontWeight: 900,
          color: accentColor,
          letterSpacing: 3,
        }}
      >
        {verdictInfo?.title || VERDICT_LABEL[finalVerdict]}
      </h1>
      <p style={{ margin: '4px 0 16px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>
        {verdictInfo?.message}
      </p>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 6,
          background: 'rgba(0,0,0,0.45)',
          padding: '10px 20px',
          borderRadius: 14,
          border: `1px solid ${accentColor}33`,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>3인 평균</span>
        <span style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, color: accentColor }}>
          {displayScore}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>/ 100</span>
      </div>
      {verdictInfo?.ygPhilosophy && (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 12,
            color: 'rgba(255,255,255,0.92)',
            fontStyle: 'italic',
          }}
        >
          🖤 {verdictInfo.ygPhilosophy}
        </p>
      )}
      {verdictInfo?.nextStep && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          → {verdictInfo.nextStep}
        </p>
      )}
    </div>
  );
}

function YgKeyCriteriaCard({
  starPotentialPassed,
  characterPotentialPassed,
  marketabilityPassed,
  allCriteriaPass,
}: {
  starPotentialPassed: boolean;
  characterPotentialPassed: boolean;
  marketabilityPassed: boolean;
  allCriteriaPass: boolean;
}) {
  const items = [
    { label: '스타성', passed: starPotentialPassed, icon: '⭐' },
    { label: '캐릭터', passed: characterPotentialPassed, icon: '✨' },
    { label: '시장성', passed: marketabilityPassed, icon: '💎' },
    { label: '전 기준', passed: allCriteriaPass, icon: '🏆' },
  ];
  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 10,
        }}
      >
        YG 핵심 기준 충족 여부
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map((it) => (
          <span
            key={it.label}
            style={{
              flex: '1 1 100px',
              minWidth: 100,
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 10px',
              borderRadius: 10,
              background: it.passed ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.04)',
              border: it.passed ? '1px solid #FFD70066' : '1px solid rgba(255,255,255,0.06)',
              color: it.passed ? '#FFD700' : 'rgba(255,255,255,0.55)',
              textAlign: 'center',
              letterSpacing: 0.5,
            }}
          >
            {it.icon} {it.label} {it.passed ? '✓' : '—'}
          </span>
        ))}
      </div>
    </section>
  );
}

function MarketEvaluationCard({ evaluation }: { evaluation: any }) {
  const items = [
    { key: 'koreaMarket', label: '🇰🇷 한국 시장', value: evaluation.koreaMarket },
    { key: 'globalMarket', label: '🌍 글로벌 시장', value: evaluation.globalMarket },
    { key: 'fanAttraction', label: '✨ 팬덤 흡입력', value: evaluation.fanAttraction },
    { key: 'viralPotential', label: '🔥 바이럴 가능성', value: evaluation.viralPotential },
  ].filter((i) => !!i.value);
  if (!items.length) return null;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 10,
        }}
      >
        시장성 종합 평가
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {items.map((it) => (
          <div
            key={it.key}
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12,
              color: '#FFFFFF',
              lineHeight: 1.5,
            }}
          >
            <p style={{ margin: 0, fontSize: 10, color: '#FFD700', fontWeight: 800 }}>{it.label}</p>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.85)' }}>{it.value}</p>
          </div>
        ))}
      </div>
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
  judgeMeta?: YgJudgeMeta;
  summary: any;
}) {
  if (!judgeMeta) return null;
  const accent = judgeMeta.accentColor === '#111111' ? '#FFD700' : judgeMeta.accentColor;
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
              color: passing ? '#FFD700' : '#FF4757',
            }}
          >
            {passing ? '✓ 기준 통과' : `기준 ${judgeMeta.passingThreshold}점 미달`}
          </p>
        </div>
      </div>

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
            const scoreKey = getScoreKeyForCriterion(judgeMeta.id, idx);
            const cScore = Number(summary.scores[scoreKey] ?? 0);
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
              color: '#FFD700',
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
              color: '#FF4757',
              letterSpacing: 1.5,
            }}
          >
            ✎ 개선 + YG 방향
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
  judgeId: YgJudgeMeta['id'];
  summary: YgJudgeSummary;
  accent: string;
}) {
  const chips: { label: string; value: string }[] = [];
  if (judgeId === 'yg-taejun') {
    if (summary.ygCharacterType) chips.push({ label: 'YG 캐릭터 라인', value: summary.ygCharacterType });
    if (summary.fanAttraction) chips.push({ label: '팬 흡입력', value: String(summary.fanAttraction) });
    if (summary.riskFactor) chips.push({ label: '위험 요소', value: String(summary.riskFactor) });
  } else if (judgeId === 'yg-narae') {
    if (summary.cameraAttraction) chips.push({ label: '카메라 흡입력', value: summary.cameraAttraction });
    if (summary.ygPerformanceLine) chips.push({ label: '퍼포먼스 라인', value: summary.ygPerformanceLine });
    if (summary.performanceRisk) chips.push({ label: '퍼포먼스 위험', value: String(summary.performanceRisk) });
  } else if (judgeId === 'yg-marcus') {
    if (summary.viralPotential) chips.push({ label: '바이럴 가능성', value: String(summary.viralPotential) });
    if (summary.globalRisk) chips.push({ label: '해외 리스크', value: String(summary.globalRisk) });
  }
  return (
    <>
      {chips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chips.map((c, idx) => (
            <span
              key={`${c.label}-${idx}`}
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: accent,
                background: `${accent}1A`,
                border: `1px solid ${accent}55`,
                padding: '4px 10px',
                borderRadius: 999,
                letterSpacing: 0.4,
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.6)', marginRight: 6 }}>{c.label}</span>
              {c.value}
            </span>
          ))}
        </div>
      )}
      {judgeId === 'yg-marcus' && summary.globalMarketFit && typeof summary.globalMarketFit === 'object' && (
        <GlobalMarketFitGrid fit={summary.globalMarketFit} accent={accent} />
      )}
    </>
  );
}

function GlobalMarketFitGrid({ fit, accent }: { fit: any; accent: string }) {
  const markets = [
    { key: 'us', label: '🇺🇸 미국', value: fit.us },
    { key: 'japan', label: '🇯🇵 일본', value: fit.japan },
    { key: 'seAsia', label: '🌏 동남아', value: fit.seAsia },
    { key: 'europe', label: '🇪🇺 유럽', value: fit.europe },
  ].filter((m) => !!m.value);
  if (!markets.length) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 6,
      }}
    >
      {markets.map((m) => (
        <div
          key={m.key}
          style={{
            background: `${accent}0F`,
            border: `1px solid ${accent}33`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.45,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: accent }}>{m.label}</p>
          <p style={{ margin: '3px 0 0' }}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}

function getScoreKeyForCriterion(judgeId: YgJudgeMeta['id'], idx: number): string {
  const KEY_MAP: Record<YgJudgeMeta['id'], string[]> = {
    'yg-taejun': ['starPresence', 'individuality', 'vibeGroove', 'marketability'],
    'yg-narae': ['stageControl', 'facialExpression', 'styleDigest', 'confidence'],
    'yg-marcus': ['toneVoice', 'globalSense', 'hiphopVibe', 'character'],
  };
  return KEY_MAP[judgeId]?.[idx] || '';
}

function WeekCard({ week, accentColor }: { week: YgRoutineWeek; accentColor: string }) {
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
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 11,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
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
      {week.ygPhilosophyPoint && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 10,
            color: '#FFD700',
            background: 'rgba(255,215,0,0.10)',
            border: '1px dashed rgba(255,215,0,0.35)',
            borderRadius: 8,
            padding: '6px 8px',
            fontStyle: 'italic',
            lineHeight: 1.45,
          }}
        >
          🖤 {week.ygPhilosophyPoint}
        </p>
      )}
    </div>
  );
}

const VOTE_LABEL: Record<string, string> = {
  pass: 'PASS',
  hold: 'HOLD',
  training_recommended: 'TRAINING',
  fail: 'FAIL',
};

const VOTE_COLOR: Record<string, string> = {
  pass: '#FFD700',
  hold: '#A29BFE',
  training_recommended: '#FF4757',
  fail: '#FF0000',
};

const DECISION_METHOD_LABEL: Record<string, string> = {
  unanimous: '만장일치',
  majority: '다수결',
  taejun_final: '양태준 최종 결정',
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
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          최종 투표
        </p>
        {decisionMethod && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#FFD700',
              background: 'rgba(255,215,0,0.18)',
              border: '1px solid rgba(255,215,0,0.4)',
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
          const judge = ygJudges.find((j) => j.name === speaker);
          const color = VOTE_COLOR[vote] || '#A29BFE';
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
                <p
                  style={{
                    margin: 0,
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.55)',
                    fontWeight: 600,
                  }}
                >
                  {judge?.title || ''}
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: '#000000',
                  background: color,
                  padding: '4px 8px',
                  borderRadius: 8,
                  letterSpacing: 1,
                }}
              >
                {VOTE_LABEL[vote] || vote}
              </span>
            </div>
          );
        })}
      </div>
      {decisionMethod === 'taejun_final' && tiebreakerLine && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'rgba(255,255,255,0.8)',
            fontStyle: 'italic',
            paddingLeft: 12,
            borderLeft: '2px solid #FFD700',
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
        background: isOutline ? 'transparent' : background || '#FFD700',
        border: isOutline ? '1px solid rgba(255,255,255,0.3)' : 'none',
        color: isOutline ? '#FFFFFF' : '#000000',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        cursor: 'pointer',
        letterSpacing: 1,
      }}
    >
      {label}
    </button>
  );
}
