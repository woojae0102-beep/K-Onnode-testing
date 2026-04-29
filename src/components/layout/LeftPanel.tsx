// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Settings } from 'lucide-react';
import TabBar from './TabBar';
import MenuRow, { SectionTitle } from './MenuRow';
import ConversationRow from './ConversationRow';

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
  conversationId,
  onChangeTab,
  onSelectView,
  onSelectConversation,
  onOpenNewChat,
  onOpenSettings,
  conversations = [],
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
        {activeTab === 'chat' && (
          <ChatTabContent
            mainView={mainView}
            conversations={conversations}
            conversationId={conversationId}
            onSelectConversation={onSelectConversation}
            onOpenNewChat={onOpenNewChat}
          />
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
      {HOME_MENUS_TRAINING.map((item) =>
        item.accent ? (
          <AccentMenuRow
            key={item.view}
            icon={item.icon}
            label={t(item.labelKey)}
            sub={item.subKey ? t(item.subKey) : undefined}
            active={mainView === item.view}
            onClick={() => onSelectView?.(item.view)}
          />
        ) : (
          <MenuRow
            key={item.view}
            icon={item.icon}
            label={t(item.labelKey)}
            active={mainView === item.view}
            onClick={() => onSelectView?.(item.view)}
          />
        )
      )}
    </>
  );
}

function AccentMenuRow({ icon, label, sub, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        borderRadius: 8,
        background: active ? '#FFF0F7' : hover ? '#FFF5FA' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: active ? 700 : 600,
            color: '#FF1F8E',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        {sub && (
          <span
            style={{
              fontSize: 10,
              color: '#999',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </button>
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

function ChatTabContent({ mainView, conversations, conversationId, onSelectConversation, onOpenNewChat }) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState('dm');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const base = conversations.filter((c) => c.type === subTab);
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter(
      (c) =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.lastMessage || '').toLowerCase().includes(q)
    );
  }, [conversations, subTab, query]);

  return (
    <div style={{ position: 'relative', paddingBottom: 60 }}>
      <div style={{ padding: '8px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#F5F5F7',
            color: '#888888',
          }}
        >
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('community.search')}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 12,
              background: 'transparent',
              color: '#111111',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '0 16px',
          borderBottom: '1px solid #F0F0F0',
        }}
      >
        {[
          { id: 'dm', label: t('community.tabs.dm') },
          { id: 'group', label: t('community.tabs.group') },
        ].map((item) => {
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              style={{
                fontSize: 12,
                padding: '8px 0',
                color: active ? '#FF1F8E' : '#888888',
                fontWeight: active ? 600 : 400,
                borderBottom: active ? '2px solid #FF1F8E' : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filtered.length ? (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              active={mainView === 'chat' && conversationId === conv.id}
              onClick={() => onSelectConversation?.(conv.id)}
            />
          ))
        ) : (
          <p style={{ padding: '16px 12px', fontSize: 12, color: '#AAAAAA' }}>
            {t('leftPanel.noConversations')}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenNewChat}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          background: '#FF1F8E',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 20,
          padding: '7px 14px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(255, 31, 142, 0.3)',
        }}
      >
        + {t('community.newChat')}
      </button>
    </div>
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
