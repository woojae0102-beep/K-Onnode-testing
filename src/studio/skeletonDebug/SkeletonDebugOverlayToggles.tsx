// @ts-nocheck
import React from 'react';
import type { SkeletonDebugOverlayOptions } from './types';

const TOGGLE_ITEMS: Array<{ key: keyof SkeletonDebugOverlayOptions; label: string }> = [
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'boundingBox', label: 'Bounding Box' },
  { key: 'trackId', label: 'Track ID' },
  { key: 'jointName', label: 'Joint Name' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'bone', label: 'Bone' },
  { key: 'centerPoint', label: 'Center Point' },
  { key: 'velocity', label: 'Velocity' },
  { key: 'prediction', label: 'Prediction' },
  { key: 'kalmanPrediction', label: 'Kalman Prediction' },
  { key: 'trackColor', label: 'Track Color' },
  { key: 'showEstimated', label: 'Estimated' },
  { key: 'lostTrack', label: 'Lost Track' },
  { key: 'recoveredTrack', label: 'Recovered Track' },
];

export function SkeletonDebugOverlayToggles({
  overlay,
  onChange,
}: {
  overlay: SkeletonDebugOverlayOptions;
  onChange: (next: SkeletonDebugOverlayOptions) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        background: 'rgba(3,3,8,0.9)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {TOGGLE_ITEMS.map(({ key, label }) => {
        const on = overlay[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...overlay, [key]: !on })}
            style={{
              fontSize: 10,
              padding: '4px 8px',
              borderRadius: 6,
              border: on ? '1px solid #FF1F8E' : '1px solid rgba(255,255,255,0.15)',
              background: on ? 'rgba(255, 31, 142, 0.2)' : 'transparent',
              color: on ? '#FF8FC8' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default SkeletonDebugOverlayToggles;
