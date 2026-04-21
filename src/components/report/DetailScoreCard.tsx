// @ts-nocheck
import React from 'react';

export default function DetailScoreCard({ label, value, accent = '#FF1F8E' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      style={{
        background: '#F5F5F5',
        borderRadius: 10,
        padding: 12,
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: '#888888' }}>{label}</p>
      <p style={{ margin: '4px 0 8px', fontSize: 18, fontWeight: 500, color: '#111111' }}>{clamped}</p>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: '#E5E5E5',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            background: accent,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
}
