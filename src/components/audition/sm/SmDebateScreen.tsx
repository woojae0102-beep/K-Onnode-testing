// @ts-nocheck
// SM 토론 화면 — 거부권/이의 제기/강력 반대/만장일치 분기 + 3라운드 토론

import React, { useEffect, useState } from 'react';
import { smJudges } from '../../../data/smJudges';
import type { SmDebateResult } from '../../../hooks/useSmAudition';

type Props = {
  debate: SmDebateResult | null;
  loading?: boolean;
  onContinue?: () => void;
};

const VERDICT_LABEL: Record<string, string> = {
  pass: '합격',
  conditional: '조건부',
  pending: '보류',
  fail: '불합격',
};

const VERDICT_COLOR: Record<string, string> = {
  pass: '#1A237E',
  conditional: '#E91E63',
  pending: '#00BCD4',
  fail: '#636E72',
};

function getJudgeBySpeaker(name: string) {
  return smJudges.find((j) => j.name === name || j.name.replace(' ', '') === name.replace(' ', ''));
}

export default function SmDebateScreen({ debate, loading, onContinue }: Props) {
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
          <div style={{ fontSize: 44, marginBottom: 12 }}>💭</div>
          <p style={{ margin: 0, fontWeight: 700 }}>SM 심사위원 3명이 평의 중입니다...</p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            비주얼 vs 보컬 vs 글로벌 — 30년 SM 안목으로 토론합니다
          </p>
        </div>
      </div>
    );
  }

  // 거부권 발동 (이성호) → 보류 + 타사 추천
  if (debate.vetoApplied) {
    const vetoJudge = smJudges.find((j) => j.id === debate.vetoBy) || smJudges[0];
    return (
      <div
        style={{
          background: '#0A0A1F',
          border: '2px solid #FF4757',
          borderRadius: 18,
          padding: 24,
          textAlign: 'center',
          color: '#FFFFFF',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
        <h2 style={{ margin: '4px 0', fontSize: 20, fontWeight: 900, color: '#FF4757' }}>
          거부권 자동 발동 — 보류 + 타사 추천
        </h2>
        <p style={{ margin: '8px 0 4px', fontWeight: 700 }}>
          {vetoJudge.avatar} {vetoJudge.name} 총괄
        </p>
        <p style={{ margin: '8px 0 16px', fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
          {debate.vetoReason}
        </p>
        {debate.recommendOtherAgency && (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#FFB400' }}>
            SM의 비주얼 기준에 미달입니다. 타 기획사를 먼저 권해드립니다.
          </p>
        )}
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            style={{
              background: '#FF4757',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            결과 화면으로 이동
          </button>
        )}
      </div>
    );
  }

  // 만장일치
  if (!debate.debateNeeded && debate.unanimousVerdict) {
    return (
      <div
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: `2px solid ${VERDICT_COLOR[debate.finalVerdict]}`,
          borderRadius: 18,
          padding: 24,
          textAlign: 'center',
          color: '#FFFFFF',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>🤝</div>
        <h2 style={{ margin: '4px 0', fontSize: 20, fontWeight: 900 }}>만장일치 결정</h2>
        <p
          style={{
            margin: '12px 0 16px',
            fontSize: 26,
            fontWeight: 900,
            color: VERDICT_COLOR[debate.finalVerdict],
          }}
        >
          {VERDICT_LABEL[debate.finalVerdict] || debate.finalVerdict}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          토론 없이 즉시 결과가 확정되었습니다.
        </p>
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            style={{
              marginTop: 16,
              background: VERDICT_COLOR[debate.finalVerdict],
              color: '#FFFFFF',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 10,
              fontWeight: 800,
              cursor: 'pointer',
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
      {(debate.yujinObjectionApplied || debate.seoyoungOppositionApplied) && (
        <div
          style={{
            background: 'rgba(255,180,0,0.12)',
            border: '1px solid rgba(255,180,0,0.4)',
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            color: '#FFE08A',
          }}
        >
          {debate.yujinObjectionApplied && (
            <p style={{ margin: 0 }}>🛑 최유진 디렉터의 이의 제기가 적용되었습니다 — 발성 기초 부족.</p>
          )}
          {debate.seoyoungOppositionApplied && (
            <p style={{ margin: '4px 0 0' }}>🌐 박서영 디렉터의 강력 반대가 적용되었습니다 — 글로벌 부적합.</p>
          )}
        </div>
      )}

      <DebateRound
        title="ROUND 1 · 개별 평가 공개"
        subtitle="각 심사위원이 자기 관점으로 평가를 발표합니다"
        lines={debate.debateScript?.round1 || []}
      />
      <DebateRound
        title="ROUND 2 · 의견 충돌 토론"
        subtitle="2:1 분열 — 소수 의견부터 반론을 시작합니다"
        lines={debate.debateScript?.round2_conflict || []}
        accent="#E91E63"
      />
      <FinalVoteSection
        votes={debate.debateScript?.finalVoteDeclaration || []}
        tiebreakerUsed={!!debate.debateScript?.tiebreakerUsed}
        tiebreakerBy={debate.debateScript?.tiebreakerBy || null}
        tiebreakerLine={debate.debateScript?.tiebreakerLine || null}
        finalVerdict={debate.finalVerdict}
      />

      {onContinue && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onContinue}
            style={{
              background: VERDICT_COLOR[debate.finalVerdict] || '#1A237E',
              color: '#FFFFFF',
              border: 'none',
              padding: '14px 32px',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            최종 결과 보기
          </button>
        </div>
      )}
    </div>
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
  lines: { speaker: string; line: string }[];
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
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            ...
          </p>
        )}
      </div>
    </section>
  );
}

function SpeechBubble({
  entry,
}: {
  entry: { speaker: string; line: string; silenceBefore?: number; immediateReaction?: boolean; tabletDown?: boolean };
}) {
  const judge = getJudgeBySpeaker(entry.speaker);
  const accent = judge?.accentColor || '#FFFFFF';

  // 메타데이터 칩 빌드
  const meta: { icon: string; label: string }[] = [];
  if (entry.silenceBefore && entry.silenceBefore > 0) {
    meta.push({ icon: '⏸', label: `침묵 ${entry.silenceBefore}초` });
  }
  if (entry.immediateReaction) {
    meta.push({ icon: '⚡', label: '즉각 반응' });
  }
  if (entry.tabletDown) {
    meta.push({ icon: '📱', label: '태블릿 내려놓고' });
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        animation: 'sm-debate-fade 350ms ease-out',
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
          {meta.map((m) => (
            <span
              key={m.label}
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 6px',
                borderRadius: 6,
                letterSpacing: 0.4,
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
        @keyframes sm-debate-fade {
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
  finalVerdict,
}: {
  votes: { speaker: string; vote: string; line: string; silenceBefore?: number }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerLine?: string | null;
  finalVerdict: string;
}) {
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
                <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>
                  {v.speaker}
                </span>
                {v.silenceBefore && v.silenceBefore > 0 ? (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                    ⏸ 침묵 {v.silenceBefore}초
                  </span>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '4px 10px',
                  background: VERDICT_COLOR[v.vote] || 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  borderRadius: 8,
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
            background: 'rgba(26,35,126,0.25)',
            border: '1px dashed #1A237E',
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
            ⚖️ <strong>{tiebreakerBy || '이성호'}</strong> 총괄의 최종 결정권 행사 →{' '}
            <strong style={{ color: VERDICT_COLOR[finalVerdict] || '#FFFFFF' }}>
              {VERDICT_LABEL[finalVerdict] || finalVerdict}
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
                borderLeft: '2px solid #1A237E',
              }}
            >
              "{tiebreakerLine}"
            </p>
          )}
        </div>
      )}
    </section>
  );
}
