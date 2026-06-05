// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HOME_MY_MENUS, HOME_TRAINING_MENUS } from '../../config/homeTrainingMenus';

const DISCOVER_SECTIONS = [
  { icon: '🔥', labelKey: 'leftPanel.trending', view: 'trending' },
  { icon: '💃', labelKey: 'leftPanel.popularDance', view: 'popular-dance' },
  { icon: '🎵', labelKey: 'leftPanel.popularSongs', view: 'popular-songs' },
  { icon: '🏆', labelKey: 'leftPanel.challenges', view: 'challenges' },
];

function MenuPill({ item, active, onSelect, t }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item.view)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        minHeight: 40,
        borderRadius: 999,
        border: `1px solid ${active ? '#FF1F8E' : '#E5E5E5'}`,
        background: active ? '#FFF0F7' : '#FFFFFF',
        color: active ? '#FF1F8E' : '#555555',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        flexShrink: 0,
        touchAction: 'manipulation',
      }}
    >
      <span style={{ fontSize: 14 }}>{item.icon}</span>
      <span>{t(item.labelKey)}</span>
      {item.accent ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: '#FF1F8E',
            background: '#FFF0F7',
            padding: '1px 5px',
            borderRadius: 3,
            letterSpacing: '0.04em',
            marginLeft: 2,
          }}
        >
          NEW
        </span>
      ) : null}
    </button>
  );
}

function MenuRow({ title, items, mainView, onSelectView, t }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p
        style={{
          margin: '0 0 6px 12px',
          fontSize: 10,
          fontWeight: 600,
          color: '#999999',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 12px 8px',
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {items.map((item) => (
          <MenuPill
            key={item.view}
            item={item}
            active={mainView === item.view}
            onSelect={onSelectView}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

export default function MobileSectionBar({ activeTab, mainView, onSelectView }) {
  const { t } = useTranslation();

  if (activeTab === 'home') {
    return (
      <div
        className="md:hidden"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #F0F0F0',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingTop: 8,
          }}
        >
          <MenuRow
            title={t('leftPanel.training')}
            items={HOME_TRAINING_MENUS}
            mainView={mainView}
            onSelectView={onSelectView}
            t={t}
          />
        </div>
        <div
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 4,
          }}
        >
          <MenuRow
            title={t('leftPanel.myPage')}
            items={HOME_MY_MENUS}
            mainView={mainView}
            onSelectView={onSelectView}
            t={t}
          />
        </div>
      </div>
    );
  }

  if (activeTab === 'discover') {
    return (
      <div
        className="md:hidden"
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #F0F0F0',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          flexShrink: 0,
          padding: '8px 0',
        }}
      >
        <div style={{ display: 'flex', gap: 8, padding: '0 12px', width: 'max-content' }}>
          {DISCOVER_SECTIONS.map((item) => (
            <MenuPill
              key={item.view}
              item={item}
              active={mainView === item.view}
              onSelect={onSelectView}
              t={t}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
