// @ts-nocheck
import React from 'react';
import type { SkeletonDebugLiveDiagnostics } from './types';
import type { SkeletonDebugFrameStat } from './types';

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
      <span style={{ color: highlight ? '#FFD700' : 'rgba(255,255,255,0.92)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export function SkeletonDebugDiagnosticsPanel({
  live,
  frameStat,
  isExtracting,
}: {
  live: SkeletonDebugLiveDiagnostics;
  frameStat: SkeletonDebugFrameStat | null;
  isExtracting: boolean;
}) {
  const d = live || {};
  const f = frameStat;

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

      <Section title="Frame">
        <Row label="Frame" value={f ? `#${f.frameIndex}` : '—'} />
        <Row label="Timestamp" value={f ? `${f.timestamp.toFixed(3)}s` : '—'} />
        <Row label="Coverage" value={f ? `${Math.round(f.coverage * 100)}%` : `${Math.round((d.coverage || 0) * 100)}%`} highlight={Boolean(f && f.coverage < 0.85)} />
        <Row label="Detected" value={f?.detected ?? d.rawPoseCount ?? '—'} />
        <Row label="Tracked" value={f?.tracked ?? d.trackedCount ?? '—'} />
        <Row label="Visible" value={f?.visible ?? d.visibleCount ?? '—'} />
        <Row label="Peak Track" value={d.expectedMemberCount ? `exp ${d.expectedMemberCount}` : '—'} />
        <Row label="Track IDs" value={f?.trackingIds?.join(', ') || d.trackingIds?.join(', ') || '—'} />
        <Row label="Confidence" value={f ? f.confidence.toFixed(3) : (d.avgConfidence?.toFixed(3) ?? '—')} />
        <Row label="Pose Quality" value={f?.poseQuality != null ? f.poseQuality.toFixed(3) : (d.poseQuality?.toFixed(3) ?? '—')} />
      </Section>

      <Section title="Pipeline">
        <Row label="Stage" value={f?.pipelineStage ?? d.pipelineStage ?? (isExtracting ? 'extracting' : 'idle')} highlight />
        <Row label="Queue Size" value={f?.queueLength ?? d.queueLength ?? 0} highlight={(f?.queueLength ?? d.queueLength ?? 0) > 20} />
        <Row label="Dropped Frame" value={f?.droppedFrames ?? d.droppedFrames ?? 0} highlight={(f?.droppedFrames ?? 0) > 0} />
        <Row label="Worker Queue" value={f?.workerQueue ?? d.workerQueue ?? 0} highlight={(f?.workerQueue ?? 0) > 20} />
        <Row label="Processing Delay" value={`${(d.processingDelay ?? f?.processingMs ?? 0).toFixed(1)}ms`} />
        <Row label="Avg Processing" value={`${(d.averageProcessingTimeMs ?? 0).toFixed(1)}ms`} />
        <Row label="MediaPipe Delay" value={`${(f?.mediaPipeDelayMs ?? d.mediaPipeDelay ?? 0).toFixed(1)}ms`} />
      </Section>

      <Section title="RVFC">
        <Row label="Schedule Count" value={d.rvfcScheduleCount ?? 0} />
        <Row label="Callback Count" value={d.rvfcCallbackCount ?? 0} />
        <Row label="RVFC FPS" value={(d.rvfcFps ?? 0).toFixed(1)} />
        <Row label="Status" value={d.pipelineStage?.includes('stall') ? 'STALL' : 'active'} highlight={d.pipelineStage?.includes('stall')} />
      </Section>

      <Section title="Worker">
        <Row label="Busy" value={d.workerBusy ? 'YES' : 'NO'} highlight={d.workerBusy} />
        <Row label="Idle" value={d.workerIdle ? 'YES' : 'NO'} />
        <Row label="Restart" value={d.workerRestartCount ?? 0} highlight={(d.workerRestartCount ?? 0) > 0} />
        <Row label="Worker Delay" value={`${(d.workerDelay ?? 0).toFixed(1)}ms`} />
        <Row label="Worker Mem" value={d.workerMemoryMb != null ? `${d.workerMemoryMb.toFixed(1)}MB` : 'n/a'} />
      </Section>

      <Section title="FPS / Memory">
        <Row label="Current FPS" value={(d.measuredFps ?? 0).toFixed(1)} />
        <Row label="Video FPS" value={(d.videoFps ?? d.nativeFps ?? 0).toFixed(1)} />
        <Row label="MediaPipe FPS" value={(d.mediaPipeFps ?? 0).toFixed(1)} />
        <Row label="Tracking FPS" value={(d.trackingFps ?? d.measuredFps ?? 0).toFixed(1)} />
        <Row label="Peak Heap" value={d.peakHeapMb != null ? `${d.peakHeapMb.toFixed(1)}MB` : 'n/a'} />
        <Row label="Frame Buffer" value={d.frameBufferMemoryMb != null ? `${d.frameBufferMemoryMb.toFixed(1)}MB` : 'n/a'} />
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
