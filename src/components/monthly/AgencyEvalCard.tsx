// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AgencyEvaluation, AGENCY_COLORS, AGENCY_LABELS, AgencyId } from '../../data/monthlyEvalData';

interface Props {
  agencyId: AgencyId;
  evaluation: AgencyEvaluation | null;
  loading?: boolean;
}

const TONE_BG: Record<string, string> = {
  positive: '#ECFDF5',
  critical: '#FEF2F2',
  neutral: '#F5F5F7',
  impressed: '#FFF0F7',
  conflicted: '#FFFBEB',
};

const TONE_TEXT: Record<string, string> = {
  positive: '#059669',
  critical: '#DC2626',
  neutral: '#525252',
  impressed: '#FF1F8E',
  conflicted: '#B45309',
};

export default function AgencyEvalCard({ agencyId, evaluation, loading }: Props) {
  const { t } = useTranslation();
  const accent = AGENCY_COLORS[agencyId];
  const name = AGENCY_LABELS[agencyId];

  if (loading || !evaluation) {
    return (
      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
            <p className="font-bold text-[#111111]">{name}</p>
          </div>
          <p className="text-xs text-[#999]">{t('monthly.agency.loading')}</p>
        </div>
        <div className="mt-3 h-4 bg-[#F0F0F0] rounded" />
        <div className="mt-2 h-3 bg-[#F5F5F5] rounded w-3/4" />
      </div>
    );
  }

  const passRate = Math.max(0, Math.min(100, Math.round(evaluation.passRate || 0)));

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
          <p className="font-bold text-[#111111]">{name}</p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-black text-white"
          style={{ background: accent }}
        >
          {evaluation.overallGrade}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-[#666] mb-1">
          <span>{t('monthly.agency.passRate')}</span>
          <span className="font-bold text-[#111]">{passRate}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${passRate}%`, background: accent }}
          />
        </div>
      </div>

      {evaluation.verdict ? (
        <p className="mt-3 text-[12px] text-[#444]">“{evaluation.verdict}”</p>
      ) : null}

      <div className="mt-3 space-y-2">
        {(evaluation.judgeComments || []).map((c, idx) => (
          <div
            key={`${agencyId}-${idx}`}
            className="rounded-xl px-3 py-2 text-[12px] leading-relaxed"
            style={{ background: TONE_BG[c.tone] || '#F5F5F7', color: TONE_TEXT[c.tone] || '#525252' }}
          >
            <span className="mr-2">{c.avatar}</span>
            <span className="font-bold">{c.judgeName}</span>
            <span className="mx-1 opacity-60">·</span>
            <span>{c.comment}</span>
          </div>
        ))}
      </div>

      {evaluation.recommendation ? (
        <p className="mt-3 text-[11px] text-[#888888]">
          <span className="font-bold text-[#555]">{t('monthly.agency.advice')}</span>
          {evaluation.recommendation}
        </p>
      ) : null}
    </div>
  );
}
