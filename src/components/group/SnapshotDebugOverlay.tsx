// @ts-nocheck
import React from 'react';

/**
 * snapshot이 null일 때 빈 화면 대신 디버그 상태 표시.
 * loading=true → 엔진 초기화 중, false → tick 실패 또는 데이터 없음
 */
export function SnapshotDebugOverlay({
  snapshot,
  loading = false,
  label,
}: {
  snapshot: unknown;
  loading?: boolean;
  label?: string;
}) {
  if (snapshot != null) return null;

  const title = label || (loading ? 'Loading Snapshot...' : 'Snapshot Missing');
  const detail = loading
    ? 'GroupDanceSyncEngine 초기화 중'
    : 'syncDanceStage()가 null을 반환했습니다';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        zIndex: 30,
        pointerEvents: 'none',
        background: 'rgba(3, 3, 8, 0.72)',
      }}
    >
      <div
        style={{
          padding: '14px 22px',
          borderRadius: 12,
          border: `1px solid ${loading ? 'rgba(255, 200, 0, 0.45)' : 'rgba(255, 68, 68, 0.45)'}`,
          background: loading ? 'rgba(255, 200, 0, 0.08)' : 'rgba(255, 68, 68, 0.1)',
          textAlign: 'center',
          maxWidth: '90%',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: loading ? '#FFD700' : '#FF6B6B',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5 }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

export default SnapshotDebugOverlay;
