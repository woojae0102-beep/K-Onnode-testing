// @ts-nocheck
import React from 'react';
import { useMobileLayout } from '../../hooks/useMobileLayout';
import PlaybackSpeedControl from './PlaybackSpeedControl';

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
  const { isNarrow } = useMobileLayout();
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const gridCols = isNarrow ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className="teaching-dark-shell flex flex-col h-full bg-[#0a0a0f] rounded-2xl overflow-hidden border border-white/10">
      <div className={`grid ${gridCols} border-b border-white/10`}>
        <div className={`px-4 py-2 text-xs font-bold text-[#FF1F8E] ${isNarrow ? '' : 'border-r border-white/10'}`}>
          {leftLabel}
        </div>
        <div className="px-4 py-2 text-xs font-bold text-white/80">{rightLabel}</div>
      </div>
      <div className={`grid ${gridCols} flex-1 ${isNarrow ? 'min-h-[360px]' : 'min-h-[280px]'}`}>
        <div className={`relative bg-black overflow-hidden ${isNarrow ? 'min-h-[180px] border-b border-white/10' : 'border-r border-white/10'}`}>
          {leftContent}
        </div>
        <div className="relative bg-black overflow-hidden min-h-[180px]">{rightContent}</div>
      </div>
      {footer}
      <div
        className="p-4 border-t border-white/10 space-y-3"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek?.(Number(e.target.value))}
          className="w-full accent-[#FF1F8E] touch-manipulation min-h-[32px]"
          style={{ background: `linear-gradient(to right, #FF1F8E ${pct}%, #333 ${pct}%)` }}
        />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <button
              type="button"
              onClick={onPlayPause}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#FF1F8E] text-white text-sm font-semibold touch-manipulation"
            >
              {isPlaying ? '⏸ 정지' : '⏵ 재생'}
            </button>
            <button
              type="button"
              onClick={onLoopToggle}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-sm touch-manipulation ${loop ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-white'}`}
            >
              루프
            </button>
            {extraControls}
            <span className="text-xs text-white/50 ml-auto tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <PlaybackSpeedControl
            value={playbackRate}
            onChange={onRateChange}
            variant="dark"
            label="재생 속도"
          />
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
