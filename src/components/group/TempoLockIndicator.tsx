// @ts-nocheck
import React from 'react';

export function TempoLockIndicator({
  isRunning,
  currentTime,
  totalDuration,
}: {
  isRunning: boolean;
  currentTime: number;
  totalDuration: number;
}) {
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 18px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        borderRadius: 30,
        border: '1px solid rgba(255,68,68,0.3)',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isRunning ? '#FF4444' : '#666',
          boxShadow: isRunning ? '0 0 8px #FF4444' : 'none',
          animation: isRunning ? 'tempoPulse 1s infinite' : 'none',
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#FF4444',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}
      >
        실시간 진행 중 · 일시정지 불가
      </span>
      <div
        style={{
          width: 100,
          height: 3,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: '#FF4444',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {Math.floor(currentTime)}s / {Math.floor(totalDuration)}s
      </span>
      <style>{`
        @keyframes tempoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default TempoLockIndicator;
