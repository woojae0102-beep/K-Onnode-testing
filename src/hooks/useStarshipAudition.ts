// @ts-nocheck
// STARSHIP 오디션 전용 훅 — 3명의 STARSHIP 심사위원 AI를 동시에 호출하고 토론·최종 결과까지 조율합니다.
// 한승훈(스타성·결정권) · 박나리(퍼포먼스·카메라) · 최지수(트레이닝·장기 성장)

import { useCallback, useEffect, useRef, useState } from 'react';

export type StarshipPhase = 'idle' | 'performing' | 'interview' | 'deliberation' | 'result';

export type StarshipJudgeId = 'starship-seunghoon' | 'starship-nari' | 'starship-jisoo';

export type StarshipVerdict = 'pass' | 'conditional' | 'training_recommended' | 'fail';

export type StarshipJudgeReaction = {
  speaking?: string;
  scores?: Record<string, number>;
  verdict?: StarshipVerdict;
  strongPoints?: string[];
  improvements?: string[];
  closing?: string;
  debatePosition?: string;
  // 한승훈 고유
  starshipKeyword?: string;
  centerType?: string;
  marketReaction?: string;
  publicAppealLevel?: string;
  // 박나리 고유
  cameraReaction?: string;
  expressionFlow?: string;
  cameraType?: string;
  performanceLine?: string;
  cameraRetention?: string;
  // 최지수 고유
  growthView?: string;
  teamFit?: string;
  trainingType?: string;
  longTermProjection?: string;
  teamSynergy?: string;
  source?: 'claude' | 'fallback';
};

export type StarshipJudgeState = {
  messages: { role: 'judge' | 'user'; text: string; timestamp: number }[];
  currentReaction: StarshipJudgeReaction | null;
  finalEval: StarshipJudgeReaction | null;
};

export type StarshipDebateScript = {
  round1: {
    speaker: string;
    line: string;
    starshipKeyword?: string;
    cameraReaction?: string;
    expressionFlow?: string;
    growthView?: string;
    teamFit?: string;
  }[];
  round2_conflict: { speaker: string; line: string }[];
  starshipPhilosophyMoment?: string;
  finalVoteDeclaration: { speaker: string; vote: StarshipVerdict | string; line: string }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerDecision?: StarshipVerdict | string | null;
  tiebreakerLine?: string | null;
  tiebreakerReason?: string | null;
};

export type StarshipMarketEvaluation = {
  publicAppeal?: string;
  centerPotential?: string;
  teamBalance?: string;
  cameraFriendliness?: string;
};

export type StarshipDebateResult = {
  debateNeeded: boolean;
  unanimousVerdict?: boolean;
  starshipCoreReason?: string;
  marketEvaluation?: StarshipMarketEvaluation | null;
  debateScript: StarshipDebateScript | null;
  finalVerdict: StarshipVerdict;
};

export type StarshipVerdictInfo = {
  title: string;
  message: string;
  color: string;
  starshipPhilosophy?: string;
  nextStep?: string;
};

export type StarshipRoutineWeek = {
  week: number;
  focus: string;
  daily: string[];
  goal: string;
  starshipPoint?: string;
};

export type StarshipJudgeSummary = {
  judgeId?: string;
  name: string;
  score: number;
  verdict: StarshipVerdict | string;
  scores?: Record<string, number>;
  summary?: string;
  strongPoints: string[];
  improvements: string[];
  closing: string;
  // 한승훈
  centerType?: string;
  marketReaction?: string;
  publicAppealLevel?: string;
  // 박나리
  cameraType?: string;
  performanceLine?: string;
  cameraRetention?: string;
  // 최지수
  trainingType?: string;
  longTermProjection?: string;
  teamSynergy?: string;
};

export type StarshipFinalResult = {
  finalVerdict: StarshipVerdict;
  avgScore: number;
  starshipStylePassed?: boolean;
  allCriteriaPass: boolean;
  individualPass: { seunghoon: boolean; nari: boolean; jisoo: boolean };
  judgeResults: any[];
  debateResult: StarshipDebateResult;
  verdictInfo: StarshipVerdictInfo;
  judgeSummaries: StarshipJudgeSummary[];
  debateHighlight?: string;
  starshipPhilosophyHighlight?: string;
  marketEvaluation?: StarshipMarketEvaluation | null;
  finalVotes?: Record<string, string>;
  decisionMethod?: 'unanimous' | 'majority' | 'producer_override' | string;
  routine: StarshipRoutineWeek[];
  starshipSpecialAdvice?: string;
  starshipWouldSay?: string;
  nextAuditionTarget?: string;
};

const INITIAL_JUDGE_STATE: Record<StarshipJudgeId, StarshipJudgeState> = {
  'starship-seunghoon': { messages: [], currentReaction: null, finalEval: null },
  'starship-nari': { messages: [], currentReaction: null, finalEval: null },
  'starship-jisoo': { messages: [], currentReaction: null, finalEval: null },
};

const ENDPOINTS: Record<StarshipJudgeId, string> = {
  'starship-seunghoon': '/api/audition/starship/judge-seunghoon',
  'starship-nari': '/api/audition/starship/judge-nari',
  'starship-jisoo': '/api/audition/starship/judge-jisoo',
};

async function callJudge(
  judgeId: StarshipJudgeId,
  payload: Record<string, any>,
): Promise<StarshipJudgeReaction> {
  try {
    const res = await fetch(ENDPOINTS[judgeId], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return await res.json();
  } catch {
    return { source: 'fallback' };
  }
}

export type UseStarshipAuditionOptions = {
  language?: string;
};

export function useStarshipAudition({ language = 'ko' }: UseStarshipAuditionOptions = {}) {
  const [phase, setPhase] = useState<StarshipPhase>('idle');
  const [judgeStates, setJudgeStates] =
    useState<Record<StarshipJudgeId, StarshipJudgeState>>(INITIAL_JUDGE_STATE);
  const [debateResult, setDebateResult] = useState<StarshipDebateResult | null>(null);
  const [finalResult, setFinalResult] = useState<StarshipFinalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phase === 'performing') {
      startedAtRef.current = Date.now();
    }
  }, [phase]);

  const getRealtimeReactions = useCallback(
    async (analysisData: Record<string, any>) => {
      const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const payload = {
        phase: 'realtime_react',
        auditionData: { currentAnalysis: analysisData, elapsedSeconds },
        language,
      };

      const [seunghoon, nari, jisoo] = await Promise.all([
        callJudge('starship-seunghoon', payload),
        callJudge('starship-nari', payload),
        callJudge('starship-jisoo', payload),
      ]);

      setJudgeStates((prev) => ({
        'starship-seunghoon': { ...prev['starship-seunghoon'], currentReaction: seunghoon },
        'starship-nari': { ...prev['starship-nari'], currentReaction: nari },
        'starship-jisoo': { ...prev['starship-jisoo'], currentReaction: jisoo },
      }));

      return { seunghoon, nari, jisoo };
    },
    [language],
  );

  const askInterview = useCallback(
    async (judgeId: StarshipJudgeId, performanceData: Record<string, any>) => {
      const reaction = await callJudge(judgeId, {
        phase: 'interview_question',
        auditionData: { performanceData },
        language,
      });
      setJudgeStates((prev) => ({
        ...prev,
        [judgeId]: {
          ...prev[judgeId],
          currentReaction: reaction,
          messages: [
            ...prev[judgeId].messages,
            { role: 'judge', text: reaction.speaking || '', timestamp: Date.now() },
          ],
        },
      }));
      return reaction;
    },
    [language],
  );

  const reactToAnswer = useCallback(
    async (judgeId: StarshipJudgeId, userAnswer: string, previousQuestion: string) => {
      const reaction = await callJudge(judgeId, {
        phase: 'react_to_answer',
        auditionData: { userAnswer, previousQuestion },
        language,
      });
      setJudgeStates((prev) => ({
        ...prev,
        [judgeId]: {
          ...prev[judgeId],
          currentReaction: reaction,
          messages: [
            ...prev[judgeId].messages,
            { role: 'user', text: userAnswer, timestamp: Date.now() },
            { role: 'judge', text: reaction.speaking || '', timestamp: Date.now() },
          ],
        },
      }));
      return reaction;
    },
    [language],
  );

  const getFinalEvaluations = useCallback(
    async (auditionData: Record<string, any>) => {
      setLoading(true);
      setError(null);
      setPhase('deliberation');

      try {
        const payload = { phase: 'final_evaluation', auditionData, language };
        const [seunghoon, nari, jisoo] = await Promise.all([
          callJudge('starship-seunghoon', payload),
          callJudge('starship-nari', payload),
          callJudge('starship-jisoo', payload),
        ]);

        setJudgeStates((prev) => ({
          'starship-seunghoon': { ...prev['starship-seunghoon'], finalEval: seunghoon },
          'starship-nari': { ...prev['starship-nari'], finalEval: nari },
          'starship-jisoo': { ...prev['starship-jisoo'], finalEval: jisoo },
        }));

        const judgeResults = [
          { ...seunghoon, judgeId: 'starship-seunghoon', name: '한승훈' },
          { ...nari, judgeId: 'starship-nari', name: '박나리' },
          { ...jisoo, judgeId: 'starship-jisoo', name: '최지수' },
        ];

        const debateRes = await fetch('/api/audition/starship/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, language }),
        });
        const debateData: StarshipDebateResult = debateRes.ok
          ? await debateRes.json()
          : {
              debateNeeded: false,
              debateScript: null,
              finalVerdict: 'conditional',
            };
        setDebateResult(debateData);

        const finalRes = await fetch('/api/audition/starship/final-verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, debateResult: debateData, auditionData, language }),
        });
        const finalData: StarshipFinalResult = finalRes.ok
          ? await finalRes.json()
          : {
              finalVerdict: debateData.finalVerdict,
              avgScore: 0,
              allCriteriaPass: false,
              individualPass: { seunghoon: false, nari: false, jisoo: false },
              judgeResults,
              debateResult: debateData,
              verdictInfo: {
                title: '결과 처리 중 오류',
                message: '잠시 후 다시 시도해주세요.',
                color: '#2D3436',
                starshipPhilosophy: '',
                nextStep: '재시도해주세요.',
              },
              judgeSummaries: [],
              debateHighlight: '',
              starshipPhilosophyHighlight: '',
              finalVotes: {},
              decisionMethod: 'majority',
              routine: [],
              starshipSpecialAdvice: '',
              starshipWouldSay: '',
              nextAuditionTarget: '6개월 후',
            };

        setFinalResult(finalData);
        setPhase('result');
        return finalData;
      } catch (err: any) {
        setError(err?.message || '최종 평가 중 오류가 발생했습니다.');
        setPhase('result');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  const reset = useCallback(() => {
    setJudgeStates(INITIAL_JUDGE_STATE);
    setDebateResult(null);
    setFinalResult(null);
    setLoading(false);
    setError(null);
    setPhase('idle');
  }, []);

  return {
    phase,
    setPhase,
    judgeStates,
    debateResult,
    finalResult,
    loading,
    error,
    getRealtimeReactions,
    askInterview,
    reactToAnswer,
    getFinalEvaluations,
    reset,
  };
}
