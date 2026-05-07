// @ts-nocheck
// YG 오디션 전용 훅 — 3명의 YG 심사위원 AI를 동시에 호출하고 토론·최종 결과까지 조율합니다.
// 양태준(스타성·결정권) · 이나래(퍼포먼스) · Marcus Kim(글로벌 A&R)

import { useCallback, useEffect, useRef, useState } from 'react';

export type YgPhase = 'idle' | 'performing' | 'interview' | 'deliberation' | 'result';

export type YgJudgeId = 'yg-taejun' | 'yg-narae' | 'yg-marcus';

export type YgVerdict = 'pass' | 'hold' | 'training_recommended' | 'fail';

export type YgGlobalPotential = {
  us?: string;
  japan?: string;
  seAsia?: string;
  europe?: string;
};

export type YgJudgeReaction = {
  speaking?: string;
  scores?: Record<string, number>;
  verdict?: YgVerdict;
  vetoTriggered?: boolean;
  vetoReason?: string | null;
  strongPoints?: string[];
  improvements?: string[];
  closing?: string;
  debatePosition?: string;
  // 양태준 고유
  silenceAfter?: boolean;
  ygAuraDetected?: string | null;
  ygCharacterType?: string;
  fanAttraction?: string;
  riskFactor?: string;
  // 이나래 고유
  cameraReaction?: string;
  stagePresence?: string;
  ygPerformanceType?: string;
  ygPerformanceLine?: string;
  cameraAttraction?: '상' | '중' | '하' | string;
  performanceRisk?: string;
  // Marcus 고유
  globalReaction?: string;
  englishComment?: string;
  globalPotential?: YgGlobalPotential | string;
  viralPotential?: string;
  globalRisk?: string;
  source?: 'claude' | 'fallback';
};

export type YgJudgeState = {
  messages: { role: 'judge' | 'user'; text: string; timestamp: number }[];
  currentReaction: YgJudgeReaction | null;
  finalEval: YgJudgeReaction | null;
};

export type YgDebateScript = {
  round1: {
    speaker: string;
    line: string;
    silenceAfter?: boolean;
    ygKeyword?: string;
    cameraReaction?: string;
    stagePresence?: string;
    englishComment?: string;
    globalView?: string;
  }[];
  round2_conflict: { speaker: string; line: string }[];
  ygPhilosophyMoment?: string;
  finalVoteDeclaration: { speaker: string; vote: YgVerdict | string; line: string }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerDecision?: YgVerdict | string | null;
  tiebreakerLine?: string | null;
  tiebreakerReason?: string | null;
};

export type YgMarketEvaluation = {
  koreaMarket?: string;
  globalMarket?: string;
  fanAttraction?: string;
  viralPotential?: string;
};

export type YgDebateResult = {
  debateNeeded: boolean;
  unanimousVerdict?: boolean;
  ygCoreReason?: string;
  finalMarketEvaluation?: YgMarketEvaluation | null;
  debateScript: YgDebateScript | null;
  finalVerdict: YgVerdict;
};

export type YgVerdictInfo = {
  title: string;
  message: string;
  color: string;
  ygPhilosophy?: string;
  nextStep?: string;
};

export type YgRoutineWeek = {
  week: number;
  focus: string;
  daily: string[];
  goal: string;
  ygPhilosophyPoint?: string;
};

export type YgJudgeSummary = {
  judgeId?: string;
  name: string;
  score: number;
  verdict: YgVerdict | string;
  scores?: Record<string, number>;
  summary?: string;
  strongPoints: string[];
  improvements: string[];
  closing: string;
  // 양태준
  ygCharacterType?: string;
  fanAttraction?: string;
  riskFactor?: string;
  // 이나래
  cameraAttraction?: string;
  ygPerformanceLine?: string;
  performanceRisk?: string;
  // Marcus
  globalMarketFit?: YgGlobalPotential | string;
  viralPotential?: string;
  globalRisk?: string;
};

export type YgFinalResult = {
  finalVerdict: YgVerdict;
  avgScore: number;
  allCriteriaPass: boolean;
  starPotentialPassed?: boolean;
  characterPotentialPassed?: boolean;
  marketabilityPassed?: boolean;
  individualPass: { taejun: boolean; narae: boolean; marcus: boolean };
  judgeResults: any[];
  debateResult: YgDebateResult;
  verdictInfo: YgVerdictInfo;
  judgeSummaries: YgJudgeSummary[];
  debateHighlight?: string;
  ygPhilosophyHighlight?: string;
  finalMarketEvaluation?: YgMarketEvaluation | null;
  finalVotes?: Record<string, string>;
  decisionMethod?: 'unanimous' | 'majority' | 'taejun_final' | string;
  routine: YgRoutineWeek[];
  ygSpecialAdvice?: string;
  yangTaejunWouldSay?: string;
  nextAuditionTarget?: string;
};

const INITIAL_JUDGE_STATE: Record<YgJudgeId, YgJudgeState> = {
  'yg-taejun': { messages: [], currentReaction: null, finalEval: null },
  'yg-narae': { messages: [], currentReaction: null, finalEval: null },
  'yg-marcus': { messages: [], currentReaction: null, finalEval: null },
};

const ENDPOINTS: Record<YgJudgeId, string> = {
  'yg-taejun': '/api/audition/yg/judge-taejun',
  'yg-narae': '/api/audition/yg/judge-narae',
  'yg-marcus': '/api/audition/yg/judge-marcus',
};

async function callJudge(judgeId: YgJudgeId, payload: Record<string, any>): Promise<YgJudgeReaction> {
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

export type UseYgAuditionOptions = {
  language?: string;
};

export function useYgAudition({ language = 'ko' }: UseYgAuditionOptions = {}) {
  const [phase, setPhase] = useState<YgPhase>('idle');
  const [judgeStates, setJudgeStates] = useState<Record<YgJudgeId, YgJudgeState>>(INITIAL_JUDGE_STATE);
  const [debateResult, setDebateResult] = useState<YgDebateResult | null>(null);
  const [finalResult, setFinalResult] = useState<YgFinalResult | null>(null);
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

      const [taejun, narae, marcus] = await Promise.all([
        callJudge('yg-taejun', payload),
        callJudge('yg-narae', payload),
        callJudge('yg-marcus', payload),
      ]);

      setJudgeStates((prev) => ({
        'yg-taejun': { ...prev['yg-taejun'], currentReaction: taejun },
        'yg-narae': { ...prev['yg-narae'], currentReaction: narae },
        'yg-marcus': { ...prev['yg-marcus'], currentReaction: marcus },
      }));

      return { taejun, narae, marcus };
    },
    [language],
  );

  const askInterview = useCallback(
    async (judgeId: YgJudgeId, performanceData: Record<string, any>) => {
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
    async (judgeId: YgJudgeId, userAnswer: string, previousQuestion: string) => {
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
        const [taejun, narae, marcus] = await Promise.all([
          callJudge('yg-taejun', payload),
          callJudge('yg-narae', payload),
          callJudge('yg-marcus', payload),
        ]);

        setJudgeStates((prev) => ({
          'yg-taejun': { ...prev['yg-taejun'], finalEval: taejun },
          'yg-narae': { ...prev['yg-narae'], finalEval: narae },
          'yg-marcus': { ...prev['yg-marcus'], finalEval: marcus },
        }));

        const judgeResults = [
          { ...taejun, judgeId: 'yg-taejun', name: '양태준' },
          { ...narae, judgeId: 'yg-narae', name: '이나래' },
          { ...marcus, judgeId: 'yg-marcus', name: 'Marcus Kim' },
        ];

        const debateRes = await fetch('/api/audition/yg/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, language }),
        });
        const debateData: YgDebateResult = debateRes.ok
          ? await debateRes.json()
          : {
              debateNeeded: false,
              debateScript: null,
              finalVerdict: 'hold',
            };
        setDebateResult(debateData);

        const finalRes = await fetch('/api/audition/yg/final-verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, debateResult: debateData, auditionData, language }),
        });
        const finalData: YgFinalResult = finalRes.ok
          ? await finalRes.json()
          : {
              finalVerdict: debateData.finalVerdict,
              avgScore: 0,
              allCriteriaPass: false,
              individualPass: { taejun: false, narae: false, marcus: false },
              judgeResults,
              debateResult: debateData,
              verdictInfo: {
                title: '결과 처리 중 오류',
                message: '잠시 후 다시 시도해주세요.',
                color: '#2F3640',
                ygPhilosophy: '',
                nextStep: '재시도해주세요.',
              },
              judgeSummaries: [],
              debateHighlight: '',
              ygPhilosophyHighlight: '',
              finalVotes: {},
              decisionMethod: 'majority',
              routine: [],
              ygSpecialAdvice: '',
              yangTaejunWouldSay: '',
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
