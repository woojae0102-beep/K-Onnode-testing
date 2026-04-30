// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import TabBar from './TabBar';
import MenuRow, { SectionTitle } from './MenuRow';

const HOME_MENUS_MY = [
  { icon: '👤', labelKey: 'leftPanel.profile', view: 'mypage' },
  { icon: '📊', labelKey: 'leftPanel.growth', view: 'growth' },
  { icon: '🎯', labelKey: 'leftPanel.goals', view: 'goals' },
  { icon: '💾', labelKey: 'leftPanel.savedVideos', view: 'saved-videos' },
  { icon: '📋', labelKey: 'leftPanel.feedbackHistory', view: 'feedback-history' },
];

const HOME_MENUS_TRAINING = [
  { icon: '🕺', labelKey: 'leftPanel.danceTraining', view: 'dance' },
  { icon: '🎤', labelKey: 'leftPanel.vocalTraining', view: 'vocal' },
  { icon: '🇰🇷', labelKey: 'leftPanel.koreanAI', view: 'korean' },
  {
    icon: '🏆',
    labelKey: 'leftPanel.agencyAudition',
    subKey: 'leftPanel.agencyAuditionSub',
    view: 'agency-audition',
    accent: true,
  },
];

const DISCOVER_MENUS = [
  { icon: '🔥', labelKey: 'leftPanel.trending', view: 'trending' },
  { icon: '💃', labelKey: 'leftPanel.popularDance', view: 'popular-dance' },
  { icon: '🎵', labelKey: 'leftPanel.popularSongs', view: 'popular-songs' },
  { icon: '🏆', labelKey: 'leftPanel.challenges', view: 'challenges' },
];

const AICOACH_MENUS = [
  { icon: '🔥', labelKey: 'leftPanel.todayPick', view: 'aicoach' },
  { icon: '📈', labelKey: 'leftPanel.weakness', view: 'weakness' },
  { icon: '📅', labelKey: 'leftPanel.routine', view: 'routine' },
  { icon: '🎯', labelKey: 'leftPanel.coaching', view: 'coaching' },
];

export default function LeftPanel({
  activeTab,
  mainView,
  onChangeTab,
  onSelectView,
  onOpenSettings,
}) {
  return (
    <aside
      className="hidden md:flex flex-col bg-white"
      style={{
        width: 240,
        height: '100%',
        borderRight: '1px solid #F0F0F0',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <TabBar activeTab={activeTab} onChangeTab={onChangeTab} />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '4px 8px 16px',
        }}
      >
        {activeTab === 'home' && (
          <HomeTabContent mainView={mainView} onSelectView={onSelectView} />
        )}
        {activeTab === 'discover' && (
          <DiscoverTabContent mainView={mainView} onSelectView={onSelectView} />
        )}
        {activeTab === 'aicoach' && (
          <AICoachTabContent mainView={mainView} onSelectView={onSelectView} />
        )}
      </div>

      <UserMiniBar onOpenSettings={onOpenSettings} />
    </aside>
  );
}

function HomeTabContent({ mainView, onSelectView }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionTitle>{t('leftPanel.myPage')}</SectionTitle>
      {HOME_MENUS_MY.map((item) => (
        <MenuRow
          key={item.view}
          icon={item.icon}
          label={t(item.labelKey)}
          active={mainView === item.view}
          onClick={() => onSelectView?.(item.view)}
        />
      ))}
      <SectionTitle>{t('leftPanel.training')}</SectionTitle>
      {HOME_MENUS_TRAINING.map((item) => (
        <MenuRow
          key={item.view}
          icon={item.icon}
          label={t(item.labelKey)}
          active={mainView === item.view}
          onClick={() => onSelectView?.(item.view)}
          trailing={item.accent ? <NewBadge /> : null}
        />
      ))}
    </>
  );
}

function NewBadge() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: '#FF1F8E',
        background: '#FFF0F7',
        padding: '2px 6px',
        borderRadius: 4,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      NEW
    </span>
  );
}

function DiscoverTabContent({ mainView, onSelectView }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionTitle>{t('leftPanel.discover')}</SectionTitle>
      {DISCOVER_MENUS.map((item) => (
        <MenuRow
          key={item.view}
          icon={item.icon}
          label={t(item.labelKey)}
          active={mainView === item.view}
          onClick={() => onSelectView?.(item.view)}
        />
      ))}
    </>
  );
}

function AICoachTabContent({ mainView, onSelectView }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionTitle>{t('leftPanel.aiCoach')}</SectionTitle>
      {AICOACH_MENUS.map((item) => (
        <MenuRow
          key={item.view}
          icon={item.icon}
          label={t(item.labelKey)}
          active={mainView === item.view}
          onClick={() => onSelectView?.(item.view)}
        />
      ))}
    </>
  );
}

function UserMiniBar({ onOpenSettings }) {
  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        borderTop: '1px solid #F0F0F0',
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#FF1F8E18',
          color: '#FF1F8E',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        ON
      </div>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: '#111111',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        onnode_user
      </span>
      <button
        type="button"
        onClick={onOpenSettings}
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          background: 'transparent',
          border: 'none',
          color: '#888888',
          cursor: 'pointer',
          borderRadius: 8,
        }}
      >
        <Settings size={16} />
      </button>
    </div>
  );
}
