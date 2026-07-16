// @ts-nocheck
import React from 'react';
import type { SkeletonDebugFrameStat } from './types';

const SPEEDS = [0.25, 0.5, 1, 2];

export function SkeletonDebugPlayerControls({
  currentFrameIndex,
  totalFrames,
  frameStat,
  isPlaying,
  playbackSpeed,
  playbackMode,
  playbackTimeSec,
  durationSec,
  onFrameChange,
  onPlayPause,
  onSpeedChange,
  onPrev,
  onNext,
  disabled,
}: {
  currentFrameIndex: number;
  totalFrames: number;
  frameStat: SkeletonDebugFrameStat | null;
  isPlaying: boolean;
  playbackSpeed: number;
  playbackMode?: string;
  playbackTimeSec?: number;
  durationSec?: number;
  onFrameChange: (frameIndex: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const maxIdx = Math.max(0, totalFrames - 1);
  const dur = durationSec ?? 0;
  const playbackLabel = dur > 0
    ? `${(playbackTimeSec ?? 0).toFixed(2)}s / ${dur.toFixed(1)}s`
    : `${(playbackTimeSec ?? 0).toFixed(2)}s`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        background: 'rgba(3,3,8,0.92)',
        borderRadius: 10,
        border: disabled
          ? '1px solid rgba(255,255,255,0.08)'
          : isPlaying
            ? '1px solid rgba(68,255,136,0.45)'
            : '1px solid rgba(255,215,0,0.35)',
      }}
    >
      {!disabled ? (
        <div
          style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            color: isPlaying ? '#44FF88' : '#FFD700',
            fontWeight: 600,
          }}
        >
          {isPlaying
            ? `▶ 재생 중 — ${playbackLabel}`
            : playbackMode === 'ANALYSIS_COMPLETE'
              ? `⏸ 재생 준비 — ▶ Play를 눌러 영상+스켈레톤 동기 재생 (${playbackLabel})`
              : `Playback: ${playbackMode ?? '—'} · ${playbackLabel}`}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace' }}>
          추출 완료 후 재생 컨트롤이 활성화됩니다
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.7)' }}>
        <Metric label="Playback" value={playbackLabel} />
        <Metric label="Mode" value={playbackMode ?? '—'} />
        <Metric label="Frame" value={`${currentFrameIndex} / ${Math.max(0, totalFrames - 1)}`} />
        <Metric label="Total" value={totalFrames} />
        <Metric label="Time" value={frameStat ? `${frameStat.timestamp.toFixed(3)}s` : '—'} />
        <Metric label="Coverage" value={frameStat ? `${Math.round(frameStat.coverage * 100)}%` : '—'} />
        <Metric label="Detected" value={frameStat?.detected ?? '—'} />
        <Metric label="Tracked" value={frameStat?.tracked ?? '—'} />
        <Metric label="Confidence" value={frameStat ? frameStat.confidence.toFixed(2) : '—'} />
        <Metric label="Processing" value={frameStat ? `${frameStat.processingMs.toFixed(1)}ms` : '—'} />
      </div>

      <input
        type="range"
        min={0}
        max={maxIdx}
        value={Math.min(currentFrameIndex, maxIdx)}
        disabled={disabled || totalFrames < 2}
        onChange={(e) => onFrameChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#FF1F8E' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn onClick={onPrev} disabled={disabled || currentFrameIndex <= 0}>◀ Prev</Btn>
        <Btn onClick={onPlayPause} disabled={disabled || totalFrames < 1} highlight>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </Btn>
        <Btn onClick={onNext} disabled={disabled || currentFrameIndex >= maxIdx}>Next ▶</Btn>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginLeft: 8 }}>Speed</span>
        {SPEEDS.map((s) => (
          <Btn
            key={s}
            onClick={() => onSpeedChange(s)}
            disabled={disabled}
            highlight={playbackSpeed === s}
          >
            {s}x
          </Btn>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span>
      <span style={{ color: 'rgba(255,255,255,0.35)' }}>{label}: </span>
      <span style={{ color: '#fff' }}>{value}</span>
    </span>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  highlight,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 10,
        padding: '6px 10px',
        borderRadius: 6,
        border: highlight ? '1px solid #FF1F8E' : '1px solid rgba(255,255,255,0.15)',
        background: highlight ? 'rgba(255,31,142,0.2)' : 'rgba(255,255,255,0.05)',
        color: disabled ? 'rgba(255,255,255,0.25)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      {children}
    </button>
  );
}

export default SkeletonDebugPlayerControls;
