// @ts-nocheck
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AINotificationBubble from '../components/notifications/AINotificationBubble';

const filters = ['all', 'aicoach', 'challenge'];

export default function NotificationsView({ onNavigate }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const list = [
    {
      id: 'n1',
      type: 'aicoach',
      unread: true,
      title: t('notifications.aiTitle'),
      message: t('notifications.aiMessage'),
      actionLabel: t('notifications.practiceNow'),
      action: () => onNavigate('vocal'),
    },
    {
      id: 'n2',
      type: 'all',
      unread: true,
      title: t('notifications.goalTitle'),
      message: t('notifications.goalMessage'),
      actionLabel: t('notifications.nextGoal'),
      action: () => onNavigate('mypage'),
    },
    {
      id: 'n3',
      type: 'all',
      unread: false,
      title: t('notifications.recommendTitle'),
      message: t('notifications.recommendMessage'),
      actionLabel: t('notifications.start'),
      action: () => onNavigate('discover'),
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F5F5F7] p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-full px-3 py-1 text-xs border ${filter === item ? 'border-[#FF1F8E] text-[#FF1F8E] bg-[#FF1F8E18]' : 'border-[#E5E5E5] text-[#888888] bg-white'}`}
              onClick={() => setFilter(item)}
            >
              {t(`notifications.filters.${item}`)}
            </button>
          ))}
        </div>
        <button type="button" className="text-xs text-[#888888]">
          {t('notifications.markAllRead')}
        </button>
      </header>

      {list
        .filter((item) => filter === 'all' || item.type === filter)
        .map((item) => (
          <AINotificationBubble
            key={item.id}
            title={item.title}
            message={item.message}
            unread={item.unread}
            actionLabel={item.actionLabel}
            onAction={item.action}
          />
        ))}

      <button type="button" className="text-sm text-[#FF1F8E]" onClick={() => onNavigate('settings')}>
        {t('notifications.changeSettings')}
      </button>
    </div>
  );
}
