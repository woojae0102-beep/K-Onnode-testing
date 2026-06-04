// @ts-nocheck
import React from 'react';

export function PronunciationWave({
  myWave = [],
  correctedWave = [],
  currentTime = 0,
  duration = 10,
  labelMine = '내 발음',
  labelCorrected = '교정 발음',
}) {
  const bars = 64;
  const pad = (arr) => {
    const out = [...arr];
    while (out.length < bars) out.push(0.1);
    return out.slice(0, bars);
  };
  const mine = pad(myWave);
  const corrected = pad(correctedWave);
  const cursor = duration > 0 ? (currentTime / duration) * bars : 0;

  return (
    <div className="space-y-2">
      <WaveRow label={labelMine} data={mine} color="#FF1F8E" cursor={cursor} />
      <WaveRow label={labelCorrected} data={corrected} color="#1DB971" cursor={cursor} />
    </div>
  );
}

function WaveRow({ label, data, color, cursor }) {
  return (
    <div>
      <p className="text-xs text-white/50 mb-1">{label}</p>
      <div className="flex items-end gap-0.5 h-12">
        {data.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-opacity"
            style={{
              height: `${Math.max(8, v * 100)}%`,
              backgroundColor: color,
              opacity: i <= cursor ? 1 : 0.35,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default PronunciationWave;
