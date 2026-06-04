// @ts-nocheck
import React from 'react';

export function SyllableAccuracyBar({ syllables = [] }) {
  if (!syllables.length) {
    return <p className="text-xs text-white/40 text-center py-2">음절 데이터 없음</p>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-3 min-w-max justify-center py-2">
        {syllables.map((s, i) => {
          const color = s.status === 'good' ? '#1DB971' : s.status === 'ok' ? '#FFD700' : '#FF1F8E';
          return (
            <div key={i} className="flex flex-col items-center gap-1 min-w-[36px]">
              <span className="text-lg font-medium text-white">{s.syllable}</span>
              <span className="text-xs font-bold" style={{ color }}>
                {s.score}%
              </span>
              <div className="w-8 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${s.score}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SyllableAccuracyBar;
