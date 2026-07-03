// @ts-nocheck
import React from 'react';
import type { GroupMotionEngineDebugState } from '../../types/groupMotionEngine';

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 10,
  lineHeight: 1.45,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={ROW}>
      <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <span style={{ color: highlight ? '#6EE7B7' : 'rgba(255,255,255,0.92)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Group Motion Reconstruction Engine Skeleton Debug HUD
 */
export function GroupMotionDebugOverlay({
  debug,
  visible = true,
}: {
  debug: GroupMotionEngineDebugState | null;
  visible?: boolean;
}) {
  if (!visible || !debug) return null;

  const coverage = Object.entries(debug.motionTimelineCoverage || {})
    .map(([id, v]) => `${id}:${(v * 100).toFixed(0)}%`)
    .join(' ');

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        zIndex: 40,
        pointerEvents: 'none',
        minWidth: 240,
        maxWidth: 300,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(110, 231, 183, 0.35)',
        background: 'rgba(3, 3, 8, 0.85)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.06em', marginBottom: 8 }}>
        GROUP MOTION ENGINE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Row label="Stage" value={debug.pipelineStage} highlight />
        <Row label="Frame" value={`#${debug.frameIndex} @ ${debug.timestamp.toFixed(2)}s`} />
        <Row label="Tracked" value={`${debug.visibleCount} live / ${debug.estimatedCount} est`} />
        <Row label="Track IDs" value={debug.activeTrackIds.join(',') || '—'} />
        <Row label="Pose Conf" value={debug.avgPoseConfidence.toFixed(2)} />
        <Row label="Identity Conf" value={debug.avgIdentityConfidence.toFixed(2)} />
        <Row label="Velocity" value={debug.avgMemberVelocity.toFixed(3)} />
        <Row label="Occlusion Re-ID" value={debug.occlusionRecoveries} highlight={debug.occlusionRecoveries > 0} />
        <Row label="Formation" value={debug.formationType || '—'} />
        <Row label="Transition" value={debug.formationTransition || '—'} />
        <Row label="Orientation" value={debug.orientationLabels.join(',') || '—'} />
        <Row label="Timeline" value={coverage || '—'} />
        <Row label="Interp" value={debug.interpolationActive ? 'ON' : 'off'} />
        {debug.cacheHit ? <Row label="Cache" value="HIT" highlight /> : null}
        {debug.singleDancerMode ? <Row label="Mode" value="single (no copy)" highlight /> : null}
      </div>
    </div>
  );
}

export default GroupMotionDebugOverlay;
