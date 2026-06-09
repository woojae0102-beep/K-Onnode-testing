// @ts-nocheck
import React, { useState } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { getAgencyInfo } from '../../hooks/useAgencyPersona';
import AgencyPersonaSelector from './AgencyPersonaSelector';

export function TVModeEntry({
  onStart,
  onBack,
}: {
  onStart: (agency: Agency, mode: TrainingMode) => void;
  onBack?: () => void;
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
      className="tv-mode tv-entry-screen"
      style={{
        minHeight: '100dvh',
        background: '#030308',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(24px + env(safe-area-inset-top, 0px)) 16px calc(32px + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'Inter, sans-serif',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="tv-entry-back"
          style={{
            position: 'fixed',
            top: 'calc(12px + env(safe-area-inset-top, 0px))',
            left: 12,
            zIndex: 10,
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ← 홈
        </button>
      ) : null}
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
          트레이닝
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
          기획사 AI 실시간 댄스·보컬 트레이닝
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#00FF88',
            marginTop: 10,
            padding: '6px 12px',
            background: 'rgba(0,255,136,0.08)',
            borderRadius: 8,
            display: 'inline-block',
          }}
        >
          📱 iPhone · Android 스마트폰에서도 바로 연습 가능
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
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}
        >
          {[
            { id: 'dance', label: '🕺 댄스 트레이닝', desc: '자세 분석 + 동작 교정' },
            { id: 'vocal', label: '🎤 보컬 트레이닝', desc: '음정 + 감정 표현 분석' },
            { id: 'group', label: '👥 그룹 모드', desc: 'AI 아바타와 함께 그룹 연습', badge: 'HOT' },
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
              <div style={{ fontSize: 16, color: '#fff', marginBottom: 4 }}>
                {mode.label}
                {mode.badge ? (
                  <span style={{ marginLeft: 6, fontSize: 9, color: '#FF1F8E', fontWeight: 700 }}>{mode.badge}</span>
                ) : null}
              </div>
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
          background: 'rgba(0,255,136,0.06)',
          border: '1px solid rgba(0,255,136,0.2)',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00FF88', marginBottom: 8 }}>
          ONNODE STUDIO MODE
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, margin: 0 }}>
          트레이닝 시작 후 우측 상단 <strong>「📺 TV 연결」</strong> — 10초 이내 TV 연습실 연결.
          TV 없이도 스마트폰·노트북만으로 바로 연습할 수 있습니다.
        </p>
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
