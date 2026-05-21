// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryEntry } from '../../data/monthlyEvalData';

interface Props {
  history: HistoryEntry[];
  currentMonth: string;
}

const TONE_COLOR: Record<string, string> = {
  positive: '#22C55E',
  negative: '#DC2626',
  neutral: '#94A3B8',
};

export default function TraineeHistoryTimeline({ history, currentMonth }: Props) {
  const { t } = useTranslation();
  const items = (history || []).slice(-6);

  return (
    <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
      <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.labels.history')}</p>
      <p className="text-base font-bold text-[#111] mt-0.5">{t('monthly.labels.historySub')}</p>

      <div className="mt-4 relative pl-5">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-[#E5E5E5]" />
        {items.length === 0 ? (
          <p className="text-sm text-[#888]">{t('monthly.labels.historyEmpty')}</p>
        ) : (
          items.map((entry, idx) => {
            const isCurrent = entry.month === currentMonth || idx === items.length - 1;
            const color = TONE_COLOR[entry.tone] || '#94A3B8';
            return (
              <div key={`${entry.month}-${idx}`} className="relative pb-4 last:pb-0">
                <div
                  className="absolute -left-5 top-1 w-3 h-3 rounded-full"
                  style={{
                    background: isCurrent ? '#FF1F8E' : color,
                    boxShadow: isCurrent ? '0 0 0 4px #FF1F8E33' : 'none',
                  }}
                />
                <p className={`text-[11px] uppercase tracking-wider ${isCurrent ? 'text-[#FF1F8E]' : 'text-[#888]'}`}>
                  {entry.month}
                  {isCurrent ? ` · ${t('monthly.labels.now')}` : ''}
                </p>
                <p className="text-sm text-[#222] mt-0.5">{entry.event}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
