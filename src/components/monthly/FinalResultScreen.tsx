// @ts-nocheck
import React, { useMemo, useRef } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Plus, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AGENCY_COLORS,
  AGENCY_IDS,
  AGENCY_LABELS,
  AgencyEvaluation,
  AgencyId,
  HistoryEntry,
  JudgeDebate,
  MonthlyResult,
  TraineeAIProfile,
} from '../../data/monthlyEvalData';
import TraineeProfile from './TraineeProfile';
import DebutProbabilityChart from './DebutProbabilityChart';
import SurvivalBadge from './SurvivalBadge';
import JudgeDebateScreen from './JudgeDebateScreen';
import TraineeHistoryTimeline from './TraineeHistoryTimeline';
import GroupMatchCard from './GroupMatchCard';

interface Props {
  traineeProfile: TraineeAIProfile;
  agencyEvals: Record<AgencyId, AgencyEvaluation>;
  debate: JudgeDebate | null;
  finalResult: MonthlyResult;
  previousResults: MonthlyResult[];
  month: string;
  onRestart?: () => void;
}

const CHANGE_ICON = {
  up: ArrowUp,
  down: ArrowDown,
  stable: ArrowRight,
  new: Plus,
};

const CHANGE_COLOR = {
  up: '#22C55E',
  down: '#DC2626',
  stable: '#94A3B8',
  new: '#FF1F8E',
};

export default function FinalResultScreen({
  traineeProfile,
  agencyEvals,
  debate,
  finalResult,
  previousResults,
  month,
  onRestart,
}: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const sortedAgencies = useMemo(() => {
    return AGENCY_IDS
      .map((id) => ({ id, eval: agencyEvals?.[id] }))
      .filter((x) => x.eval)
      .sort((a, b) => (b.eval.passRate || 0) - (a.eval.passRate || 0));
  }, [agencyEvals]);

  const historyWithCurrent: HistoryEntry[] = useMemo(() => {
    const past = (finalResult?.traineeHistory || []).filter((h) => h.month && h.month !== month);
    return [
      ...past,
      {
        month,
        event:
          finalResult?.biggestGrowth ||
          traineeProfile?.traineeType ||
          t('monthly.phase.complete'),
        tone: (finalResult?.debutProbabilityChange || 0) >= 0 ? 'positive' : 'negative',
      },
    ];
  }, [finalResult, traineeProfile, month, t]);

  const handleShare = async () => {
    const summary = t('monthly.shareSummary', {
      month,
      type: traineeProfile?.traineeType || '',
      grade: finalResult?.overallGrade || '',
      prob: finalResult?.debutProbability || 0,
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: `ONNODE · ${t('monthly.title')}`, text: summary });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(summary);
      alert(t('monthly.shareCopied'));
    } catch {
      alert(summary);
    }
  };

  const handleSaveCard = async () => {
    try {
      const mod = await import('html2canvas').catch(() => null);
      if (!mod || !cardRef.current) {
        alert(t('monthly.shareErr'));
        return;
      }
      const html2canvas = mod.default || mod;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#FFFFFF' });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `monthly-eval-${month}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert(t('monthly.shareErrSave'));
    }
  };

  return (
    <div className="p-6 pb-12 space-y-5" ref={cardRef}>
      <TraineeProfile profile={traineeProfile} month={month} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
          <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.labels.overallGrade')}</p>
          <p className="text-base font-bold text-[#111] mt-0.5">{t('monthly.labels.overallGrade')}</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-6xl font-black text-[#111] leading-none">
              {finalResult?.overallGrade || '—'}
            </p>
            <div className="pb-1">
              <p className="text-xs text-[#888]">{t('monthly.labels.totalScore')}</p>
              <p className="text-xl font-black text-[#FF1F8E]">{finalResult?.overallScore ?? 0}</p>
            </div>
          </div>
          {finalResult?.aiJudgeSummary ? (
            <p className="mt-3 text-[12px] text-[#444] leading-relaxed">{finalResult.aiJudgeSummary}</p>
          ) : null}
        </div>

        <SurvivalBadge status={finalResult?.survivalStatus} message={finalResult?.survivalMessage} />
      </div>

      <DebutProbabilityChart history={previousResults} current={finalResult} />

      <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
        <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.labels.agencyPassRate')}</p>
        <p className="text-base font-bold text-[#111] mt-0.5">{t('monthly.labels.agencyPassRate')}</p>
        <div className="mt-3 space-y-2">
          {sortedAgencies.map(({ id, eval: ev }, idx) => {
            const accent = AGENCY_COLORS[id];
            const rate = Math.round(ev.passRate || 0);
            return (
              <div key={id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#111] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                    {AGENCY_LABELS[id]}
                    {idx === 0 ? <span className="text-[10px] text-[#FF1F8E]">{t('monthly.labels.agencyTop')}</span> : null}
                  </span>
                  <span className="font-black text-[#111]">
                    {rate}% <span className="text-[#888] font-bold">· {ev.overallGrade}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: accent }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {debate ? <JudgeDebateScreen debate={debate} /> : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
          <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.labels.positionChanges')}</p>
          <p className="text-base font-bold text-[#111] mt-0.5">{t('monthly.labels.positionChanges')}</p>
          <div className="mt-3 space-y-2">
            {(finalResult?.positionChanges || []).map((p, idx) => {
              const Icon = CHANGE_ICON[p.change] || ArrowRight;
              const color = CHANGE_COLOR[p.change] || '#94A3B8';
              return (
                <div key={`${p.position}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="text-[#222] font-semibold">{p.position}</span>
                  <span className="flex items-center gap-1.5 text-xs" style={{ color }}>
                    <Icon size={14} />
                    <span className="font-bold">{t(`monthly.positionChange.${p.change}`, { defaultValue: '' })}</span>
                    <span className="text-[#888] font-normal">· {p.detail}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#22C55E] font-bold">{t('monthly.growth.bestLabel')}</p>
            <p className="text-sm text-[#111] mt-0.5">🏆 {finalResult?.biggestGrowth || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#DC2626] font-bold">{t('monthly.growth.issueLabel')}</p>
            <p className="text-sm text-[#111] mt-0.5">⚠️ {finalResult?.biggestIssue || '—'}</p>
          </div>
          {finalResult?.specialAward ? (
            <div className="rounded-xl bg-[#FFF0F7] border border-[#FFC1DD] p-3 text-xs text-[#A21054]">
              {t('monthly.labels.specialAward', { label: finalResult.specialAward })}
            </div>
          ) : null}
        </div>
      </div>

      <TraineeHistoryTimeline history={historyWithCurrent} currentMonth={month} />

      <GroupMatchCard match={finalResult?.groupMatch} />

      <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5">
        <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.labels.nextGoals')}</p>
        <p className="text-base font-bold text-[#111] mt-0.5">{t('monthly.labels.nextGoals')}</p>
        <ol className="mt-3 space-y-2">
          {(finalResult?.nextMonthGoals || []).map((goal, idx) => (
            <li key={idx} className="flex gap-3 items-start text-sm text-[#222]">
              <span className="w-6 h-6 rounded-full bg-[#FF1F8E] text-white grid place-items-center text-xs font-bold flex-shrink-0">
                {idx + 1}
              </span>
              <span>{goal}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-3xl p-6 text-center text-white" style={{ background: 'linear-gradient(135deg, #FF1F8E, #7C3AED)' }}>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">{t('monthly.labels.finalMessage')}</p>
        <p className="mt-3 text-lg font-black leading-snug">
          “{finalResult?.emotionalMessage || t('monthly.profile.narrativeEmpty')}”
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={handleSaveCard}
            className="rounded-full bg-white text-[#111] px-4 py-2 text-xs font-bold inline-flex items-center gap-2"
          >
            {t('monthly.buttons.saveCard')}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="rounded-full bg-white/15 border border-white/40 text-white px-4 py-2 text-xs font-bold inline-flex items-center gap-2"
          >
            <Share2 size={14} /> {t('monthly.buttons.share')}
          </button>
          {onRestart ? (
            <button
              type="button"
              onClick={onRestart}
              className="rounded-full bg-white/10 border border-white/30 text-white px-4 py-2 text-xs font-semibold"
            >
              {t('monthly.buttons.restart')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
