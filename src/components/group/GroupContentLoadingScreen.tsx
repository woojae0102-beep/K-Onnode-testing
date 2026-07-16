// @ts-nocheck
import React from 'react';

export function GroupContentLoadingScreen({
  message = 'Pre-built 모션 콘텐츠 로드 중...',
  error = null,
  onBack,
}: {
  message?: string;
  error?: string | null;
  onBack?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 360,
        gap: 16,
        padding: 24,
        fontFamily: 'ui-monospace, monospace',
        color: '#fff',
      }}
    >
      {error ? (
        <>
          <div style={{ color: '#FF6B6B', fontSize: 14, fontWeight: 600 }}>콘텐츠 로드 실패</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', maxWidth: 420 }}>
            {error}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', maxWidth: 480 }}>
            Group Mode는 사전 제작된 Motion Content만 사용합니다.
            <br />
            Skeleton Extraction / MoCap API 런타임 호출은 하지 않습니다.
          </div>
          {onBack ? (
            <button type="button" onClick={onBack} style={btnStyle}>← 돌아가기</button>
          ) : null}
        </>
      ) : (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,31,142,0.25)',
              borderTopColor: '#FF1F8E',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: 13, color: '#FF1F8E' }}>{message}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            API 호출 없음 · Pre-Baked Content Only
          </div>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
};

export default GroupContentLoadingScreen;
