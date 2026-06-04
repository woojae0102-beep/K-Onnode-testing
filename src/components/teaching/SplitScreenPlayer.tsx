// @ts-nocheck
import React from 'react';

export function SplitScreenPlayer({
  leftLabel = '내 영상',
  rightLabel = 'AI 티칭',
  leftContent,
  rightContent,
  footer,
  currentTime = 0,
  duration = 1,
  onSeek,
  isPlaying = false,
  onPlayPause,
  playbackRate = 1,
  onRateChange,
  loop = false,
  onLoopToggle,
  extraControls,
}) {
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] rounded-2xl overflow-hidden border border-white/10">
      <div className="grid grid-cols-2 border-b border-white/10">
        <div className="px-4 py-2 text-xs font-bold text-[#FF1F8E] border-r border-white/10">{leftLabel}</div>
        <div className="px-4 py-2 text-xs font-bold text-white/80">{rightLabel}</div>
      </div>
      <div className="grid grid-cols-2 flex-1 min-h-[280px]">
        <div className="relative border-r border-white/10 bg-black overflow-hidden">{leftContent}</div>
        <div className="relative bg-black overflow-hidden">{rightContent}</div>
      </div>
      {footer}
      <div className="p-4 border-t border-white/10 space-y-3">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek?.(Number(e.target.value))}
          className="w-full accent-[#FF1F8E]"
          style={{ background: `linear-gradient(to right, #FF1F8E ${pct}%, #333 ${pct}%)` }}
        />
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button type="button" onClick={onPlayPause} className="px-4 py-2 rounded-lg bg-[#FF1F8E] text-white text-sm font-semibold">
            {isPlaying ? '⏸ 정지' : '⏵ 재생'}
          </button>
          {[0.5, 1].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRateChange?.(r)}
              className={`px-3 py-2 rounded-lg text-sm ${playbackRate === r ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
            >
              {r}x
            </button>
          ))}
          <button
            type="button"
            onClick={onLoopToggle}
            className={`px-3 py-2 rounded-lg text-sm ${loop ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-white'}`}
          >
            루프
          </button>
          {extraControls}
          <span className="text-xs text-white/50 ml-auto">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default SplitScreenPlayer;
