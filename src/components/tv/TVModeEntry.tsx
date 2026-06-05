// @ts-nocheck
import React, { useState } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { getAgencyInfo } from '../../hooks/useAgencyPersona';
import AgencyPersonaSelector from './AgencyPersonaSelector';

export function TVModeEntry({
  onStart,
}: {
  onStart: (agency: Agency, mode: TrainingMode) => void;
}) {
  const [selectedAgency, setSelectedAgency] = useState('hybe');
  const [selectedMode, setSelectedMode] = useState('dance');

  const agencyInfo = getAgencyInfo(selectedAgency);

  const handleStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen not available on some mobile browsers */
    }
    document.body.classList.add('tv-active');
    onStart(selectedAgency, selectedMode);
  };

  return (
    <div
      className="tv-mode"
      style={{
        minHeight: '100vh',
        background: '#030308',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${agencyInfo.color}18 0%, transparent 60%)`,
          transition: 'background 0.5s',
          pointerEvents: 'none',
        }}
      />

      <div style={{ textAlign: 'center', marginBottom: 48, position: 'relative' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          ONNODE AI COACH
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.02em',
          }}
        >
          TV 연습실 모드
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
          실제 기획사 연습실 AI 트레이닝 시스템
        </div>
      </div>

      <div style={{ marginBottom: 40, width: '100%', maxWidth: 560 }}>
        <AgencyPersonaSelector selected={selectedAgency} onSelect={setSelectedAgency} />

        <div
          style={{
            marginTop: 16,
            padding: '14px 18px',
            background: `${agencyInfo.color}11`,
            border: `1px solid ${agencyInfo.color}33`,
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, color: agencyInfo.color, marginBottom: 4 }}>
            {agencyInfo.artists}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            {agencyInfo.coachStyle}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 40, width: '100%', maxWidth: 560 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          훈련 모드
        </div>
        <div
          className="tv-entry-modes"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          {[
            { id: 'dance', label: '🕺 댄스 트레이닝', desc: '자세 분석 + 동작 교정' },
            { id: 'vocal', label: '🎤 보컬 트레이닝', desc: '음정 + 감정 표현 분석' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSelectedMode(mode.id)}
              style={{
                padding: '18px',
                background:
                  selectedMode === mode.id ? 'rgba(255,31,142,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${
                  selectedMode === mode.id ? '#FF1F8E' : 'rgba(255,255,255,0.08)'
                }`,
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                boxShadow:
                  selectedMode === mode.id ? '0 0 20px rgba(255,31,142,0.3)' : 'none',
              }}
            >
              <div style={{ fontSize: 16, color: '#fff', marginBottom: 4 }}>{mode.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginBottom: 40,
          width: '100%',
          maxWidth: 560,
          padding: '16px 20px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 12,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          TV 연결 방법
        </div>
        <div
          className="tv-entry-mirror"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}
        >
          {[
            { icon: '📱', label: 'iPhone', desc: 'AirPlay로\nApple TV 연결' },
            { icon: '🤖', label: 'Android', desc: '화면 미러링으로\nChromecast 연결' },
            { icon: '💻', label: 'PC/Mac', desc: 'HDMI 케이블로\nTV 직접 연결' },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
              <div style={{ fontSize: 11, color: '#fff', marginBottom: 2 }}>{item.label}</div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-line',
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleStart}
        style={{
          padding: '18px 64px',
          background: 'linear-gradient(135deg, #FF1F8E, #FF6348)',
          border: 'none',
          borderRadius: 50,
          color: '#fff',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '0.05em',
          boxShadow: '0 0 40px rgba(255,31,142,0.5)',
          transition: 'all 0.2s',
        }}
      >
        트레이닝 시작
      </button>
    </div>
  );
}

export default TVModeEntry;
