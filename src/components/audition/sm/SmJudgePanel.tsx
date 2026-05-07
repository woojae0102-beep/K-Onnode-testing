// @ts-nocheck
// 3명의 SM 심사위원을 동시에 표시하는 패널
// 거부권(이성호) / 이의 제기(최유진) / 강력 반대(박서영) 모두 시각화

import React from 'react';
import { smJudges, type SmJudgeMeta } from '../../../data/smJudges';
import type { SmJudgeReaction, SmJudgeId } from '../../../hooks/useSmAudition';

type Props = {
  reactions: Record<SmJudgeId, SmJudgeReaction | null>;
  highlightJudgeId?: SmJudgeId | null;
};

export default function SmJudgePanel({ reactions, highlightJudgeId }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        width: '100%',
      }}
    >
      {smJudges.map((judge) => (
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
  judge: SmJudgeMeta;
  reaction: SmJudgeReaction | null;
  highlighted: boolean;
}) {
  const speaking = reaction?.speaking?.trim();
  const veto = !!reaction?.vetoTriggered;
  const objection = !!reaction?.objectionRaised;
  const opposition = !!reaction?.strongOpposition;
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
          <span>거부권 발동 (보류 + 타사 추천)</span>
        </div>
      )}

      {objection && (
        <div
          style={{
            marginTop: 10,
            background: '#FF8B3D',
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
          <span>🛑</span>
          <span>이의 제기 (발성 교정 불가)</span>
        </div>
      )}

      {opposition && (
        <div
          style={{
            marginTop: 10,
            background: '#FFB400',
            color: '#0A0A0A',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🌐</span>
          <span>강력 반대 (글로벌 부적합)</span>
        </div>
      )}

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
