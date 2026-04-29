// @ts-nocheck
import React from 'react';

export default function JudgeReaction({ judge, message }) {
  if (!judge) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        animation: 'fadeIn 0.4s ease',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#0A0A0A',
          border: `2px solid ${judge.accentColor}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {judge.avatar}
      </div>
      <div
        style={{
          background: `${judge.accentColor}22`,
          border: `1px solid ${judge.accentColor}55`,
          color: '#FFFFFF',
          padding: '8px 14px',
          borderRadius: 14,
          borderTopLeftRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          maxWidth: 220,
          lineHeight: 1.3,
        }}
      >
        <p style={{ margin: 0, fontSize: 10, color: judge.accentColor, fontWeight: 700 }}>
          {judge.name}
        </p>
        <p style={{ margin: '2px 0 0' }}>{message}</p>
      </div>
    </div>
  );
}
