// @ts-nocheck
import React from 'react';
import type { MotionExtractionDebugState } from '../../types/motionExtraction';

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

/**
 * K-POP Motion Extraction 실시간 디버그 — Frame/FPS/Tracking/Confidence/Timeline
 */
export function MotionExtractionDebugOverlay({
  debug,
  visible = true,
}: {
  debug: MotionExtractionDebugState | null;
  visible?: boolean;
}) {
  if (!visible || !debug) return null;

  const missing = debug.missingMemberCount > 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 40,
        pointerEvents: 'none',
        minWidth: 220,
        maxWidth: 280,
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(255, 31, 142, 0.35)',
        background: 'rgba(3, 3, 8, 0.82)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#FF1F8E',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        MOTION EXTRACT DEBUG
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Row label="Stage" value={debug.pipelineStage} highlight />
        <Row label="Progress" value={`${debug.progress}%`} />
        <Row label="Frame" value={`#${debug.frameIndex} @ ${debug.timestamp.toFixed(2)}s`} />
        <Row label="Source Time" value={`${debug.sourceVideoTime.toFixed(3)}s`} />
        <Row label="FPS" value={`${debug.measuredFps.toFixed(1)} / sample ${debug.sampleFps}`} />
        <Row label="Native FPS" value={debug.nativeFps != null ? debug.nativeFps.toFixed(1) : '—'} />
        <Row
          label="Timeline"
          value={`${debug.timelineFrameIndex}/${debug.timelineTotalFrames} (${debug.timelineDuration.toFixed(1)}s)`}
        />
        <Row label="Beat" value={debug.beat != null ? `${debug.beatIndex} (${debug.beat.toFixed(2)})` : '—'} />
        <Row label="Formation" value={debug.formation || '—'} />
        <Row label="Raw Poses" value={debug.rawPoseCount} />
        <Row label="Hands / Faces" value={`${debug.handCount} / ${debug.faceCount}`} />
        <Row label="Tracked" value={debug.trackedCount} />
        <Row label="Visible" value={debug.visibleCount} />
        <Row label="Hold/Interp" value={debug.estimatedCount} highlight={debug.interpolationHold} />
        <Row label="Expected" value={debug.expectedMemberCount} />
        <Row label="Missing" value={debug.missingMemberCount} highlight={missing} />
        <Row
          label="Tracking IDs"
          value={debug.trackingIds.length ? debug.trackingIds.join(', ') : '—'}
        />
        <Row label="Confidence" value={debug.avgConfidence.toFixed(3)} />
        <Row label="Pose Quality" value={debug.poseQuality != null ? debug.poseQuality.toFixed(3) : '—'} />
        <Row
          label="Tracked Members"
          value={debug.currentTrackedMembers?.length ? debug.currentTrackedMembers.join(', ') : '—'}
        />
        <Row
          label="Missing Members"
          value={debug.missingMembers?.length ? debug.missingMembers.join(', ') : '—'}
          highlight={Boolean(debug.missingMembers?.length)}
        />
        <Row label="Worker Queue" value={debug.workerQueue} highlight={debug.workerQueue > 20} />
        <Row
          label="Processing"
          value={debug.processingFrame ? 'LOCKED (dropped)' : `${debug.processingDelay.toFixed(1)}ms`}
          highlight={debug.processingFrame}
        />
        <Row label="Tracker Resets" value={debug.trackerResetCount} />
        <Row label="TrackId Changes" value={debug.trackIdChanges} highlight={debug.trackIdChanges > 0} />
        <Row label="Coverage (running)" value={`${Math.round((debug.coverage || 0) * 100)}%`} />
        <Row label="Last Timestamp" value={`${debug.lastTimestamp.toFixed(2)}s`} />
      </div>
    </div>
  );
}

export default MotionExtractionDebugOverlay;
