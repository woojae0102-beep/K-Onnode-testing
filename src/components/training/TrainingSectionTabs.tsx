// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function TrainingSectionTabs({ active, onChange, variant = 'light' }) {
  const { t } = useTranslation();
  const isDark = variant === 'dark';

  const tabs = [
    { id: 'practice', labelKey: 'training.tabs.practice' },
    { id: 'teaching', labelKey: 'training.tabs.teaching' },
  ];

  return (
    <div
      className={`flex gap-2 p-1 rounded-xl mb-4 ${
        isDark ? 'bg-white/5 border border-white/10' : 'bg-[#F0F0F2] border border-[#E5E5E5]'
      }`}
      role="tablist"
      aria-label={t('training.tabs.aria')}
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(tab.id)}
            className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold touch-manipulation transition-colors ${
              selected
                ? isDark
                  ? 'bg-[#FF1F8E] text-white shadow-sm'
                  : 'bg-white text-[#FF1F8E] shadow-sm border border-[#FF1F8E]/20'
                : isDark
                  ? 'text-white/55 hover:text-white/80'
                  : 'text-[#888888] hover:text-[#555555]'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
