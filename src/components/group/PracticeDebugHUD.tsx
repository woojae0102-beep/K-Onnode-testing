// @ts-nocheck
import React from 'react';
import type { SkeletonValidationDebugReport } from '../../utils/skeletonDataUtils';

export interface PracticeDebugHudProps {
  frameIndex: number;
  totalFrames: number;
  duration: number;
  skeletonCount: number;
  aiAvatarCount: number;
  userSkeletonJoints: number;
  currentTimeline: number;
  snapshotAiCount?: number;
  sessionPhase?: string;
  validationReport?: SkeletonValidationDebugReport | null;
  interpolatedMemberCount?: number;
}

function fmtSec(sec: number): string {
  if (!Number.isFinite(sec)) return '0.0s';
  return `${sec.toFixed(1)}s`;
}

function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

/** 연습 세션 실시간 디버그 HUD */
export function PracticeDebugHUD({
  frameIndex,
  totalFrames,
  duration,
  skeletonCount,
  aiAvatarCount,
  userSkeletonJoints,
  currentTimeline,
  snapshotAiCount = 0,
  sessionPhase = '',
  validationReport = null,
  interpolatedMemberCount = 0,
}: PracticeDebugHudProps) {
  const rows: Array<[string, string | number]> = [
    ['Frame', frameIndex >= 0 ? `${frameIndex} / ${totalFrames - 1}` : `— / ${totalFrames}`],
    ['TotalFrames', validationReport?.totalFrames ?? totalFrames],
    ['Duration', fmtSec(duration)],
    ['Skeleton Count', skeletonCount],
    ['AI Avatar Count', `${aiAvatarCount}${snapshotAiCount ? ` (snap ${snapshotAiCount})` : ''}`],
    ['User Skeleton', userSkeletonJoints > 0 ? `${userSkeletonJoints} joints` : '없음'],
    ['Current Timeline', fmtSec(currentTimeline)],
  ];

  if (validationReport) {
    rows.push(
      ['Valid Frames', `${validationReport.validFrames} / ${validationReport.totalFrames}`],
      ['Invalid Frames', validationReport.invalidFrames],
      ['Valid Ratio', fmtPct(validationReport.validFrameRatio)],
      ['Member Avg', validationReport.memberAverage.toFixed(2)],
      ['Timeline Cov.', fmtPct(validationReport.timelineCoverage)],
    );
  }

  if (interpolatedMemberCount > 0) {
    rows.push(['Interpolated', interpolatedMemberCount]);
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        left: 8,
        zIndex: 40,
        pointerEvents: 'none',
        minWidth: 188,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.72)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.88)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#7CFFB2',
          marginBottom: 4,
          textTransform: 'uppercase',
        }}
      >
        Practice Debug HUD
        {sessionPhase ? ` · ${sessionPhase}` : ''}
      </div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
          <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export default PracticeDebugHUD;
