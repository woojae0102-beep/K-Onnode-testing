// @ts-nocheck
import React from 'react';
import type { StageAiDebugInfo } from '../../utils/stageAiDebugUtils';

/** 3D 스테이지 AI 렌더 디버그 패널 (항상 표시) */
export function StageAiDebugOverlay({ info }: { info: StageAiDebugInfo }) {
  const rows = [
    ['AI Avatar Count', info.aiAvatarCount],
    ['Frame Number', info.frameNumber >= 0 ? `${info.frameNumber} / ${info.totalFrames}` : 'N/A'],
    ['Current Time', `${info.currentTime.toFixed(2)}s`],
    ['Member Count', info.memberCount],
    ['Joint Count', info.jointCount],
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        left: 10,
        zIndex: 28,
        pointerEvents: 'none',
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.78)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.85)',
        minWidth: 168,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#7DD3FC' }}>Stage AI Debug</div>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}: </span>
          <span>{value}</span>
        </div>
      ))}
      {info.userJointCount > 0 ? (
        <div>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>User Joints: </span>
          <span>{info.userJointCount}</span>
        </div>
      ) : null}
      {info.emptyJointMemberIds.length > 0 ? (
        <div style={{ marginTop: 4, color: '#FF8A8A', fontSize: 9 }}>
          Empty joints: {info.emptyJointMemberIds.join(', ')}
        </div>
      ) : null}
    </div>
  );
}

export default StageAiDebugOverlay;
