// @ts-nocheck
import React from 'react';

type Judge = {
  id: string;
  name?: string;
  avatar?: string;
  accentColor?: string;
  title?: string;
};

type Props = {
  judge: Judge | null;
  text: string;
  type?: 'instruction' | 'reaction' | 'question' | 'comment' | 'result';
  isCurrent?: boolean;
  compact?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  instruction: '지시',
  question: '질문',
  reaction: '반응',
  comment: '코멘트',
  result: '결과',
};

export default function JudgeSpeechBubble({ judge, text, type = 'comment', isCurrent = false, compact = false }: Props) {
  if (!judge) return null;
  const accent = judge.accentColor || '#FF1F8E';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        animation: 'judgeBubbleIn 0.35s ease',
      }}
    >
      <div
        style={{
          width: compact ? 32 : 38,
          height: compact ? 32 : 38,
          borderRadius: '50%',
          background: '#0A0A0A',
          border: `2px solid ${accent}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: compact ? 16 : 19,
          flexShrink: 0,
          boxShadow: isCurrent ? `0 0 0 3px ${accent}55, 0 0 18px ${accent}88` : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
        aria-hidden
      >
        {judge.avatar || '🎤'}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: `${accent}1A`,
          border: `1px solid ${accent}55`,
          borderLeft: `3px solid ${accent}`,
          borderRadius: 14,
          borderTopLeftRadius: 4,
          padding: compact ? '6px 12px' : '10px 14px',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '0.05em' }}>
            {judge.name || '심사위원'}
          </span>
          {judge.title ? (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>· {judge.title}</span>
          ) : null}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.05em',
            }}
          >
            {TYPE_LABEL[type] || ''}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: compact ? 12.5 : 14,
            lineHeight: 1.45,
            wordBreak: 'break-word',
          }}
        >
          {text}
        </p>
      </div>

      <style>{`
        @keyframes judgeBubbleIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
