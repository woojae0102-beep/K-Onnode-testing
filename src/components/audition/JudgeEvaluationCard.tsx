// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function JudgeEvaluationCard({ judge }) {
  const { t } = useTranslation();
  if (!judge) return null;
  return (
    <div
      style={{
        background: '#1A1A1A',
        border: `2px solid ${judge.accentColor}`,
        borderRadius: 16,
        padding: 18,
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: `0 4px 20px ${judge.accentColor}30`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#0A0A0A',
            border: `2px solid ${judge.accentColor}`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 28,
            flexShrink: 0,
          }}
        >
          {judge.avatar}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
            {judge.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: judge.accentColor, fontWeight: 600 }}>
            {judge.title}
          </p>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'rgba(255,255,255,0.85)',
          fontStyle: 'italic',
          lineHeight: 1.4,
          background: 'rgba(255,255,255,0.05)',
          padding: '8px 10px',
          borderRadius: 8,
          borderLeft: `3px solid ${judge.accentColor}`,
        }}
      >
        "{judge.catchphrase}"
      </p>

      <div
        style={{
          paddingTop: 10,
          borderTop: '1px solid #2A2A2A',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#888',
            fontWeight: 700,
          }}
        >
          {t('audition.evaluationPoints', { defaultValue: '평가 포인트' })}
        </p>

        {judge.evaluationPoints.map((p) => (
          <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#EEE', flex: 1 }}>
                {p.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: judge.accentColor,
                  minWidth: 32,
                  textAlign: 'right',
                }}
              >
                {p.weight}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                width: '100%',
                background: '#0A0A0A',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${p.weight}%`,
                  background: judge.accentColor,
                  borderRadius: 999,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 10,
                color: '#888',
                lineHeight: 1.4,
              }}
            >
              {p.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
