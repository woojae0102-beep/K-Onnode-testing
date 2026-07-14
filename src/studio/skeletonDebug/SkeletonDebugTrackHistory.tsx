// @ts-nocheck
import React from 'react';
import type { TrackHistoryEntry } from './types';

export function SkeletonDebugTrackHistory({
  history,
  currentFrameIndex,
  onSelectFrame,
}: {
  history: TrackHistoryEntry[];
  currentFrameIndex: number;
  onSelectFrame: (frameIndex: number) => void;
}) {
  if (!history.length) {
    return (
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: 8 }}>
        Track History 없음 — 추출 완료 후 표시됩니다.
      </div>
    );
  }

  const maxFrame = Math.max(...history.map((h) => h.lastFrame), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 4px' }}>
      {history.map((entry) => (
        <div key={entry.trackId} style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: entry.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#fff', fontWeight: 600 }}>Track {entry.trackId}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>
              vis {entry.visibleFrames} / est {entry.estimatedFrames}
            </span>
          </div>
          <div
            style={{
              position: 'relative',
              height: 6,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${(entry.firstFrame / maxFrame) * 100}%`,
                width: `${((entry.lastFrame - entry.firstFrame + 1) / maxFrame) * 100}%`,
                height: '100%',
                background: entry.color,
                opacity: 0.5,
                borderRadius: 3,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${(currentFrameIndex / maxFrame) * 100}%`,
                width: 2,
                height: '100%',
                background: '#fff',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {entry.events.map((ev, i) => (
              <button
                key={`${entry.trackId}-${ev.type}-${i}`}
                type="button"
                onClick={() => onSelectFrame(ev.frameIndex)}
                style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: ev.type === 'lost' ? 'rgba(255,68,68,0.15)' : ev.type === 'recovered' ? 'rgba(68,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.75)',
                  cursor: 'pointer',
                }}
              >
                {ev.type} @ {ev.frameIndex}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default SkeletonDebugTrackHistory;
