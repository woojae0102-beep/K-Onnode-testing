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
 * AI 페르소나 티칭/피드백 재생 속도 (0.1x ~ 2x)
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

  const labelStyle = {
    fontSize: compact ? 10 : 11,
    color: isDark ? 'rgba(255,255,255,0.4)' : '#888888',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  };

  const sliderAccent = isDark ? '#FF1F8E' : '#FF1F8E';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        gap: compact ? 8 : 10,
        alignItems: compact ? 'center' : 'stretch',
        width: compact ? 'auto' : '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minWidth: compact ? 120 : undefined,
        }}
      >
        <span style={labelStyle}>{label}</span>
        <span
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 700,
            color: isDark ? '#FF1F8E' : '#FF1F8E',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {formatPlaybackSpeed(speed)}
        </span>
      </div>

      <input
        type="range"
        min={PLAYBACK_SPEED_MIN}
        max={PLAYBACK_SPEED_MAX}
        step={PLAYBACK_SPEED_STEP}
        value={speed}
        onChange={(e) => onChange?.(clampPlaybackSpeed(Number(e.target.value)))}
        className="touch-manipulation"
        style={{
          width: compact ? 100 : '100%',
          accentColor: sliderAccent,
          minHeight: 28,
        }}
        aria-label={label}
      />

      {showPresets && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {PLAYBACK_SPEED_PRESETS.map((preset) => {
            const active = speed === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange?.(preset)}
                style={{
                  padding: compact ? '3px 8px' : '4px 10px',
                  fontSize: compact ? 10 : 11,
                  fontWeight: active ? 600 : 500,
                  borderRadius: 6,
                  border: `1px solid ${
                    active
                      ? isDark
                        ? '#FF1F8E'
                        : '#FF1F8E'
                      : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : '#E5E5E5'
                  }`,
                  background: active
                    ? isDark
                      ? 'rgba(255,31,142,0.2)'
                      : '#FFF0F7'
                    : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : '#FFFFFF',
                  color: active ? '#FF1F8E' : isDark ? 'rgba(255,255,255,0.5)' : '#888888',
                  cursor: 'pointer',
                }}
              >
                {formatPlaybackSpeed(preset)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PlaybackSpeedControl;
