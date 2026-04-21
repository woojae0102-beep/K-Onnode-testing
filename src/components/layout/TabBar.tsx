// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Home, MessageCircle, Bot, Compass } from 'lucide-react';

const TABS = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'chat', labelKey: 'nav.chat', icon: MessageCircle },
  { id: 'aicoach', labelKey: 'nav.aicoach', icon: Bot },
  { id: 'discover', labelKey: 'nav.discover', icon: Compass },
];

export default function TabBar({ activeTab, onChangeTab, layout = 'top' }) {
  const { t } = useTranslation();
  const isBottom = layout === 'bottom';
  return (
    <nav
      className={`flex w-full ${isBottom ? 'bg-white' : ''}`}
      style={{
        height: isBottom ? 56 : 40,
        borderTop: isBottom ? '1px solid #F0F0F0' : 'none',
        borderBottom: !isBottom ? '1px solid #F0F0F0' : 'none',
      }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className="flex-1 transition-colors"
            style={{
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? '#FF1F8E' : '#888888',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderBottom: !isBottom && active ? '2px solid #FF1F8E' : '2px solid transparent',
              borderTop: isBottom && active ? '2px solid #FF1F8E' : '2px solid transparent',
              padding: isBottom ? '4px 4px 6px' : 0,
              display: 'flex',
              flexDirection: isBottom ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isBottom ? 2 : 0,
            }}
          >
            {isBottom ? <Icon size={20} /> : null}
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export { TABS };
