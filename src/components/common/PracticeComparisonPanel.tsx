// @ts-nocheck
import React from 'react';

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export default function PracticeComparisonPanel({ comparison, accent = '#FF1F8E', dark = false }) {
  if (!comparison?.previousDate) return null;

  const textMuted = dark ? 'rgba(255,255,255,0.45)' : '#888';
  const textMain = dark ? 'rgba(255,255,255,0.85)' : '#333';
  const bg = dark ? 'rgba(255,255,255,0.04)' : '#fff';
  const border = dark ? 'rgba(255,255,255,0.08)' : '#E5E5E5';

  const delta = comparison.overallDelta;
  const deltaColor = delta > 0 ? '#00B894' : delta < 0 ? '#FF4757' : textMuted;
  const deltaSign = delta > 0 ? '+' : '';

  return (
    <section
      style={{
        marginBottom: 20,
        padding: 16,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>
          이전 연습과 비교
        </h3>
        <span style={{ fontSize: 11, color: textMuted }}>
          {formatDate(comparison.previousDate)} 기준
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: '10px 14px',
          background: dark ? 'rgba(255,255,255,0.03)' : '#F8F8FA',
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 12, color: textMuted }}>종합</span>
        <span style={{ fontSize: 14, color: textMuted }}>{comparison.previousOverall}</span>
        <span style={{ color: textMuted }}>→</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: accent }}>{comparison.currentOverall}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor }}>
          {deltaSign}{delta}점
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: textMuted }}>
          {comparison.sessionCount}회차 연습
        </span>
      </div>

      {comparison.improved?.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#00B894' }}>✓ 개선된 점</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: textMain, lineHeight: 1.6 }}>
            {comparison.improved.map((item, i) => (
              <li key={`imp-${i}`}>
                {item.text ||
                  `${item.label}: ${item.previous ?? '-'} → ${item.current}${item.delta ? ` (+${item.delta})` : ''}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {comparison.stillWeak?.length > 0 ? (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#FF9F43' }}>△ 아직 부족한 점</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: textMain, lineHeight: 1.6 }}>
            {comparison.stillWeak.map((item, i) => (
              <li key={`weak-${i}`}>
                {item.text ||
                  `${item.label}: ${item.current}점${item.delta ? ` (이전 대비 ${item.delta > 0 ? '+' : ''}${item.delta})` : ''}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
