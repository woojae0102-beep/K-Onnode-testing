// @ts-nocheck
import React from 'react';

export function LiveFeedbackStrip({ hint, score, scoreLabel, tuningState, volumeLevel, mode = 'dance' }) {
  const tuningColor =
    tuningState === 'in-tune' ? 'text-emerald-400' : tuningState === 'sharp' ? 'text-amber-400' : tuningState === 'flat' ? 'text-sky-400' : 'text-white/60';

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#FF1F8E] uppercase tracking-wide">실시간 힌트</p>
        {score != null && mode === 'dance' ? (
          <span className="text-sm font-bold text-white">
            {scoreLabel || '자세'} {score}%
          </span>
        ) : null}
        {mode !== 'dance' && tuningState && tuningState !== 'idle' ? (
          <span className={`text-xs font-semibold ${tuningColor}`}>
            {tuningState === 'in-tune' ? '● 음정 OK' : tuningState === 'sharp' ? '▲ 높음' : '▼ 낮음'}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-white/80 leading-snug">{hint || '연습을 시작하면 가벼운 피드백이 표시됩니다.'}</p>
      {mode !== 'dance' && volumeLevel != null ? (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#FF1F8E] transition-all duration-100"
            style={{ width: `${Math.min(100, volumeLevel)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default LiveFeedbackStrip;
