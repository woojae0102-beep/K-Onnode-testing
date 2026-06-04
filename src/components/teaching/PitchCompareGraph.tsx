// @ts-nocheck
import React, { useMemo } from 'react';

export function PitchCompareGraph({ mySeries = [], targetSeries = [], currentTime = 0, duration = 60, height = 120 }) {
  const windowSec = 8;
  const start = Math.max(0, currentTime - windowSec / 2);
  const end = start + windowSec;

  const { myPath, targetPath, matchSegments } = useMemo(() => {
    const w = 400;
    const h = height;
    const toX = (t) => ((t - start) / windowSec) * w;
    const toY = (midi) => h - ((midi - 48) / 36) * h;

    const myIn = mySeries.filter((p) => p.time >= start && p.time <= end);
    const tgtIn = targetSeries.filter((p) => p.time >= start && p.time <= end);

    const myPath =
      myIn.length > 1
        ? myIn.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.time)} ${toY(p.midi)}`).join(' ')
        : '';
    const targetPath =
      tgtIn.length > 1
        ? tgtIn.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.time)} ${toY(p.midi)}`).join(' ')
        : '';

    const segments = myIn.map((p) => {
      const nearest = tgtIn.reduce(
        (best, t) => (Math.abs(t.time - p.time) < Math.abs(best.time - p.time) ? t : best),
        tgtIn[0] || { midi: p.midi, time: p.time }
      );
      const match = nearest && Math.abs(p.midi - nearest.midi) < 0.5;
      return { x: toX(p.time), match };
    });

    return { myPath, targetPath, matchSegments: segments };
  }, [mySeries, targetSeries, start, end, height]);

  return (
    <div className="w-full rounded-xl bg-black/40 border border-white/10 p-3">
      <div className="flex justify-between text-xs text-white/50 mb-2">
        <span className="text-[#FF1F8E]">● 내 음정</span>
        <span className="text-blue-400">● 목표 음정</span>
        <span className="text-emerald-400">초록 = 맞음</span>
      </div>
      <svg viewBox={`0 0 400 ${height}`} className="w-full" style={{ height }}>
        {matchSegments.map((seg, i) => (
          <rect
            key={i}
            x={seg.x - 2}
            y={0}
            width={4}
            height={height}
            fill={seg.match ? 'rgba(29,185,113,0.15)' : 'rgba(255,31,142,0.12)'}
          />
        ))}
        {targetPath ? <path d={targetPath} fill="none" stroke="#60a5fa" strokeWidth="2" /> : null}
        {myPath ? <path d={myPath} fill="none" stroke="#FF1F8E" strokeWidth="2.5" /> : null}
        <line
          x1={((currentTime - start) / windowSec) * 400}
          y1={0}
          x2={((currentTime - start) / windowSec) * 400}
          y2={height}
          stroke="white"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

export default PitchCompareGraph;
