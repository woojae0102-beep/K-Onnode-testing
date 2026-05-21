// @ts-nocheck
import { useCallback, useState } from 'react';
import {
  AGENCY_IDS,
  AgencyEvaluation,
  AgencyId,
  EvalPhase,
  JudgeDebate,
  MonthlyAccumulatedData,
  MonthlyResult,
  TraineeAIProfile,
} from '../data/monthlyEvalData';

async function postJson<T>(url: string, payload: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface RunEvalArgs {
  monthlyData: MonthlyAccumulatedData;
  previousResults: MonthlyResult[];
  language: string;
  onPhase?: (phase: EvalPhase) => void;
  onAgencyDone?: (id: AgencyId, evalData: AgencyEvaluation) => void;
}

export function useMonthlyEval() {
  const [phase, setPhase] = useState<EvalPhase>('countdown');
  const [error, setError] = useState<string | null>(null);
  const [traineeProfile, setTraineeProfile] = useState<TraineeAIProfile | null>(null);
  const [agencyEvals, setAgencyEvals] = useState<Record<AgencyId, AgencyEvaluation> | null>(null);
  const [debate, setDebate] = useState<JudgeDebate | null>(null);
  const [finalResult, setFinalResult] = useState<MonthlyResult | null>(null);

  const updatePhase = useCallback((next: EvalPhase, cb?: (phase: EvalPhase) => void) => {
    setPhase(next);
    cb?.(next);
  }, []);

  const reset = useCallback(() => {
    setPhase('countdown');
    setError(null);
    setTraineeProfile(null);
    setAgencyEvals(null);
    setDebate(null);
    setFinalResult(null);
  }, []);

  const runEvaluation = useCallback(
    async ({ monthlyData, previousResults, language, onPhase, onAgencyDone }: RunEvalArgs) => {
      setError(null);
      try {
        updatePhase('profile', onPhase);
        const profile = await postJson<TraineeAIProfile>('/api/monthly/generate-profile', {
          monthlyData,
          previousResults,
          language,
        });
        setTraineeProfile(profile);

        updatePhase('agency_evals', onPhase);
        const collected: Record<string, AgencyEvaluation> = {} as any;
        const agencyResults = await Promise.all(
          AGENCY_IDS.map(async (id) => {
            const evalResult = await postJson<AgencyEvaluation>('/api/monthly/agency-eval', {
              agencyId: id,
              monthlyData,
              traineeProfile: profile,
              language,
            });
            collected[id] = evalResult;
            onAgencyDone?.(id, evalResult);
            return [id, evalResult] as const;
          })
        );
        const evalsMap = Object.fromEntries(agencyResults) as Record<AgencyId, AgencyEvaluation>;
        setAgencyEvals(evalsMap);

        updatePhase('debate', onPhase);
        const debateResult = await postJson<JudgeDebate>('/api/monthly/judge-debate', {
          agencyEvaluations: evalsMap,
          traineeProfile: profile,
          monthlyData,
          language,
        });
        setDebate(debateResult);

        updatePhase('final', onPhase);
        const finalRaw = await postJson<MonthlyResult>('/api/monthly/final-result', {
          agencyEvaluations: evalsMap,
          traineeProfile: profile,
          monthlyData,
          previousResults,
          language,
        });
        const finalWithMonth: MonthlyResult = {
          ...finalRaw,
          month: monthlyData.month,
          agencyPassRates: AGENCY_IDS.reduce<Record<string, number>>((acc, id) => {
            acc[id] = evalsMap[id]?.passRate || 0;
            return acc;
          }, {}),
        };
        setFinalResult(finalWithMonth);

        updatePhase('complete', onPhase);
        return {
          profile,
          agencyEvals: evalsMap,
          debate: debateResult,
          finalResult: finalWithMonth,
        };
      } catch (err: any) {
        setError(String(err?.message || err));
        updatePhase('countdown', onPhase);
        throw err;
      }
    },
    [updatePhase]
  );

  return {
    phase,
    error,
    traineeProfile,
    agencyEvals,
    debate,
    finalResult,
    runEvaluation,
    reset,
  };
}
