// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SurvivalStatus } from '../../data/monthlyEvalData';

const META: Record<SurvivalStatus, { emoji: string; bg: string; color: string; border: string }> = {
  debut_candidate: {
    emoji: '🏆',
    bg: 'linear-gradient(135deg, #FFD66B 0%, #FF9F1C 100%)',
    color: '#3F2A05',
    border: '#F2A714',
  },
  top30: {
    emoji: '⭐',
    bg: 'linear-gradient(135deg, #FF6BB1 0%, #FF1F8E 100%)',
    color: '#FFFFFF',
    border: '#FF1F8E',
  },
  hold: {
    emoji: '📋',
    bg: '#F5F5F7',
    color: '#444',
    border: '#D4D4D4',
  },
  danger: {
    emoji: '⚠️',
    bg: 'linear-gradient(135deg, #FCA5A5 0%, #DC2626 100%)',
    color: '#FFFFFF',
    border: '#DC2626',
  },
  eliminated: {
    emoji: '💀',
    bg: '#1F1F1F',
    color: '#FFFFFF',
    border: '#1F1F1F',
  },
};

export default function SurvivalBadge({ status, message }: { status: SurvivalStatus; message?: string }) {
  const { t } = useTranslation();
  const meta = META[status] || META.hold;
  const label = t(`monthly.survival.${status}`, { defaultValue: status });
  return (
    <div
      className="rounded-3xl p-5 border"
      style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{meta.emoji}</div>
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider opacity-70">{t('monthly.survival.title')}</p>
          <p className="text-2xl font-black mt-0.5">{label}</p>
        </div>
      </div>
      {message ? <p className="mt-3 text-sm leading-relaxed">{message}</p> : null}
    </div>
  );
}
