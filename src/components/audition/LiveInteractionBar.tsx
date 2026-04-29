// @ts-nocheck
import React from 'react';

type Props = {
  agencyAccent?: string;
  pitchAccuracy?: number;
  rhythmScore?: number;
  poseScore?: number;
  audioLevel?: number;
};

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const width = clamp(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, minWidth: 30, letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: '100%',
            background: color,
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#FFF', minWidth: 30, textAlign: 'right' }}>
        {width}%
      </span>
    </div>
  );
}

export default function LiveInteractionBar({
  agencyAccent = '#FF1F8E',
  pitchAccuracy = 0,
  rhythmScore = 0,
  poseScore = 0,
  audioLevel = 0,
}: Props) {
  const audioPct = Math.round(Math.max(0, Math.min(1, audioLevel)) * 100);

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        background: 'rgba(0,0,0,0.5)',
        border: `1px solid ${agencyAccent}55`,
        borderRadius: 14,
        padding: '10px 12px',
      }}
    >
      <Meter label="음정" value={pitchAccuracy} color={agencyAccent} />
      <Meter label="리듬" value={rhythmScore} color="#5BD0F0" />
      <Meter label="자세" value={poseScore} color="#7CFFB2" />
      <Meter label="볼륨" value={audioPct} color={audioPct > 60 ? '#FF3B3B' : '#FFD166'} />
    </div>
  );
}
