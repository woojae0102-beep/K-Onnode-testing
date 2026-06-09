// @ts-nocheck
import React from 'react';

const STEPS = [
  '영상에서 각 멤버의 관절 좌표 추출',
  '각 멤버별 동선 데이터 분리',
  'AI 아바타 스켈레톤 생성',
  '실시간 동기화 시스템 준비',
];

export function SkeletonExtractor({ progress, step, memberCount }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
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
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(255,31,142,0.1)',
          border: '2px solid rgba(255,31,142,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 40,
          marginBottom: 32,
          position: 'relative',
        }}
      >
        🦴
        <div
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#FF1F8E',
            animation: 'groupSpin 1s linear infinite',
          }}
        />
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#fff',
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        {memberCount}명의 동작을 학습하고 있어요
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        {step}
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 320,
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #FF1F8E, #6C5CE7)',
            borderRadius: 2,
            transition: 'width 0.3s',
            boxShadow: '0 0 12px rgba(255,31,142,0.6)',
          }}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: '#FF1F8E', fontWeight: 600 }}>
        {progress}%
      </div>

      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background:
                  progress > (i + 1) * 25
                    ? '#00FF88'
                    : progress > i * 25
                      ? 'rgba(255,31,142,0.3)'
                      : 'rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                transition: 'all 0.3s',
              }}
            >
              {progress > (i + 1) * 25 ? '✓' : i + 1}
            </div>
            <span
              style={{
                fontSize: 12,
                color: progress > i * 25 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <style>{`@keyframes groupSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default SkeletonExtractor;
