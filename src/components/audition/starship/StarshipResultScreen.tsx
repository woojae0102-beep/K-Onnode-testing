// @ts-nocheck
// STARSHIP 최종 결과 화면 — final-verdict.js의 풍부한 STARSHIP 데이터 풀 렌더
// 핵심: STARSHIP 퍼플(#6C5CE7) 톤 / verdictInfo / judgeSummaries 3종 / market eval /
//       starshipPhilosophyHighlight / 4주 STARSHIP 루틴 / starshipWouldSay

import React from 'react';
import { starshipJudges } from '../../../data/starshipJudges';
import StarshipDebateScreen from './StarshipDebateScreen';
import type {
  StarshipFinalResult,
  StarshipJudgeSummary,
  StarshipVerdict,
} from '../../../hooks/useStarshipAudition';

type Props = {
  result: StarshipFinalResult;
  onRetry?: () => void;
  onAskCoach?: () => void;
};

const VERDICT_LABEL: Record<string, string> = {
  pass: '합격',
  conditional: '조건부 합격',
  training_recommended: '트레이닝 권장',
  fail: '불합격',
};

const VERDICT_BG: Record<string, string> = {
  pass: 'linear-gradient(135deg, #6C5CE7 0%, #8E7BFF 100%)',
  conditional: 'linear-gradient(135deg, #A29BFE 0%, #B8B0FF 100%)',
  training_recommended: 'linear-gradient(135deg, #636E72 0%, #8C9398 100%)',
  fail: 'linear-gradient(135deg, #2D3436 0%, #3D454A 100%)',
};

function getJudgeMeta(name: string) {
  const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
  return starshipJudges.find((j) => norm(j.name) === norm(name));
}

export default function StarshipResultScreen({ result, onRetry, onAskCoach }: Props) {
  const verdict = result.finalVerdict || 'conditional';
  const verdictBg = VERDICT_BG[verdict] || VERDICT_BG.conditional;
  const verdictLabel = VERDICT_LABEL[verdict] || verdict;
  const accentColor = result.verdictInfo?.color || '#6C5CE7';

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#0A0814',
        color: '#FFFFFF',
        padding: 'clamp(20px, 4vw, 40px)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
      }}
    >
      {/* 헤더 */}
      <header style={{ textAlign: 'center', marginTop: 8 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 6,
            color: '#A29BFE',
          }}
        >
          STARSHIP ENTERTAINMENT
        </p>
        <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 900, letterSpacing: 2 }}>
          오디션 심사 결과
        </h1>
      </header>

      {/* 최종 판정 카드 */}
      <section
        style={{
          background: verdictBg,
          borderRadius: 20,
          padding: 'clamp(20px, 3vw, 32px)',
          color: '#FFFFFF',
          textAlign: 'center',
          boxShadow: `0 16px 48px ${accentColor}44`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 4,
            opacity: 0.85,
          }}
        >
          FINAL VERDICT
        </p>
        <h2 style={{ margin: '8px 0 4px', fontSize: 36, fontWeight: 900, letterSpacing: 3 }}>
          {result.verdictInfo?.title || `🌟 ${verdictLabel}`}
        </h2>
        <p
          style={{
            margin: '12px auto 0',
            maxWidth: 640,
            fontSize: 14,
            lineHeight: 1.65,
            opacity: 0.95,
          }}
        >
          {result.verdictInfo?.message ||
            '심사위원 평가가 완료되었습니다. STARSHIP 스타일에 어울리는 자기 무드를 찾아가길 응원합니다.'}
        </p>
        <div
          style={{
            marginTop: 18,
            display: 'inline-flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Chip label={`평균 ${result.avgScore ?? 0}점`} />
          <Chip label={`판정 ${verdictLabel}`} />
          {result.starshipStylePassed !== undefined && (
            <Chip
              label={`STARSHIP 스타일 ${result.starshipStylePassed ? '✅ 통과' : '❌ 미달'}`}
            />
          )}
          {result.allCriteriaPass !== undefined && (
            <Chip label={`기준 통과 ${result.allCriteriaPass ? '✅' : '❌'}`} />
          )}
          {result.decisionMethod && (
            <Chip
              label={
                result.decisionMethod === 'unanimous'
                  ? '만장일치'
                  : result.decisionMethod === 'producer_override'
                    ? '한승훈 결정권'
                    : '다수결'
              }
            />
          )}
        </div>
        {result.verdictInfo?.starshipPhilosophy && (
          <p
            style={{
              margin: '20px auto 0',
              fontSize: 12,
              fontStyle: 'italic',
              opacity: 0.88,
              maxWidth: 580,
              lineHeight: 1.6,
              borderTop: '1px solid rgba(255,255,255,0.25)',
              paddingTop: 14,
            }}
          >
            🌟 {result.verdictInfo.starshipPhilosophy}
          </p>
        )}
        {result.verdictInfo?.nextStep && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            ▸ {result.verdictInfo.nextStep}
          </p>
        )}
      </section>

      {/* 개별 심사평 */}
      <section>
        <SectionTitle title="JUDGE EVALUATIONS" subtitle="3인 심사위원 개별 총평" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {(result.judgeSummaries || []).map((s, idx) => (
            <JudgeCard key={s.name || idx} summary={s} />
          ))}
        </div>
      </section>

      {/* 토론 하이라이트 */}
      {(result.debateHighlight || result.starshipPhilosophyHighlight) && (
        <section
          style={{
            background: 'rgba(108,92,231,0.08)',
            border: '1px solid rgba(108,92,231,0.35)',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
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
            🌟 DEBATE HIGHLIGHT
          </p>
          {result.debateHighlight && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.92)' }}>
              {result.debateHighlight}
            </p>
          )}
          {result.starshipPhilosophyHighlight && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.78)',
                paddingLeft: 12,
                borderLeft: '2px solid #6C5CE7',
              }}
            >
              "{result.starshipPhilosophyHighlight}"
            </p>
          )}
        </section>
      )}

      {/* 시장 평가 */}
      {result.marketEvaluation && (
        <section>
          <SectionTitle
            title="MARKET EVALUATION"
            subtitle="STARSHIP 시장성 종합 평가 (대중 호감도 / 센터·카메라·팀 밸런스)"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            <MarketCell label="✨ 대중 호감도" value={result.marketEvaluation.publicAppeal} />
            <MarketCell label="🎯 센터 가능성" value={result.marketEvaluation.centerPotential} />
            <MarketCell label="🤝 팀 밸런스" value={result.marketEvaluation.teamBalance} />
            <MarketCell
              label="📷 카메라 친화력"
              value={result.marketEvaluation.cameraFriendliness}
            />
          </div>
        </section>
      )}

      {/* 토론 전체 (debateResult가 있을 때 펼쳐 보기) */}
      {result.debateResult && (
        <details
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '14px 18px',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
              color: '#A29BFE',
            }}
          >
            🎬 전체 토론 다시보기
          </summary>
          <div style={{ marginTop: 16 }}>
            <StarshipDebateScreen debate={result.debateResult} />
          </div>
        </details>
      )}

      {/* 4주 STARSHIP 루틴 */}
      {result.routine && result.routine.length > 0 && (
        <section>
          <SectionTitle
            title="4-WEEK STARSHIP ROUTINE"
            subtitle="자연스러운 스타성 + 카메라 친화력 + 안정적 성장"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.routine.map((week) => (
              <RoutineCard key={week.week} week={week} />
            ))}
          </div>
        </section>
      )}

      {/* STARSHIP이 해줄 것 같은 조언 */}
      {(result.starshipSpecialAdvice || result.starshipWouldSay) && (
        <section
          style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.18) 0%, rgba(162,155,254,0.10) 100%)',
            border: '1px solid rgba(108,92,231,0.4)',
            borderRadius: 16,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 3,
              color: '#A29BFE',
            }}
          >
            🌟 STARSHIP'S ADVICE
          </p>
          {result.starshipSpecialAdvice && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.92)' }}>
              {result.starshipSpecialAdvice}
            </p>
          )}
          {result.starshipWouldSay && (
            <blockquote
              style={{
                margin: 0,
                fontSize: 13,
                fontStyle: 'italic',
                color: '#FFFFFF',
                lineHeight: 1.65,
                padding: '12px 16px',
                background: 'rgba(108,92,231,0.18)',
                borderLeft: '3px solid #6C5CE7',
                borderRadius: 8,
              }}
            >
              "{result.starshipWouldSay}"
            </blockquote>
          )}
          {result.nextAuditionTarget && (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              ▸ 재도전 권장 시기: <strong>{result.nextAuditionTarget}</strong>
            </p>
          )}
        </section>
      )}

      {/* 액션 */}
      <footer
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
          marginTop: 8,
          paddingBottom: 20,
        }}
      >
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: '#6C5CE7',
              color: '#FFFFFF',
              border: 'none',
              padding: '14px 28px',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: 1.5,
            }}
          >
            🔁 다시 도전하기
          </button>
        )}
        {onAskCoach && (
          <button
            type="button"
            onClick={onAskCoach}
            style={{
              background: 'transparent',
              color: '#A29BFE',
              border: '2px solid #A29BFE',
              padding: '14px 28px',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: 1.5,
            }}
          >
            🏢 다른 회사 오디션 보기
          </button>
        )}
      </footer>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span
      style={{
        background: 'rgba(255,255,255,0.18)',
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 800,
        padding: '6px 12px',
        borderRadius: 999,
        letterSpacing: 0.6,
      }}
    >
      {label}
    </span>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ marginBottom: 12 }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 4,
          color: '#A29BFE',
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: 0.4,
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}

function MarketCell({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        color: 'rgba(255,255,255,0.88)',
        lineHeight: 1.55,
      }}
    >
      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#A29BFE' }}>{label}</p>
      <p style={{ margin: '4px 0 0' }}>{value}</p>
    </div>
  );
}

function JudgeCard({ summary }: { summary: StarshipJudgeSummary }) {
  const meta = getJudgeMeta(summary.name);
  const accent = meta?.accentColor || '#6C5CE7';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent}55`,
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#0E0B1F',
            border: `2px solid ${accent}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
          }}
        >
          {meta?.avatar || '🎤'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>
            {summary.name}
          </p>
          {meta?.title && (
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 10,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: 0.4,
              }}
            >
              {meta.title}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: accent }}>
            {summary.score ?? 0}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {VERDICT_LABEL[summary.verdict as string]?.toUpperCase() ||
              (summary.verdict as string).toUpperCase()}
          </p>
        </div>
      </div>

      {summary.scores && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            paddingTop: 4,
            borderTop: '1px dashed rgba(255,255,255,0.12)',
          }}
        >
          {Object.entries(summary.scores)
            .filter(([k]) => k !== 'total')
            .map(([k, v]) => (
              <span
                key={k}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)',
                  padding: '3px 7px',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                {labelizeScoreKey(k)} {String(v)}
              </span>
            ))}
        </div>
      )}

      {summary.summary && (
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.88)' }}>
          {summary.summary}
        </p>
      )}

      {summary.strongPoints?.length ? (
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#6C5CE7', letterSpacing: 1 }}>
            ✅ 강점
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            {summary.strongPoints.map((p, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.improvements?.length ? (
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: '#E84393', letterSpacing: 1 }}>
            ▸ 개선점 + STARSHIP 방향
          </p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
            {summary.improvements.map((p, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <JudgeMetaTags summary={summary} accent={accent} />

      {summary.closing && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontStyle: 'italic',
            color: '#FFFFFF',
            paddingLeft: 10,
            borderLeft: `2px solid ${accent}`,
          }}
        >
          "{summary.closing}"
        </p>
      )}
    </div>
  );
}

function JudgeMetaTags({ summary, accent }: { summary: StarshipJudgeSummary; accent: string }) {
  const tags: { label: string; value?: string }[] = [];
  // 한승훈
  if (summary.centerType) tags.push({ label: '센터 타입', value: summary.centerType });
  if (summary.marketReaction) tags.push({ label: '시장 반응', value: summary.marketReaction });
  if (summary.publicAppealLevel) tags.push({ label: '대중 호감도', value: summary.publicAppealLevel });
  // 박나리
  if (summary.cameraType) tags.push({ label: '카메라 타입', value: summary.cameraType });
  if (summary.performanceLine) tags.push({ label: '퍼포먼스 라인', value: summary.performanceLine });
  if (summary.cameraRetention) tags.push({ label: '카메라 유지력', value: summary.cameraRetention });
  // 최지수
  if (summary.trainingType) tags.push({ label: '트레이닝 타입', value: summary.trainingType });
  if (summary.longTermProjection) tags.push({ label: '장기 전망', value: summary.longTermProjection });
  if (summary.teamSynergy) tags.push({ label: '팀 시너지', value: summary.teamSynergy });

  const filtered = tags.filter((t) => !!t.value);
  if (!filtered.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingTop: 6,
        borderTop: '1px dashed rgba(255,255,255,0.12)',
      }}
    >
      {filtered.map((t) => (
        <p
          key={t.label}
          style={{
            margin: 0,
            fontSize: 11,
            color: 'rgba(255,255,255,0.78)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 800, color: accent }}>{t.label}</span> · {t.value}
        </p>
      ))}
    </div>
  );
}

function RoutineCard({ week }: { week: any }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(108,92,231,0.3)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            background: '#6C5CE7',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 900,
            padding: '4px 10px',
            borderRadius: 999,
            letterSpacing: 1,
          }}
        >
          WEEK {week.week}
        </span>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#FFFFFF' }}>{week.focus}</p>
      </div>
      {Array.isArray(week.daily) && week.daily.length > 0 && (
        <ul style={{ margin: '4px 0 8px', paddingLeft: 18, fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
          {week.daily.map((d: string, i: number) => (
            <li key={i} style={{ marginBottom: 2 }}>
              {d}
            </li>
          ))}
        </ul>
      )}
      {week.goal && (
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          🎯 <strong>목표</strong> · {week.goal}
        </p>
      )}
      {week.starshipPoint && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            fontStyle: 'italic',
            color: '#A29BFE',
            paddingLeft: 12,
            borderLeft: '2px solid #6C5CE7',
          }}
        >
          🌟 {week.starshipPoint}
        </p>
      )}
    </div>
  );
}

function labelizeScoreKey(k: string): string {
  const map: Record<string, string> = {
    publicStarQuality: '대중스타성',
    centerPresence: '센터존재감',
    visualAtmosphere: '비주얼',
    growthStability: '안정성장',
    cameraAttraction: '카메라흡입',
    expressionEyeContact: '표정눈빛',
    performanceStability: '퍼포안정',
    idolBalance: '아이돌밸런스',
    growthPotential: '성장가능성',
    teamAdaptation: '팀적응',
    consistencyAttitude: '꾸준함',
    longTermStarPower: '장기스타성',
  };
  return map[k] || k;
}
