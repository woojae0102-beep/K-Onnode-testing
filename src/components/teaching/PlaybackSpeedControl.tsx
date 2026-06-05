// @ts-nocheck
import React from 'react';
import {
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_PRESETS,
  PLAYBACK_SPEED_STEP,
  clampPlaybackSpeed,
  formatPlaybackSpeed,
} from '../../utils/playbackSpeed';

/**
 * 재생 속도 조절 (0.1x ~ 2x) — 모바일 터치 친화 칩 UI
 */
export function PlaybackSpeedControl({
  value = 1,
  onChange,
  variant = 'dark',
  compact = false,
  showPresets = true,
  label = '재생 속도',
}) {
  const speed = clampPlaybackSpeed(value);
  const isDark = variant === 'dark';

  const borderIdle = isDark ? 'border-white/15 bg-white/5 text-white/60' : 'border-[#E5E5E5] bg-white text-[#666666]';
  const borderActive = isDark
    ? 'border-[#FF1F8E] bg-[#FF1F8E]/25 text-[#FF1F8E]'
    : 'border-[#FF1F8E] bg-[#FFF0F7] text-[#FF1F8E]';
  const labelColor = isDark ? 'text-white/45' : 'text-[#888888]';

  if (compact && !showPresets) {
    return (
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className={`text-[10px] font-medium tracking-wide shrink-0 ${labelColor}`}>{label}</span>
        <input
          type="range"
          min={PLAYBACK_SPEED_MIN}
          max={PLAYBACK_SPEED_MAX}
          step={PLAYBACK_SPEED_STEP}
          value={speed}
          onChange={(e) => onChange?.(clampPlaybackSpeed(Number(e.target.value)))}
          className="flex-1 min-w-[72px] accent-[#FF1F8E] touch-manipulation min-h-[32px]"
          aria-label={label}
        />
        <span className="text-[11px] font-bold text-[#FF1F8E] tabular-nums min-w-[36px] text-right">
          {formatPlaybackSpeed(speed)}
        </span>
      </div>
    );
  }

  return (
    <div className={`w-full ${compact ? '' : 'space-y-3'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[11px] font-semibold tracking-wide ${labelColor}`}>{label}</span>
        <span className="text-sm font-bold text-[#FF1F8E] tabular-nums">{formatPlaybackSpeed(speed)}</span>
      </div>

      <input
        type="range"
        min={PLAYBACK_SPEED_MIN}
        max={PLAYBACK_SPEED_MAX}
        step={PLAYBACK_SPEED_STEP}
        value={speed}
        onChange={(e) => onChange?.(clampPlaybackSpeed(Number(e.target.value)))}
        className="w-full accent-[#FF1F8E] touch-manipulation min-h-[36px]"
        aria-label={label}
      />

      {showPresets ? (
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
        >
          {PLAYBACK_SPEED_PRESETS.map((preset) => {
            const active = speed === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange?.(preset)}
                className={`shrink-0 min-w-[52px] min-h-[44px] px-3 rounded-xl border text-sm font-semibold tabular-nums touch-manipulation transition-colors ${
                  active ? borderActive : borderIdle
                }`}
                aria-pressed={active}
              >
                {formatPlaybackSpeed(preset)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default PlaybackSpeedControl;
