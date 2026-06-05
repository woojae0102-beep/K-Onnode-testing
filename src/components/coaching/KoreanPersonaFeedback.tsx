// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import CoachVoicePlayer from './CoachVoicePlayer';

export default function KoreanPersonaFeedback({
  feedback,
  personaName,
  language = 'ko',
  loading = false,
  phaseLabel,
  autoPlay = true,
  playbackSpeed = 1,
}) {
  const { t } = useTranslation();

  if (loading && !feedback) {
    return (
      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 text-sm text-slate-500">
        {t('coaching.korean.thinking')}
      </div>
    );
  }
  if (!feedback) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-4 text-sm text-slate-400">
        {t('coaching.korean.empty')}
      </div>
    );
  }

  const accuracy = Math.max(0, Math.min(100, Number(feedback.accuracy) || 0));

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#1DB971]">
            {phaseLabel || t('coaching.korean.tag')}
          </p>
          <p className="text-xs text-slate-500">
            {personaName ? `${personaName} · ` : ''}
            {t('coaching.korean.accuracy', { value: accuracy })}
          </p>
        </div>
        <CoachVoicePlayer
          coachLine={feedback.coachLine}
          coachPersona="hybe_soul"
          language={language}
          autoPlay={autoPlay}
          playbackSpeed={playbackSpeed}
        />
      </div>

      <p className="text-base font-semibold text-[#111111] leading-snug">"{feedback.coachLine}"</p>

      {feedback.correctedReading ? (
        <div className="rounded-xl bg-[#F0FFF7] border border-[#1DB971]/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[#1DB971]">
            {t('coaching.korean.correctReading')}
          </p>
          <p className="text-sm text-[#111111] mt-0.5">{feedback.correctedReading}</p>
        </div>
      ) : null}

      {Array.isArray(feedback.syllableTips) && feedback.syllableTips.length ? (
        <ul className="space-y-1">
          {feedback.syllableTips.map((tip, idx) => (
            <li key={idx} className="text-xs text-[#555555]">
              • {tip}
            </li>
          ))}
        </ul>
      ) : null}

      {feedback.personaComment ? (
        <p className="text-xs text-slate-600">{feedback.personaComment}</p>
      ) : null}
      {feedback.encouragement ? (
        <p className="text-[11px] text-emerald-600">💪 {feedback.encouragement}</p>
      ) : null}
    </div>
  );
}
