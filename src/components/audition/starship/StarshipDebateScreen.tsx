// @ts-nocheck
// STARSHIP 토론 화면 — 만장일치/2:1 분열 분기 + 3라운드 토론 (한승훈 최종 결정권)
// STARSHIP 고유 메타: starshipKeyword(한승훈), cameraReaction/expressionFlow(박나리),
// growthView/teamFit(최지수), starshipPhilosophyMoment, marketEvaluation, tiebreakerReason

import React, { useEffect, useState } from 'react';
import { starshipJudges } from '../../../data/starshipJudges';
import type { StarshipDebateResult, StarshipVerdict } from '../../../hooks/useStarshipAudition';

type Props = {
  debate: StarshipDebateResult | null;
  loading?: boolean;
  onContinue?: () => void;
};

const VERDICT_LABEL: Record<string, string> = {
  pass: 'PASS',
  conditional: 'CONDITIONAL',
  training_recommended: 'TRAINING',
  fail: 'FAIL',
};

const VERDICT_ACCENT: Record<string, string> = {
  pass: '#6C5CE7', // STARSHIP 퍼플
  conditional: '#A29BFE',
  training_recommended: '#636E72',
  fail: '#2D3436',
};

function getJudgeBySpeaker(name: string) {
  const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
  return starshipJudges.find((j) => norm(j.name) === norm(name));
}

export default function StarshipDebateScreen({ debate, loading, onContinue }: Props) {
  if (loading || !debate) {
    return (
      <div
        style={{
          minHeight: 320,
          display: 'grid',
          placeItems: 'center',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 14,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🌟</div>
          <p style={{ margin: 0, fontWeight: 700, letterSpacing: 1, color: '#FFFFFF' }}>
            STARSHIP 심사위원 3명이 회의 중입니다...
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 0.5,
            }}
          >
            "대중이 편하게 좋아할 수 있어야 해요. 센터는 억지로 만드는 게 아니에요."
          </p>
        </div>
      </div>
    );
  }

  const accent = VERDICT_ACCENT[debate.finalVerdict] || '#A29BFE';

  // 만장일치
  if (!debate.debateNeeded && debate.unanimousVerdict) {
    return (
      <div
        style={{
          background: '#0E0B1F',
          border: `2px solid ${accent}`,
          borderRadius: 18,
          padding: 24,
          textAlign: 'center',
          color: '#FFFFFF',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🤝</div>
        <h2 style={{ margin: '4px 0', fontSize: 18, fontWeight: 900, letterSpacing: 2 }}>
          UNANIMOUS DECISION
        </h2>
        <p
          style={{
            margin: '12px 0 16px',
            fontSize: 30,
            fontWeight: 900,
            color: accent,
            letterSpacing: 4,
          }}
        >
          {VERDICT_LABEL[debate.finalVerdict] || debate.finalVerdict}
        </p>
        {debate.starshipCoreReason && (
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              fontStyle: 'italic',
              maxWidth: 520,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.55,
            }}
          >
            "{debate.starshipCoreReason}"
          </p>
        )}
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>
          토론 없이 즉시 결과가 확정되었습니다.
        </p>
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            style={{
              marginTop: 18,
              background: accent,
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 10,
              fontWeight: 900,
              cursor: 'pointer',
              letterSpacing: 1,
            }}
          >
            결과 화면으로 이동
          </button>
        )}
      </div>
    );
  }

  // 토론 진행
  return (
    <div style={{ color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {debate.starshipCoreReason && (
        <div
          style={{
            background: 'rgba(108,92,231,0.08)',
            border: '1px solid rgba(108,92,231,0.35)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.55,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2,
              color: '#A29BFE',
              marginBottom: 4,
            }}
          >
            🌟 STARSHIP CORE REASON
          </p>
          <p style={{ margin: 0, fontStyle: 'italic' }}>"{debate.starshipCoreReason}"</p>
        </div>
      )}

      <DebateRound
        title="ROUND 1 · 개별 평가 공개"
        subtitle="한승훈(스타성) → 박나리(카메라·퍼포먼스) → 최지수(장기 성장)"
        lines={debate.debateScript?.round1 || []}
      />
      <DebateRound
        title="ROUND 2 · 충돌 토론"
        subtitle="2:1 분열 — 소수 의견부터 반론을 시작합니다"
        lines={debate.debateScript?.round2_conflict || []}
        accent="#E84393"
      />

      {debate.debateScript?.starshipPhilosophyMoment && (
        <div
          style={{
            background: 'rgba(162,155,254,0.1)',
            border: '1px dashed #A29BFE',
            borderRadius: 12,
            padding: '14px 16px',
            color: '#FFFFFF',
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
            🌟 STARSHIP PHILOSOPHY MOMENT
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1.55,
            }}
          >
            "{debate.debateScript.starshipPhilosophyMoment}"
          </p>
        </div>
      )}

      {debate.marketEvaluation && <MarketEvaluation eval={debate.marketEvaluation} />}

      <FinalVoteSection
        votes={debate.debateScript?.finalVoteDeclaration || []}
        tiebreakerUsed={!!debate.debateScript?.tiebreakerUsed}
        tiebreakerBy={debate.debateScript?.tiebreakerBy || null}
        tiebreakerLine={debate.debateScript?.tiebreakerLine || null}
        tiebreakerReason={debate.debateScript?.tiebreakerReason || null}
        finalVerdict={debate.finalVerdict}
      />

      {onContinue && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onContinue}
            style={{
              background: accent,
              color: '#FFFFFF',
              border: 'none',
              padding: '14px 32px',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 13,
              cursor: 'pointer',
              letterSpacing: 2,
            }}
          >
            최종 결과 보기
          </button>
        </div>
      )}
    </div>
  );
}

function MarketEvaluation({ eval: ev }: { eval: any }) {
  const items = [
    { key: 'publicAppeal', label: '✨ 대중 호감도', value: ev.publicAppeal },
    { key: 'centerPotential', label: '🎯 센터 가능성', value: ev.centerPotential },
    { key: 'teamBalance', label: '🤝 팀 밸런스', value: ev.teamBalance },
    { key: 'cameraFriendliness', label: '📷 카메라 친화력', value: ev.cameraFriendliness },
  ].filter((i) => !!i.value);
  if (!items.length) return null;
  return (
    <section>
      <header style={{ marginBottom: 10 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          MARKET EVALUATION · 시장성 종합 평가
        </p>
      </header>
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
            <p style={{ margin: 0, fontSize: 10, color: '#A29BFE', fontWeight: 800 }}>{it.label}</p>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.85)' }}>{it.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DebateRound({
  title,
  subtitle,
  lines,
  accent,
}: {
  title: string;
  subtitle: string;
  lines: any[];
  accent?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!lines.length) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= lines.length) clearInterval(interval);
    }, 700);
    return () => clearInterval(interval);
  }, [lines]);

  if (!lines.length) return null;

  return (
    <section>
      <header style={{ marginBottom: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            color: accent || 'rgba(255,255,255,0.55)',
          }}
        >
          {title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{subtitle}</p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lines.slice(0, visibleCount).map((entry, idx) => (
          <SpeechBubble key={`${entry.speaker}-${idx}`} entry={entry} />
        ))}
        {visibleCount < lines.length && (
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              fontStyle: 'italic',
              letterSpacing: 1,
            }}
          >
            ...
          </p>
        )}
      </div>
    </section>
  );
}

function SpeechBubble({ entry }: { entry: any }) {
  const judge = getJudgeBySpeaker(entry.speaker);
  const accent = judge?.accentColor || '#FFFFFF';

  const meta: { icon: string; label: string }[] = [];
  if (entry.starshipKeyword) meta.push({ icon: '🌟', label: entry.starshipKeyword });
  if (entry.cameraReaction) meta.push({ icon: '📷', label: entry.cameraReaction });
  if (entry.expressionFlow) meta.push({ icon: '😊', label: entry.expressionFlow });
  if (entry.growthView) meta.push({ icon: '📈', label: entry.growthView });
  if (entry.teamFit) meta.push({ icon: '🤝', label: entry.teamFit });

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        animation: 'starship-debate-fade 350ms ease-out',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#0E0B1F',
          border: `2px solid ${accent}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {judge?.avatar || '🎤'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: accent }}>{entry.speaker}</p>
          {meta.map((m, idx) => (
            <span
              key={`${m.label}-${idx}`}
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: 6,
                letterSpacing: 0.4,
                maxWidth: 240,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.icon} {m.label}
            </span>
          ))}
        </div>
        <div
          style={{
            marginTop: 4,
            background: 'rgba(255,255,255,0.06)',
            borderLeft: `3px solid ${accent}`,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            lineHeight: 1.55,
            color: '#FFFFFF',
          }}
        >
          {entry.line}
        </div>
      </div>
      <style>{`
        @keyframes starship-debate-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function FinalVoteSection({
  votes,
  tiebreakerUsed,
  tiebreakerBy,
  tiebreakerLine,
  tiebreakerReason,
  finalVerdict,
}: {
  votes: { speaker: string; vote: string; line: string }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerLine?: string | null;
  tiebreakerReason?: string | null;
  finalVerdict: StarshipVerdict | string;
}) {
  if (!votes.length) return null;
  return (
    <section>
      <header style={{ marginBottom: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          ROUND 3 · 최종 투표 발표
        </p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {votes.map((v, idx) => {
          const judge = getJudgeBySpeaker(v.speaker);
          const accent = judge?.accentColor || '#FFFFFF';
          return (
            <div
              key={`${v.speaker}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <span style={{ fontSize: 18 }}>{judge?.avatar || '🎤'}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 96 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{v.speaker}</span>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '4px 10px',
                  background: VERDICT_ACCENT[v.vote] || 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  borderRadius: 8,
                  letterSpacing: 1,
                }}
              >
                {VERDICT_LABEL[v.vote] || v.vote}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.7)',
                  fontStyle: 'italic',
                }}
              >
                "{v.line}"
              </span>
            </div>
          );
        })}
      </div>
      {tiebreakerUsed && (
        <div
          style={{
            marginTop: 14,
            background: 'rgba(108,92,231,0.15)',
            border: '1px dashed #6C5CE7',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 12,
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p style={{ margin: 0 }}>
            🎬 <strong>{tiebreakerBy || '한승훈'}</strong> 프로듀서의 최종 결정권 행사 →{' '}
            <strong style={{ color: VERDICT_ACCENT[finalVerdict as string] || '#A29BFE' }}>
              {VERDICT_LABEL[finalVerdict as string] || finalVerdict}
            </strong>
          </p>
          {tiebreakerLine && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.85)',
                paddingLeft: 18,
                borderLeft: '2px solid #6C5CE7',
              }}
            >
              "{tiebreakerLine}"
            </p>
          )}
          {tiebreakerReason && (
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
              근거: {tiebreakerReason}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
