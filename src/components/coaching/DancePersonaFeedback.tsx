// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import CoachVoicePlayer from './CoachVoicePlayer';
import type { DanceCoachFeedback, DanceCoachPersona } from '../../hooks/useDancePersonaCoach';

interface Props {
  feedback: DanceCoachFeedback | null;
  coachPersona: DanceCoachPersona;
  language?: string;
  personaName?: string;
  loading?: boolean;
  phaseLabel?: string;
  autoPlay?: boolean;
}

export default function DancePersonaFeedback({
  feedback,
  coachPersona,
  language,
  personaName,
  loading = false,
  phaseLabel,
  autoPlay = true,
}: Props) {
  const { t } = useTranslation();

  if (loading && !feedback) {
    return (
      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 text-sm text-slate-500">
        {t('coaching.dance.thinking')}
      </div>
    );
  }
  if (!feedback) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-4 text-sm text-slate-400">
        {t('coaching.dance.empty')}
      </div>
    );
  }

  const technical = Math.max(0, Math.min(100, Number(feedback.technicalScore) || 0));
  const emotional = Math.max(0, Math.min(100, Number(feedback.emotionalScore) || 0));

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#FF1F8E]">
            {phaseLabel || t('coaching.dance.tag')}
          </p>
          <p className="text-xs text-slate-500">
            {personaName ? `${personaName} · ` : ''}
            {feedback.personaActivated
              ? t('coaching.dance.activated')
              : t('coaching.dance.activatingHint')}
          </p>
        </div>
        <CoachVoicePlayer
          coachLine={feedback.coachLine}
          coachPersona={coachPersona}
          language={language}
          autoPlay={autoPlay}
        />
      </div>

      <p className="text-base font-semibold text-[#111111] leading-snug">
        “{feedback.coachLine}”
      </p>

      <div className="grid grid-cols-2 gap-2">
        <ScorePill label={t('coaching.dance.technicalScore')} value={technical} color="#4A6BFF" />
        <ScorePill label={t('coaching.dance.emotionalScore')} value={emotional} color="#FF1F8E" />
      </div>

      {feedback.keyCorrection ? (
        <div className="rounded-xl bg-[#FFF1F7] border border-[#FF1F8E]/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[#FF1F8E]">
            {t('coaching.dance.keyCorrection')}
          </p>
          <p className="text-xs text-[#111111] mt-0.5">{feedback.keyCorrection}</p>
        </div>
      ) : null}

      {feedback.personaComment ? (
        <p className="text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">
            {t('coaching.dance.personaComment')}:
          </span>{' '}
          {feedback.personaComment}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
        {feedback.encouragement ? (
          <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5">
            💪 {feedback.encouragement}
          </span>
        ) : null}
        {feedback.nextFocus ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            🎯 {feedback.nextFocus}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-[#F5F5F7] px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-xl font-black text-[#111111]">{value}</p>
        <span className="text-[10px] text-slate-400">/100</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}
