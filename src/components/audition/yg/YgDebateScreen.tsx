// @ts-nocheck
// YG 토론 화면 — 만장일치/2:1 분열 분기 + 3라운드 토론 (양태준 최종 결정권)
// YG 고유 메타: silenceAfter/ygKeyword(양태준), cameraReaction/stagePresence(이나래),
// englishComment/globalView(Marcus), ygPhilosophyMoment, tiebreakerReason

import React, { useEffect, useState } from 'react';
import { ygJudges } from '../../../data/ygJudges';
import type { YgDebateResult, YgVerdict } from '../../../hooks/useYgAudition';

type Props = {
  debate: YgDebateResult | null;
  loading?: boolean;
  onContinue?: () => void;
};

const VERDICT_LABEL: Record<string, string> = {
  pass: 'PASS',
  hold: 'HOLD',
  training_recommended: 'TRAINING',
  fail: 'FAIL',
};

const VERDICT_COLOR: Record<string, string> = {
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

function getJudgeBySpeaker(name: string) {
  const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
  return ygJudges.find((j) => norm(j.name) === norm(name));
}

export default function YgDebateScreen({ debate, loading, onContinue }: Props) {
  if (loading || !debate) {
    return (
      <div
        style={{
          minHeight: 320,
          display: 'grid',
          placeItems: 'center',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 14,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🖤</div>
          <p style={{ margin: 0, fontWeight: 700, letterSpacing: 1 }}>
            YG 심사위원 3명이 회의 중입니다...
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 0.5,
            }}
          >
            "잘하는 애는 많아. 근데 스타는 별로 없어."
          </p>
        </div>
      </div>
    );
  }

  // 만장일치
  if (!debate.debateNeeded && debate.unanimousVerdict) {
    const verdictColor = VERDICT_COLOR[debate.finalVerdict] || '#2F3640';
    const verdictAccent = VERDICT_ACCENT[debate.finalVerdict] || '#FFFFFF';
    return (
      <div
        style={{
          background: '#0A0A0A',
          border: `2px solid ${verdictAccent}`,
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
            color: verdictAccent,
            letterSpacing: 4,
          }}
        >
          {VERDICT_LABEL[debate.finalVerdict] || debate.finalVerdict}
        </p>
        {debate.ygCoreReason && (
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.65)',
              fontStyle: 'italic',
              maxWidth: 520,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.55,
            }}
          >
            "{debate.ygCoreReason}"
          </p>
        )}
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>
          토론 없이 즉시 결과가 확정되었습니다.
        </p>
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            style={{
              marginTop: 18,
              background: verdictAccent,
              color: '#000000',
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
      {debate.ygCoreReason && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 12,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.55,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2,
              color: '#FFD700',
              marginBottom: 4,
            }}
          >
            ⚡ YG CORE REASON
          </p>
          <p style={{ margin: 0, fontStyle: 'italic' }}>"{debate.ygCoreReason}"</p>
        </div>
      )}

      <DebateRound
        title="ROUND 1 · 개별 평가 공개"
        subtitle="양태준(스타성) → 이나래(퍼포먼스) → Marcus(글로벌)"
        lines={debate.debateScript?.round1 || []}
      />
      <DebateRound
        title="ROUND 2 · 충돌 토론"
        subtitle="2:1 분열 — 소수 의견부터 반론을 시작합니다"
        lines={debate.debateScript?.round2_conflict || []}
        accent="#FF4757"
      />

      {debate.debateScript?.ygPhilosophyMoment && (
        <div
          style={{
            background: 'rgba(255,215,0,0.08)',
            border: '1px dashed #FFD700',
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
              lineHeight: 1.55,
            }}
          >
            "{debate.debateScript.ygPhilosophyMoment}"
          </p>
        </div>
      )}

      {debate.finalMarketEvaluation && <MarketEvaluation eval={debate.finalMarketEvaluation} />}

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
              background: VERDICT_ACCENT[debate.finalVerdict] || '#FFD700',
              color: '#000000',
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
    { key: 'koreaMarket', label: '🇰🇷 한국 시장', value: ev.koreaMarket },
    { key: 'globalMarket', label: '🌍 글로벌 시장', value: ev.globalMarket },
    { key: 'fanAttraction', label: '✨ 팬덤 흡입력', value: ev.fanAttraction },
    { key: 'viralPotential', label: '🔥 바이럴 가능성', value: ev.viralPotential },
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
            color: 'rgba(255,255,255,0.5)',
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
            <p style={{ margin: 0, fontSize: 10, color: '#FFD700', fontWeight: 800 }}>{it.label}</p>
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
            color: accent || 'rgba(255,255,255,0.5)',
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

  // YG 고유 메타데이터 칩
  const meta: { icon: string; label: string }[] = [];
  if (entry.silenceAfter) meta.push({ icon: '🤫', label: '침묵' });
  if (entry.ygKeyword) meta.push({ icon: '⚡', label: entry.ygKeyword });
  if (entry.cameraReaction) meta.push({ icon: '📷', label: entry.cameraReaction });
  if (entry.stagePresence) meta.push({ icon: '🎭', label: entry.stagePresence });
  if (entry.englishComment) meta.push({ icon: '🌐', label: entry.englishComment });
  if (entry.globalView) meta.push({ icon: '🌍', label: entry.globalView });

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        animation: 'yg-debate-fade 350ms ease-out',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#0A0A0A',
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
                color: 'rgba(255,255,255,0.55)',
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
        @keyframes yg-debate-fade {
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
  finalVerdict: YgVerdict | string;
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
            color: 'rgba(255,255,255,0.5)',
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
                  color: '#000000',
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
            background: 'rgba(255,215,0,0.12)',
            border: '1px dashed #FFD700',
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
            🎬 <strong>{tiebreakerBy || '양태준'}</strong> 프로듀서의 최종 결정권 행사 →{' '}
            <strong style={{ color: VERDICT_ACCENT[finalVerdict as string] || '#FFD700' }}>
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
                borderLeft: '2px solid #FFD700',
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
