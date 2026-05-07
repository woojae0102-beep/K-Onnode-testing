// @ts-nocheck
// 3명의 HYBE 심사위원을 동시에 표시하는 패널
// 실시간 반응(currentReaction.speaking)을 말풍선으로 보여주고, accentColor로 구분

import React from 'react';
import { hybeJudges, type HybeJudgeMeta } from '../../../data/hybeJudges';
import type { JudgeReaction, JudgeId } from '../../../hooks/useHybeAudition';

type Props = {
  reactions: Record<JudgeId, JudgeReaction | null>;
  highlightJudgeId?: JudgeId | null;
};

export default function HybeJudgePanel({ reactions, highlightJudgeId }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        width: '100%',
      }}
    >
      {hybeJudges.map((judge) => (
        <JudgeCard
          key={judge.id}
          judge={judge}
          reaction={reactions[judge.id] || null}
          highlighted={highlightJudgeId === judge.id}
        />
      ))}
    </div>
  );
}

function JudgeCard({
  judge,
  reaction,
  highlighted,
}: {
  judge: HybeJudgeMeta;
  reaction: JudgeReaction | null;
  highlighted: boolean;
}) {
  const speaking = reaction?.speaking?.trim();
  const veto = !!reaction?.vetoTriggered;
  const score = Number(reaction?.scores?.total ?? 0);

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: `2px solid ${highlighted ? judge.accentColor : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 18,
        padding: 14,
        position: 'relative',
        boxShadow: highlighted ? `0 0 24px ${judge.accentColor}66` : 'none',
        transition: 'box-shadow 280ms ease, border-color 280ms ease',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#0A0A0A',
            border: `2px solid ${judge.accentColor}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
          }}
        >
          {judge.avatar}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 800,
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {judge.name}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              color: judge.accentColor,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {judge.title}
          </p>
        </div>
        {Number.isFinite(score) && score > 0 && (
          <div
            style={{
              background: judge.accentColor,
              color: '#0A0A0A',
              padding: '3px 8px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {score}
          </div>
        )}
      </div>

      {/* 말풍선 */}
      <div
        style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '10px 12px',
          minHeight: 56,
          fontSize: 13,
          color: speaking ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
          lineHeight: 1.45,
          fontStyle: speaking ? 'normal' : 'italic',
        }}
      >
        {speaking || '대기 중...'}
      </div>

      {/* 거부권 발동 뱃지 */}
      {veto && (
        <div
          style={{
            marginTop: 10,
            background: '#FF4757',
            color: '#FFFFFF',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>⚠️</span>
          <span>거부권 발동</span>
        </div>
      )}

      {/* 시그니처 */}
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 10,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.4,
        }}
      >
        "{judge.catchphrase}"
      </p>
    </div>
  );
}
