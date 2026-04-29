// @ts-nocheck
import React from 'react';

const AGENCY_THEME = {
  hybe: { bg: '#1C1C1E', accent: '#6C5CE7', textOn: '#FFFFFF', subtle: 'minimal' },
  yg: { bg: '#1a1a1a', accent: '#FFD700', textOn: '#FFFFFF', subtle: 'classic' },
  jyp: { bg: '#FFF1ED', accent: '#FF6348', textOn: '#1A1A1A', subtle: 'warm' },
  sm: { bg: '#1A237E', accent: '#E91E63', textOn: '#FFFFFF', subtle: 'premium' },
  starship: { bg: '#2C3E50', accent: '#F39C12', textOn: '#FFFFFF', subtle: 'star' },
};

export default function AgencyCertificate({ agency, ticketNumber, score, dateString, auditionType = '종합 오디션' }) {
  if (!agency) return null;
  const theme = AGENCY_THEME[agency.id] || { bg: agency.primaryColor, accent: agency.accentColor, textOn: '#FFFFFF' };
  return (
    <div
      id="agency-certificate"
      style={{
        background: theme.bg,
        color: theme.textOn,
        border: `3px solid ${theme.accent}`,
        borderRadius: 20,
        padding: 28,
        maxWidth: 460,
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 12px 40px ${theme.accent}55`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `${theme.accent}25`,
          filter: 'blur(40px)',
        }}
      />

      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>{agency.logo}</div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: '0.3em',
            color: theme.accent,
            fontWeight: 800,
          }}
        >
          {agency.name.toUpperCase()}
        </p>
        <h2
          style={{
            margin: '8px 0 4px',
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: '-0.01em',
            color: theme.textOn,
          }}
        >
          2026 연습생 합격증
        </h2>
        <div
          style={{
            width: 60,
            height: 2,
            background: theme.accent,
            margin: '14px auto',
          }}
        />

        <table
          style={{
            width: '100%',
            fontSize: 13,
            color: theme.textOn,
            borderCollapse: 'collapse',
            margin: '8px 0',
          }}
        >
          <tbody>
            <Row label="응시번호" value={`#${ticketNumber}`} accent={theme.accent} />
            <Row label="오디션 유형" value={auditionType} accent={theme.accent} />
            <Row label="종합 점수" value={`${score}점`} accent={theme.accent} highlight />
            <Row label="날짜" value={dateString} accent={theme.accent} />
          </tbody>
        </table>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'left' }}>
            {agency.subName}
            <br />
            트레이닝 본부장
          </p>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: `2px dashed ${theme.accent}`,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
            }}
          >
            🔏
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent, highlight }) {
  return (
    <tr>
      <td
        style={{
          textAlign: 'left',
          padding: '6px 0',
          fontSize: 11,
          letterSpacing: '0.06em',
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </td>
      <td
        style={{
          textAlign: 'right',
          padding: '6px 0',
          fontWeight: highlight ? 900 : 600,
          color: highlight ? accent : 'inherit',
          fontSize: highlight ? 16 : 13,
        }}
      >
        {value}
      </td>
    </tr>
  );
}
