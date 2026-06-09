// @ts-nocheck
import React from 'react';

export default function PracticeResultActions({
  onRetry,
  onHome,
  retryLabel = '다시 연습하기',
  homeLabel = '홈으로',
  accent = '#FF1F8E',
  dark = true,
  layout = 'row',
}) {
  const primaryStyle = dark
    ? {
        flex: 1,
        padding: '14px 20px',
        background: accent,
        border: 'none',
        borderRadius: 50,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: `0 0 24px ${accent}40`,
      }
    : {
        flex: 1,
        padding: '14px 20px',
        background: accent,
        border: 'none',
        borderRadius: 12,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
      };

  const secondaryStyle = dark
    ? {
        flex: 1,
        padding: '14px 20px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 50,
        color: 'rgba(255,255,255,0.75)',
        fontSize: 15,
        cursor: 'pointer',
      }
    : {
        flex: 1,
        padding: '14px 20px',
        background: '#fff',
        border: '1px solid #E5E5E5',
        borderRadius: 12,
        color: '#555',
        fontSize: 15,
        cursor: 'pointer',
      };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout === 'column' ? 'column' : 'row',
        gap: 12,
        marginTop: 8,
      }}
    >
      {onRetry ? (
        <button type="button" onClick={onRetry} style={primaryStyle}>
          {retryLabel}
        </button>
      ) : null}
      {onHome ? (
        <button type="button" onClick={onHome} style={secondaryStyle}>
          {homeLabel}
        </button>
      ) : null}
    </div>
  );
}
