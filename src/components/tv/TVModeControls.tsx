// @ts-nocheck
import React from 'react';
import type { Agency } from '../../types/tv';

export function TVModeControls({
  agency,
  agencyColor,
  sessionTime,
  isTracking,
  onToggleTracking,
}: {
  agency: Agency;
  agencyColor: string;
  sessionTime: number;
  isTracking?: boolean;
  onToggleTracking?: () => void;
}) {
  const mins = Math.floor(sessionTime / 60)
    .toString()
    .padStart(2, '0');
  const secs = (sessionTime % 60).toString().padStart(2, '0');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: agencyColor,
            boxShadow: `0 0 10px ${agencyColor}`,
            animation: 'tv-pulse 2s infinite',
          }}
        />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {agency.toUpperCase()} AI 트레이닝 진행 중
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {onToggleTracking && (
          <button
            type="button"
            onClick={onToggleTracking}
            style={{
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${isTracking ? '#00FF88' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 8,
              color: isTracking ? '#00FF88' : 'rgba(255,255,255,0.6)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {isTracking ? '● REC' : '카메라'}
          </button>
        )}
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.1em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {mins}:{secs}
        </div>
      </div>
    </div>
  );
}

export default TVModeControls;
