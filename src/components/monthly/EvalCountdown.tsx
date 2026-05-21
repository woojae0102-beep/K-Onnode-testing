// @ts-nocheck
import React, { useMemo } from 'react';
import { Sparkles, Calendar, Flame, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MonthlyAccumulatedData } from '../../data/monthlyEvalData';

interface Props {
  daysLeft: number;
  monthlyStats: MonthlyAccumulatedData;
  onStart: () => void;
  isAvailable: boolean;
  isEvalDay: boolean;
  onSeedSample?: () => void;
}

export default function EvalCountdown({
  daysLeft,
  monthlyStats,
  onStart,
  isAvailable,
  isEvalDay,
  onSeedSample,
}: Props) {
  const { t } = useTranslation();
  const headlineIcon = isEvalDay ? Trophy : daysLeft <= 3 ? Flame : Calendar;
  const Icon = headlineIcon;
  const totalDays = monthlyStats?.consistency?.totalDays || 0;

  const headline = isEvalDay
    ? t('monthly.countdown.headlineToday')
    : daysLeft <= 3
    ? t('monthly.countdown.headlineHot', { days: daysLeft })
    : t('monthly.countdown.headlineFar', { days: daysLeft });

  const sub = isEvalDay
    ? t('monthly.countdown.subToday')
    : daysLeft <= 3
    ? t('monthly.countdown.subHot')
    : t('monthly.countdown.subFar');

  const topField = useMemo(() => {
    const dance = monthlyStats?.dance?.sessions || 0;
    const vocal = monthlyStats?.vocal?.sessions || 0;
    const korean = monthlyStats?.korean?.sessions || 0;
    const list = [
      { label: t('dashboard.abilities.dance'), count: dance },
      { label: t('dashboard.abilities.vocal'), count: vocal },
      { label: t('dashboard.abilities.korean'), count: korean },
    ];
    list.sort((a, b) => b.count - a.count);
    return list[0]?.count > 0
      ? t('monthly.countdown.previewFieldUnit', { label: list[0].label, count: list[0].count })
      : t('monthly.countdown.previewEmpty');
  }, [monthlyStats, t]);

  const avgScore = useMemo(() => {
    const danceAvg = monthlyStats?.dance?.avgScore || 0;
    const vocalAvg = monthlyStats?.vocal?.avgPitchAccuracy || 0;
    const koreanAvg = monthlyStats?.korean?.pronunciation || 0;
    const nums = [danceAvg, vocalAvg, koreanAvg].filter((n) => n > 0);
    if (!nums.length) return t('monthly.countdown.previewScoreEmpty');
    return t('monthly.countdown.previewScoreUnit', {
      value: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length),
    });
  }, [monthlyStats, t]);

  const statBox = (label: string, value: string | number, sub?: string) => (
    <div className="rounded-2xl border border-[#F0F0F0] bg-white px-4 py-3 flex-1 min-w-0">
      <p className="text-[11px] text-[#888888]">{label}</p>
      <p className="mt-1 text-xl font-black text-[#111111] truncate">{value}</p>
      {sub ? <p className="text-[10px] text-[#AAAAAA] mt-0.5 truncate">{sub}</p> : null}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{
          background: isEvalDay
            ? 'linear-gradient(135deg, #FF1F8E 0%, #FF6BB1 100%)'
            : daysLeft <= 3
            ? 'linear-gradient(135deg, #FF6B35 0%, #FF1F8E 100%)'
            : 'linear-gradient(135deg, #111111 0%, #1F1F1F 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 grid place-items-center">
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/70">{t('monthly.tag')}</p>
            <p className="text-[15px] font-bold mt-0.5">{monthlyStats?.month}</p>
          </div>
        </div>
        <h2 className="mt-4 text-2xl font-black leading-tight">{headline}</h2>
        <p className="mt-2 text-[13px] text-white/85 leading-relaxed">{sub}</p>

        <div className={`mt-5 ${isEvalDay && 'animate-pulse'}`}>
          <button
            type="button"
            onClick={onStart}
            disabled={!isAvailable && !isEvalDay}
            className="inline-flex items-center gap-2 rounded-2xl bg-white text-[#111111] px-5 py-3 text-sm font-bold shadow-lg disabled:opacity-50"
          >
            <Sparkles size={16} />
            {isEvalDay || isAvailable
              ? t('monthly.countdown.startBtn')
              : t('monthly.countdown.waitingBtn', { days: daysLeft })}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-[#888888] mb-2">{t('monthly.countdown.previewLabel')}</p>
        <div className="flex gap-2">
          {statBox(
            t('monthly.countdown.previewDays'),
            t('monthly.countdown.previewDayUnit', { count: totalDays }),
            t('monthly.countdown.previewDaysSub'),
          )}
          {statBox(t('monthly.countdown.previewAvg'), avgScore, t('monthly.countdown.previewAvgSub'))}
          {statBox(t('monthly.countdown.previewTop'), topField)}
        </div>
      </div>

      {!isAvailable && !isEvalDay && totalDays === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-4 text-xs text-[#888888]">
          {t('monthly.countdown.sampleNotice')}
          {onSeedSample ? (
            <button
              type="button"
              onClick={onSeedSample}
              className="mt-3 block rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-semibold text-[#111111]"
            >
              {t('monthly.countdown.sampleBtn')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
