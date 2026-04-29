// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

const HOME_SECTIONS = [
  { group: 'myPage', icon: '👤', labelKey: 'leftPanel.profile', view: 'mypage' },
  { group: 'myPage', icon: '📊', labelKey: 'leftPanel.growth', view: 'growth' },
  { group: 'myPage', icon: '🎯', labelKey: 'leftPanel.goals', view: 'goals' },
  { group: 'myPage', icon: '💾', labelKey: 'leftPanel.savedVideos', view: 'saved-videos' },
  { group: 'myPage', icon: '📋', labelKey: 'leftPanel.feedbackHistory', view: 'feedback-history' },
  { group: 'training', icon: '🕺', labelKey: 'leftPanel.danceTraining', view: 'dance' },
  { group: 'training', icon: '🎤', labelKey: 'leftPanel.vocalTraining', view: 'vocal' },
  { group: 'training', icon: '🇰🇷', labelKey: 'leftPanel.koreanAI', view: 'korean' },
  { group: 'training', icon: '🏆', labelKey: 'leftPanel.agencyAudition', view: 'agency-audition', accent: true },
];

const DISCOVER_SECTIONS = [
  { icon: '🔥', labelKey: 'leftPanel.trending', view: 'trending' },
  { icon: '💃', labelKey: 'leftPanel.popularDance', view: 'popular-dance' },
  { icon: '🎵', labelKey: 'leftPanel.popularSongs', view: 'popular-songs' },
  { icon: '🏆', labelKey: 'leftPanel.challenges', view: 'challenges' },
];

const AICOACH_SECTIONS = [
  { icon: '🔥', labelKey: 'leftPanel.todayPick', view: 'aicoach' },
  { icon: '📈', labelKey: 'leftPanel.weakness', view: 'weakness' },
  { icon: '📅', labelKey: 'leftPanel.routine', view: 'routine' },
  { icon: '🎯', labelKey: 'leftPanel.coaching', view: 'coaching' },
];

function getSections(activeTab) {
  if (activeTab === 'home') return HOME_SECTIONS;
  if (activeTab === 'discover') return DISCOVER_SECTIONS;
  if (activeTab === 'aicoach') return AICOACH_SECTIONS;
  return [];
}

export default function MobileSectionBar({ activeTab, mainView, onSelectView }) {
  const { t } = useTranslation();
  const sections = getSections(activeTab);
  if (!sections.length) return null;

  return (
    <div
      className="md:hidden"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #F0F0F0',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          width: 'max-content',
        }}
      >
        {sections.map((item) => {
          const active = mainView === item.view;
          const isAccent = item.accent;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onSelectView?.(item.view)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: active
                  ? '1px solid #FF1F8E'
                  : isAccent
                    ? '1px solid #FF1F8E55'
                    : '1px solid #E5E5E5',
                background: active ? '#FFF0F7' : isAccent ? '#FFF5FA' : '#FFFFFF',
                color: active || isAccent ? '#FF1F8E' : '#555555',
                fontSize: 12,
                fontWeight: active || isAccent ? 600 : 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
