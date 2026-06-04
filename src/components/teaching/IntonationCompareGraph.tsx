// @ts-nocheck
import React, { useMemo } from 'react';

export function IntonationCompareGraph({
  standardSeries = [],
  mySeries = [],
  currentTime = 0,
  duration = 10,
  height = 80,
}) {
  const { standardPath, myPath, cursorX } = useMemo(() => {
    const w = 400;
    const h = height;
    const len = Math.max(standardSeries.length, mySeries.length, 2);
    const toPath = (arr) => {
      if (!arr.length) return '';
      return arr
        .map((v, i) => {
          const x = (i / (len - 1)) * w;
          const y = h / 2 - v * (h / 2 - 8);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
    };
    const cursorX = duration > 0 ? (currentTime / duration) * w : 0;
    return { standardPath: toPath(standardSeries), myPath: toPath(mySeries), cursorX };
  }, [standardSeries, mySeries, currentTime, duration, height]);

  return (
    <div className="rounded-xl bg-black/40 border border-white/10 p-3">
      <div className="flex gap-4 text-xs text-white/50 mb-2">
        <span className="text-blue-400">● 표준 억양</span>
        <span className="text-[#FF1F8E]">● 내 억양</span>
      </div>
      <svg viewBox={`0 0 400 ${height}`} className="w-full" style={{ height }}>
        {standardPath ? <path d={standardPath} fill="none" stroke="#60a5fa" strokeWidth="2" /> : null}
        {myPath ? <path d={myPath} fill="none" stroke="#FF1F8E" strokeWidth="2.5" /> : null}
        <line x1={cursorX} y1={0} x2={cursorX} y2={height} stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      </svg>
    </div>
  );
}

export default IntonationCompareGraph;
