// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { GroupMatch } from '../../data/monthlyEvalData';

export default function GroupMatchCard({ match }: { match: GroupMatch | null }) {
  const { t } = useTranslation();
  if (!match) return null;
  return (
    <div className="rounded-3xl p-5 bg-gradient-to-br from-[#FFF0F7] to-[#FFE7F1] border border-[#FFC1DD]">
      <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">AI Group Match</p>
      <p className="text-base font-bold text-[#111] mt-0.5">{t('monthly.labels.groupMatch')}</p>
      <h3 className="mt-3 text-2xl font-black text-[#FF1F8E]">{match.primaryGroup}</h3>
      {match.reason ? <p className="text-sm text-[#444] mt-2 leading-relaxed">{match.reason}</p> : null}
      {match.alternativeGroup ? (
        <div className="mt-3 inline-block rounded-full bg-white border border-[#FFC1DD] px-3 py-1 text-xs text-[#A21054]">
          {t('monthly.labels.groupMatchAlt', { label: match.alternativeGroup })}
        </div>
      ) : null}
    </div>
  );
}
