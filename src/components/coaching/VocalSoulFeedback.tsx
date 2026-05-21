// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import CoachVoicePlayer from './CoachVoicePlayer';
import type {
  VocalSoulFeedback as VocalSoulFeedbackData,
  VocalCoachPersona,
  VocalCharacteristics,
} from '../../hooks/useVocalSoulCoach';

interface Props {
  feedback: VocalSoulFeedbackData | null;
  coachPersona: VocalCoachPersona;
  language?: string;
  vocalCharacteristics?: VocalCharacteristics | null;
  loading?: boolean;
  phaseLabel?: string;
  autoPlay?: boolean;
}

export default function VocalSoulFeedback({
  feedback,
  coachPersona,
  language,
  vocalCharacteristics,
  loading = false,
  phaseLabel,
  autoPlay = true,
}: Props) {
  const { t } = useTranslation();

  if (loading && !feedback) {
    return (
      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 text-sm text-slate-500">
        {t('coaching.vocal.thinking')}
      </div>
    );
  }
  if (!feedback) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-4 text-sm text-slate-400">
        {t('coaching.vocal.empty')}
      </div>
    );
  }

  const pitch = Math.max(0, Math.min(100, Number(feedback.pitchScore) || 0));
  const soul = Math.max(0, Math.min(100, Number(feedback.soulScore) || 0));

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#FF1F8E]">
            {phaseLabel || t('coaching.vocal.tag')}
          </p>
          <p className="text-xs text-slate-500">
            {vocalCharacteristics
              ? `${vocalCharacteristics.type} · ${vocalCharacteristics.range}`
              : t('coaching.vocal.characteristicsLoading')}
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
        <ScorePill label={t('coaching.vocal.pitchScore')} value={pitch} color="#4A6BFF" />
        <ScorePill label={t('coaching.vocal.soulScore')} value={soul} color="#FF1F8E" />
      </div>

      {feedback.emotionImage ? (
        <div className="rounded-xl bg-[#F0F4FF] border border-[#4A6BFF]/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[#4A6BFF]">
            {t('coaching.vocal.emotionImage')}
          </p>
          <p className="text-xs text-[#111111] mt-0.5">{feedback.emotionImage}</p>
        </div>
      ) : null}

      {feedback.visualizationExercise ? (
        <div className="rounded-xl bg-[#FFF1F7] border border-[#FF1F8E]/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[#FF1F8E]">
            {t('coaching.vocal.visualization')}
          </p>
          <p className="text-xs text-[#111111] mt-0.5">{feedback.visualizationExercise}</p>
        </div>
      ) : null}

      <div className="space-y-1.5 text-xs text-slate-600">
        {feedback.technicalAsEmotion ? (
          <p>
            <span className="font-semibold text-slate-800">
              {t('coaching.vocal.technicalAsEmotion')}:
            </span>{' '}
            {feedback.technicalAsEmotion}
          </p>
        ) : null}
        {feedback.breathingTip ? (
          <p>
            <span className="font-semibold text-slate-800">
              {t('coaching.vocal.breathingTip')}:
            </span>{' '}
            {feedback.breathingTip}
          </p>
        ) : null}
        {feedback.soulDirection ? (
          <p>
            <span className="font-semibold text-slate-800">
              {t('coaching.vocal.soulDirection')}:
            </span>{' '}
            {feedback.soulDirection}
          </p>
        ) : null}
      </div>

      {feedback.encouragement ? (
        <p className="text-[11px] text-emerald-600">💪 {feedback.encouragement}</p>
      ) : null}
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
