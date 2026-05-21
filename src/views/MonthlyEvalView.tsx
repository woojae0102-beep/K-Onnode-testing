// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/languageStore';
import { useMonthlyData, formatMonth } from '../hooks/useMonthlyData';
import { useMonthlyEval } from '../hooks/useMonthlyEval';
import {
  AGENCY_IDS,
  AgencyEvaluation,
  AgencyId,
  EvalPhase,
} from '../data/monthlyEvalData';
import EvalCountdown from '../components/monthly/EvalCountdown';
import AgencyEvalCard from '../components/monthly/AgencyEvalCard';
import FinalResultScreen from '../components/monthly/FinalResultScreen';
import SubscriptionGate from '../components/auth/SubscriptionGate';

const PHASE_KEYS: Record<EvalPhase, string> = {
  countdown: 'monthly.phase.countdown',
  profile: 'monthly.phase.profile',
  agency_evals: 'monthly.phase.agency_evals',
  debate: 'monthly.phase.debate',
  final: 'monthly.phase.final',
  complete: 'monthly.phase.complete',
};

function MonthlyEvalContent() {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language) || 'ko';

  const {
    recordSession,
    getMonthlyData,
    previousResults,
    saveMonthlyResult,
    getEvalCountdown,
    isEvalAvailable,
    isEvalDay,
    seedSampleData,
  } = useMonthlyData();

  const {
    phase,
    error,
    traineeProfile,
    agencyEvals,
    debate,
    finalResult,
    runEvaluation,
    reset,
  } = useMonthlyEval();

  const [agencyProgress, setAgencyProgress] = useState<Record<AgencyId, AgencyEvaluation | null>>({
    hybe: null,
    yg: null,
    jyp: null,
    sm: null,
    starship: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const month = useMemo(() => formatMonth(new Date()), []);
  const daysLeft = getEvalCountdown();
  const available = isEvalAvailable();
  const evalDay = isEvalDay();

  const monthlyData = useMemo(() => getMonthlyData(month), [getMonthlyData, month, tick]);

  const handleStart = useCallback(async () => {
    setAgencyProgress({ hybe: null, yg: null, jyp: null, sm: null, starship: null });
    try {
      const result = await runEvaluation({
        monthlyData,
        previousResults,
        language,
        onAgencyDone: (id, ev) =>
          setAgencyProgress((prev) => ({ ...prev, [id]: ev })),
      });
      if (result?.finalResult) {
        saveMonthlyResult(month, result.finalResult);
      }
    } catch (err) {
      console.error('[monthly-eval] failed:', err);
    }
  }, [language, month, monthlyData, previousResults, runEvaluation, saveMonthlyResult]);

  const handleRestart = useCallback(() => {
    reset();
    setAgencyProgress({ hybe: null, yg: null, jyp: null, sm: null, starship: null });
  }, [reset]);

  if (phase === 'countdown') {
    return (
      <div className="h-full overflow-y-auto bg-[#F5F5F7]">
        <EvalCountdown
          daysLeft={daysLeft}
          monthlyStats={monthlyData}
          isAvailable={available}
          isEvalDay={evalDay}
          onStart={handleStart}
          onSeedSample={seedSampleData}
        />

        {previousResults?.length ? (
          <div className="px-6 pb-10">
            <p className="text-xs text-[#888] mb-2">{t('monthly.countdown.historyHeader')}</p>
            <div className="space-y-2">
              {previousResults.slice(-3).reverse().map((r) => (
                <div key={r.month} className="flex items-center justify-between rounded-2xl border border-[#E5E5E5] bg-white p-3">
                  <div>
                    <p className="text-sm font-bold text-[#111]">{r.month}</p>
                    <p className="text-xs text-[#888]">{t('monthly.countdown.historyDebutPct', { value: r.debutProbability })}</p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-black text-white bg-[#FF1F8E]">
                    {r.overallGrade}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === 'complete' && finalResult && traineeProfile) {
    return (
      <div className="h-full overflow-y-auto bg-[#F5F5F7]">
        <FinalResultScreen
          traineeProfile={traineeProfile}
          agencyEvals={agencyEvals as Record<AgencyId, AgencyEvaluation>}
          debate={debate}
          finalResult={finalResult}
          previousResults={previousResults}
          month={month}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  // Loading phases
  return (
    <div className="h-full overflow-y-auto bg-[#F5F5F7]">
      <div className="p-6 space-y-5">
        <div className="rounded-3xl p-6 text-white"
             style={{ background: 'linear-gradient(135deg, #111 0%, #1F1F1F 60%, #FF1F8E 200%)' }}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
            <Sparkles size={14} /> {t('monthly.tag')} · {month}
          </div>
          <h2 className="mt-3 text-2xl font-black">{t('monthly.loadingTitle')}</h2>
          <p className="mt-2 text-sm text-white/80">{t(PHASE_KEYS[phase])}</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {(['profile', 'agency_evals', 'debate', 'final'] as EvalPhase[]).map((p) => {
              const order = { profile: 0, agency_evals: 1, debate: 2, final: 3 };
              const idx = order[p];
              const currentIdx = order[phase] ?? -1;
              const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'todo';
              return (
                <div
                  key={p}
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: state === 'todo' ? 'rgba(255,255,255,0.15)' : '#FF1F8E' }}
                >
                  {state === 'current' ? (
                    <div className="h-full w-1/2 bg-white animate-pulse" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {phase === 'profile' && (
          <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5 animate-pulse">
            <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.profile.tagLine')}</p>
            <div className="mt-3 h-6 bg-[#F0F0F0] rounded w-2/3" />
            <div className="mt-2 h-4 bg-[#F5F5F5] rounded w-3/4" />
            <div className="mt-2 h-4 bg-[#F5F5F5] rounded w-1/2" />
          </div>
        )}

        {(phase === 'agency_evals' || phase === 'debate' || phase === 'final') && (
          <div className="grid sm:grid-cols-2 gap-3">
            {AGENCY_IDS.map((id) => (
              <AgencyEvalCard
                key={id}
                agencyId={id}
                evaluation={agencyProgress[id]}
                loading={!agencyProgress[id]}
              />
            ))}
          </div>
        )}

        {(phase === 'debate' || phase === 'final') && (
          <div className="rounded-3xl border border-[#E5E5E5] bg-white p-5 animate-pulse">
            <p className="text-[11px] uppercase tracking-wider text-[#FF1F8E] font-bold">{t('monthly.debate.tag')}</p>
            <div className="mt-3 space-y-2">
              <div className="h-4 bg-[#F0F0F0] rounded w-3/4" />
              <div className="h-4 bg-[#F5F5F5] rounded w-2/3" />
              <div className="h-4 bg-[#F0F0F0] rounded w-4/5" />
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {t('monthly.errorPrefix')} {error}
            <button type="button" onClick={handleRestart} className="ml-3 underline">
              {t('monthly.errorRestart')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MonthlyEvalView() {
  return (
    <SubscriptionGate
      requiredPlan="premium"
      featureKey="monthly_eval"
      featureName="AI 월말 평가"
    >
      <MonthlyEvalContent />
    </SubscriptionGate>
  );
}

export { useMonthlyData };
