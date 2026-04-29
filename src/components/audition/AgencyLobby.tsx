// @ts-nocheck
import React from 'react';

export default function AgencyLobby({ agency, ticketNumber, onStart, onBack }) {
  if (!agency) return null;
  return (
    <div
      style={{
        minHeight: '100%',
        background: agency.primaryColor,
        padding: 'clamp(20px, 5vw, 40px) clamp(14px, 4vw, 24px)',
        boxSizing: 'border-box',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 600 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#FFFFFF',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 12,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          ← 기획사 다시 선택
        </button>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 'clamp(56px, 14vw, 72px)', lineHeight: 1, marginBottom: 12 }}>
            {agency.logo}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(26px, 7vw, 36px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            {agency.name}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            {agency.subName}
          </p>
        </div>

        <div
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: `2px solid ${agency.accentColor}`,
            borderRadius: 24,
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: `0 0 30px ${agency.accentColor}55`,
            marginBottom: 28,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: '0.2em',
              color: agency.accentColor,
              fontWeight: 700,
            }}
          >
            오디션 대기번호
          </p>
          <p
            style={{
              margin: '12px 0',
              fontSize: 'clamp(40px, 12vw, 56px)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: '#FFFFFF',
              fontFamily: "'Poppins', system-ui, sans-serif",
            }}
          >
            #{ticketNumber}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              fontStyle: 'italic',
            }}
          >
            "{agency.slogan}"
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          style={{
            width: '100%',
            background: agency.accentColor,
            color: '#0A0A0A',
            border: 'none',
            padding: '16px 24px',
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          오디션 시작하기 →
        </button>
      </div>
    </div>
  );
}
