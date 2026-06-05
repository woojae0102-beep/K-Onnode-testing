// @ts-nocheck
import React from 'react';
import PlaybackSpeedControl from '../common/PlaybackSpeedControl';
import CoachReviewBlock from './CoachReviewBlock';
import VocalLineCoachingLoop from '../coaching/VocalLineCoachingLoop';

export type CompareSheetTab = 'speed' | 'sync' | 'feedback' | 'menu' | null;

export function TVCompareBottomDock({
  activeTab,
  onTabChange,
  agencyColor,
}: {
  activeTab: CompareSheetTab;
  onTabChange: (tab: CompareSheetTab) => void;
}) {
  const tabs = [
    { id: 'speed', label: '속도', icon: '⚡' },
    { id: 'sync', label: '싱크', icon: '▶' },
    { id: 'feedback', label: '피드백', icon: '💬' },
    { id: 'menu', label: '메뉴', icon: '☰' },
  ];

  return (
    <div className="tv-compare-dock">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tv-compare-dock-btn ${activeTab === tab.id ? 'tv-compare-dock-btn-active' : ''}`}
          style={activeTab === tab.id ? { borderColor: agencyColor, color: agencyColor } : undefined}
          onClick={() => onTabChange(activeTab === tab.id ? null : tab.id)}
          aria-expanded={activeTab === tab.id}
        >
          <span className="tv-compare-dock-icon" aria-hidden>
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export function TVCompareBottomSheet({
  open,
  tab,
  onClose,
  agency,
  agencyColor,
  playbackRate,
  onPlaybackRateChange,
  isPlaying,
  onToggleSync,
  onSeekStart,
  coachReview,
  isDance,
  vocalCoachProps,
  vocalCoachKey = 0,
  rightMode,
  onPracticeWeak,
  onBackToRecording,
  onShowResult,
  onRetrySession,
}: {
  open: boolean;
  tab: CompareSheetTab;
  onClose: () => void;
  agency: string;
  agencyColor: string;
  playbackRate: number;
  onPlaybackRateChange: (v: number) => void;
  isPlaying: boolean;
  onToggleSync: () => void;
  onSeekStart: () => void;
  coachReview: string;
  isDance: boolean;
  vocalCoachProps?: Record<string, unknown> | null;
  vocalCoachKey?: number;
  rightMode: string;
  onPracticeWeak: () => void;
  onBackToRecording: () => void;
  onShowResult: () => void;
  onRetrySession: () => void;
}) {
  if (!open || !tab) return null;

  const titleMap = {
    speed: '페르소나 영상 속도',
    sync: '싱크 재생',
    feedback: 'AI 코칭 피드백',
    menu: '연습 메뉴',
  };

  return (
    <>
      <button type="button" className="tv-compare-sheet-backdrop" onClick={onClose} aria-label="닫기" />
      <div className="tv-compare-sheet" role="dialog" aria-label={titleMap[tab]}>
        <div className="tv-compare-sheet-handle" />
        <div className="tv-compare-sheet-header">
          <h3>{titleMap[tab]}</h3>
          <button type="button" className="tv-compare-sheet-close" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="tv-compare-sheet-body">
          {tab === 'speed' ? (
            <PlaybackSpeedControl
              value={playbackRate}
              onChange={onPlaybackRateChange}
              variant="dark"
              label="페르소나 영상 속도"
              compact
            />
          ) : null}

          {tab === 'sync' ? (
            <div className="tv-compare-sheet-sync">
              <button
                type="button"
                className="tv-footer-btn tv-footer-btn-secondary"
                onClick={onToggleSync}
              >
                {isPlaying ? '⏸ 일시정지' : '▶ 싱크 재생'}
              </button>
              <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={onSeekStart}>
                처음부터
              </button>
            </div>
          ) : null}

          {tab === 'feedback' ? (
            <div className="tv-compare-sheet-feedback">
              <CoachReviewBlock agency={agency} reviewText={coachReview} />
              {!isDance && vocalCoachProps ? (
                <VocalLineCoachingLoop key={vocalCoachKey} variant="dark" {...vocalCoachProps} />
              ) : null}
            </div>
          ) : null}

          {tab === 'menu' ? (
            <div className="tv-compare-sheet-menu">
              {rightMode === 'live' ? (
                <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={onBackToRecording}>
                  {isDance ? '내 영상 보기' : '내 녹음 보기'}
                </button>
              ) : (
                <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={onPracticeWeak}>
                  다시 부족한 부분 연습
                </button>
              )}
              <button
                type="button"
                className="tv-footer-btn tv-footer-btn-primary"
                style={{ background: agencyColor }}
                onClick={onShowResult}
              >
                결과 상세 보기
              </button>
              <button type="button" className="tv-footer-btn tv-footer-btn-secondary" onClick={onRetrySession}>
                처음부터
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default TVCompareBottomDock;
