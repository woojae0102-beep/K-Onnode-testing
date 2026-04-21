// @ts-nocheck
import React from 'react';

export default function ScoreGauge({ value = 0, color = '#FF1F8E', size = 120, strokeWidth = 10, label = '종합 점수' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#F0F0F0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            fontWeight: 500,
            color: '#111111',
            letterSpacing: '-0.02em',
          }}
        >
          {clamped}
        </div>
      </div>
      {label ? (
        <p style={{ margin: 0, fontSize: 12, color: '#666666' }}>{label}</p>
      ) : null}
    </div>
  );
}
