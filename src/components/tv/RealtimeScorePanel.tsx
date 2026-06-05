// @ts-nocheck
import React from 'react';
import type { Agency, ScoreData } from '../../types/tv';

const SCORE_ITEMS = [
  { key: 'rhythm', label: '리듬', icon: '🎵' },
  { key: 'posture', label: '자세', icon: '🦴' },
  { key: 'angle', label: '각도', icon: '📐' },
  { key: 'expression', label: '표현력', icon: '😊' },
  { key: 'energy', label: '에너지', icon: '⚡' },
  { key: 'stability', label: '안정성', icon: '🎯' },
];

const AGENCY_WEIGHTS = {
  jyp: { rhythm: 1.3, posture: 1.2, angle: 1.1, expression: 1.0, energy: 1.0, stability: 1.2 },
  hybe: { rhythm: 1.1, posture: 1.0, angle: 1.0, expression: 1.4, energy: 1.2, stability: 1.0 },
  sm: { rhythm: 1.1, posture: 1.2, angle: 1.3, expression: 1.2, energy: 1.0, stability: 1.1 },
  yg: { rhythm: 1.1, posture: 1.0, angle: 1.0, expression: 1.2, energy: 1.5, stability: 1.0 },
};

export function RealtimeScorePanel({
  scores,
  agency,
  agencyColor,
}: {
  scores: ScoreData;
  agency: Agency;
  agencyColor: string;
}) {
  const weights = AGENCY_WEIGHTS[agency];
  const weightedTotal =
    SCORE_ITEMS.reduce((sum, item) => {
      const raw = scores[item.key] || 0;
      const w = weights[item.key] || 1;
      return sum + raw * w;
    }, 0) / SCORE_ITEMS.length;

  const overallScore = Math.min(100, Math.round(weightedTotal));

  return (
    <div
      className="tv-panel"
      style={{
        background: '#0a0a14',
        border: `1px solid ${agencyColor}22`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
        minHeight: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${agencyColor}, transparent)`,
        }}
      />

      <div style={{ textAlign: 'center', marginBottom: 16, flexShrink: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          종합 점수
        </div>
        <div
          className="neon-text"
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: overallScore > 80 ? '#00FF88' : overallScore > 60 ? '#FFD700' : '#FF4444',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {overallScore}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>/ 100</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {SCORE_ITEMS.map((item) => {
          const score = scores[item.key] || 0;
          const weight = weights[item.key] || 1;
          const isHighlighted = weight > 1.1;

          return (
            <div key={item.key}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{item.icon}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isHighlighted ? agencyColor : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {item.label}
                    {isHighlighted && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: agencyColor, opacity: 0.7 }}>
                        ★
                      </span>
                    )}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: score > 80 ? '#00FF88' : score > 60 ? '#FFD700' : '#FF4444',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(score)}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${score}%`,
                    background:
                      score > 80
                        ? 'linear-gradient(90deg, #00FF88, #00D4FF)'
                        : score > 60
                          ? 'linear-gradient(90deg, #FFD700, #FF9800)'
                          : 'linear-gradient(90deg, #FF4444, #FF6B6B)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                    boxShadow:
                      score > 80
                        ? '0 0 8px rgba(0,255,136,0.6)'
                        : score > 60
                          ? '0 0 8px rgba(255,215,0,0.6)'
                          : '0 0 8px rgba(255,68,68,0.6)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: '10px 12px',
          background: `${agencyColor}11`,
          border: `1px solid ${agencyColor}33`,
          borderRadius: 8,
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
          {agency.toUpperCase()} 기준
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: agencyColor }}>
          상위 {overallScore > 80 ? '15%' : overallScore > 60 ? '35%' : '60%'} 수준
        </div>
      </div>
    </div>
  );
}

export default RealtimeScorePanel;
