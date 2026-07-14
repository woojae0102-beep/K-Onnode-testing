// @ts-nocheck
import React from 'react';
import type { DebugPerformanceEvent, DebugRcaEvent, LiveDebugState } from './debugEventTypes';
import { PERFORMANCE_THRESHOLD_MS } from './debugEventTypes';

const METRIC: React.CSSProperties = {
  fontSize: 9,
  fontFamily: 'ui-monospace, monospace',
  color: 'rgba(255,255,255,0.55)',
};

export function LiveAnalysisBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        background: 'rgba(255, 31, 142, 0.25)',
        border: '1px solid #FF1F8E',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: '#FF8FC8',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#FF1F8E',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}
      />
      LIVE ANALYSIS
    </span>
  );
}

export function LiveAnalysisStatusBar({ state }: { state: LiveDebugState }) {
  if (!state.isLive) return null;
  const items = [
    ['Frame', state.currentFrameIndex],
    ['Time', `${state.currentTimestamp.toFixed(2)}s`],
    ['Coverage', `${Math.round(state.coverage * 100)}%`],
    ['Detected', state.detectedCount],
    ['Tracked', state.trackedCount],
    ['Peak', state.peakTrack],
    ['W.Queue', state.workerQueue],
    ['Dropped', state.droppedFrames],
    ['Q.Len', state.queueLength],
    ['RVFC', state.rvfcFps.toFixed(1)],
    ['MP FPS', state.mediaPipeFps.toFixed(1)],
    ['Tr FPS', state.trackingFps.toFixed(1)],
    ['Total', `${state.totalProcessingMs.toFixed(1)}ms`],
  ];
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        padding: '8px 12px',
        background: 'rgba(8, 8, 16, 0.95)',
        border: '1px solid rgba(255, 31, 142, 0.3)',
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      {items.map(([k, v]) => (
        <span key={k as string} style={METRIC}>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>{k}: </span>
          <span style={{ color: '#fff' }}>{v}</span>
        </span>
      ))}
    </div>
  );
}

export function LiveRcaLog({ entries }: { entries: DebugRcaEvent[] }) {
  if (!entries.length) {
    return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>실시간 RCA 로그 대기 중...</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
      {entries.slice(0, 30).map((e, i) => (
        <div
          key={`${e.frameIndex}-${i}`}
          style={{
            padding: 8,
            borderRadius: 6,
            fontSize: 9,
            fontFamily: 'ui-monospace, monospace',
            border: `1px solid ${e.severity === 'critical' ? 'rgba(255,68,68,0.4)' : 'rgba(255,200,0,0.25)'}`,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ color: '#FF8FC8', fontWeight: 600 }}>Frame {e.frameIndex}</div>
          {e.coverage != null ? <div>Coverage {Math.round(e.coverage * 100)}%</div> : null}
          <div style={{ color: '#fff' }}>{e.problem}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)' }}>Reason: {e.reason}</div>
          {e.evidence.map((ev, j) => (
            <div key={j} style={{ color: 'rgba(255,255,255,0.45)', paddingLeft: 6 }}>• {ev}</div>
          ))}
          <div style={{ color: '#6EE7B7', marginTop: 4 }}>→ {e.suggestedCause}</div>
        </div>
      ))}
    </div>
  );
}

export function LivePerformanceChart({ ring }: { ring: DebugPerformanceEvent[] }) {
  const w = 280;
  const h = 100;
  const data = ring.slice(-120);
  if (!data.length) return <EmptyChart label="Performance 데이터 수집 중..." />;

  const maxMs = Math.max(...data.map((d) => d.totalMs), PERFORMANCE_THRESHOLD_MS, 1);
  const series = [
    { key: 'mediaPipeMs', color: '#FF6B9D', label: 'MP' },
    { key: 'trackingMs', color: '#6EE7B7', label: 'Tr' },
    { key: 'hungarianMs', color: '#FFD700', label: 'Hu' },
    { key: 'kalmanMs', color: '#88CCFF', label: 'Ka' },
    { key: 'workerMs', color: '#A78BFA', label: 'Wk' },
    { key: 'totalMs', color: '#FF1F8E', label: 'Tot' },
  ];

  const paths = series.map(({ key, color }) => {
    const pts = data.map((d, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - ((d[key] ?? 0) / maxMs) * h;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
    return { key, color, pts };
  });

  const thresholdY = h - (PERFORMANCE_THRESHOLD_MS / maxMs) * h;

  return (
    <div>
      <svg width={w} height={h} style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 6, width: '100%' }}>
        <line x1={0} y1={thresholdY} x2={w} y2={thresholdY} stroke="rgba(255,68,68,0.5)" strokeDasharray="4 3" />
        {paths.map((p) => (
          <path key={p.key} d={p.pts} fill="none" stroke={p.color} strokeWidth={p.key === 'totalMs' ? 2 : 1} opacity={0.85} />
        ))}
        {data.map((d, i) => {
          if (d.totalMs <= PERFORMANCE_THRESHOLD_MS) return null;
          const x = (i / Math.max(1, data.length - 1)) * w;
          const y = h - (d.totalMs / maxMs) * h;
          return <circle key={i} cx={x} cy={y} r={2} fill="#FF4444" />;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <span key={s.key} style={{ fontSize: 8, color: s.color, fontFamily: 'monospace' }}>{s.label}</span>
        ))}
        <span style={{ fontSize: 8, color: 'rgba(255,68,68,0.8)' }}>— threshold {PERFORMANCE_THRESHOLD_MS}ms</span>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', padding: 12 }}>{label}</div>;
}
