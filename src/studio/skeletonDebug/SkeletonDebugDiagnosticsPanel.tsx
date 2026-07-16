// @ts-nocheck
import React from 'react';
import type { SkeletonDebugLiveDiagnostics } from './types';
import type { SkeletonDebugFrameStat } from './types';
import type { PlaybackMetrics } from './render/skeletonTimelineStore';
import type { SkeletonPlaybackMode } from './render/skeletonPlaybackEngine';

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
      <span style={{ color: highlight ? '#FFD700' : 'rgba(255,255,255,0.92)', textAlign: 'right', flexShrink: 0, minWidth: 72 }}>
        {value}
      </span>
    </div>
  );
}

export function SkeletonDebugDiagnosticsPanel({
  live,
  frameStat,
  isExtracting,
  playbackMode,
  renderMetrics,
}: {
  live: SkeletonDebugLiveDiagnostics;
  frameStat: SkeletonDebugFrameStat | null;
  isExtracting: boolean;
  playbackMode: SkeletonPlaybackMode;
  renderMetrics?: PlaybackMetrics | null;
}) {
  const d = live || {};
  const f = frameStat;
  const r = renderMetrics;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        overflowY: 'auto',
        padding: '12px 14px',
        background: 'rgba(3, 3, 8, 0.95)',
        border: '1px solid rgba(255, 31, 142, 0.25)',
        borderRadius: 10,
        color: '#fff',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#FF1F8E', letterSpacing: '0.06em' }}>
        DEBUG PANEL
      </div>

      <Section title="Playback">
        <Row label="Playback Mode" value={playbackMode} highlight />
        <Row label="Playback Time" value={r ? `${r.playbackTime.toFixed(3)}s` : '—'} highlight />
        <Row label="Video Time" value={r ? `${r.videoTime.toFixed(3)}s` : '—'} />
        <Row label="Previous Frame" value={r ? `${r.previousFrameTime.toFixed(3)}s` : '—'} />
        <Row label="Next Frame" value={r ? `${r.nextFrameTime.toFixed(3)}s` : '—'} />
        <Row label="Interpolation α" value={r ? r.interpolationAlpha.toFixed(3) : '—'} highlight={Boolean(r && r.interpolationAlpha > 0 && r.interpolationAlpha < 1)} />
        <Row label="Frame Gap" value={r ? `${r.frameGapSec.toFixed(3)}s` : '—'} highlight={Boolean(r && r.frameGapSec > 1)} />
        <Row label="Render Status" value={r?.renderStatus ?? (isExtracting ? 'ANALYZING_DISABLED' : 'NO_DATA')} highlight />
        <Row label="Skeleton Data FPS" value={r ? r.skeletonDataFps.toFixed(2) : '—'} />
        <Row label="Video FPS" value={r ? r.videoFps.toFixed(2) : (d.videoFps ?? d.nativeFps ?? 0).toFixed(2)} />
        <Row label="Render FPS" value={r ? r.renderFps.toFixed(1) : '—'} highlight={Boolean(r && r.renderFps >= 30)} />
        <Row label="Playback Source" value={r?.playbackSource ?? 'NONE'} highlight={r?.playbackSource === 'STORED_SKELETON_TIMELINE'} />
        <Row label="Timeline Frames" value={r?.timelineFrameCount ?? 0} />
        <Row label="Max Gap" value={r ? `${r.maxGapSec.toFixed(3)}s` : '—'} highlight={Boolean(r && r.maxGapSec > 1)} />
      </Section>

      <Section title="Frame">
        <Row label="Frame" value={f ? `#${f.frameIndex}` : '—'} />
        <Row label="Timestamp" value={f ? `${f.timestamp.toFixed(3)}s` : '—'} />
        <Row label="Coverage" value={f ? `${Math.round(f.coverage * 100)}%` : `${Math.round((d.coverage || 0) * 100)}%`} highlight={Boolean(f && f.coverage < 0.85)} />
        <Row label="Detected" value={f?.detected ?? d.rawPoseCount ?? '—'} />
        <Row label="Tracked" value={f?.tracked ?? d.trackedCount ?? '—'} />
        <Row label="Visible" value={f?.visible ?? d.visibleCount ?? '—'} />
        <Row label="Track IDs" value={f?.trackingIds?.join(', ') || d.trackingIds?.join(', ') || '—'} />
      </Section>

      <Section title="Pipeline">
        <Row label="Stage" value={f?.pipelineStage ?? d.pipelineStage ?? (isExtracting ? 'extracting' : 'idle')} highlight />
        <Row label="Queue Size" value={f?.queueLength ?? d.queueLength ?? 0} highlight={(f?.queueLength ?? d.queueLength ?? 0) > 20} />
        <Row label="Worker Queue" value={f?.workerQueue ?? d.workerQueue ?? 0} highlight={(f?.workerQueue ?? 0) > 20} />
        <Row label="Processing Delay" value={`${(d.processingDelay ?? f?.processingMs ?? 0).toFixed(1)}ms`} />
        <Row label="MediaPipe Delay" value={`${(f?.mediaPipeDelayMs ?? d.mediaPipeDelay ?? 0).toFixed(1)}ms`} />
        <Row label="MediaPipe FPS" value={(d.mediaPipeFps ?? 0).toFixed(1)} />
      </Section>

      <Section title="RVFC">
        <Row label="RVFC FPS" value={(d.rvfcFps ?? 0).toFixed(1)} />
        <Row label="Decode Path" value={d.decodePath ?? 'unknown'} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 6, letterSpacing: '0.08em' }}>
        {title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  );
}

export default SkeletonDebugDiagnosticsPanel;
