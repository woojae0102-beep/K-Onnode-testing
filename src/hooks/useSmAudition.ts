// @ts-nocheck
// SM 오디션 전용 훅 — 3명의 SM 심사위원 AI를 동시에 호출하고 토론·최종 결과까지 조율합니다.

import { useCallback, useEffect, useRef, useState } from 'react';

export type SmPhase = 'idle' | 'performing' | 'interview' | 'deliberation' | 'result';

export type SmJudgeId = 'sm-seongho' | 'sm-yujin' | 'sm-seoyoung';

export type SmJudgeReaction = {
  speaking?: string;
  scores?: Record<string, number>;
  verdict?: 'pass' | 'conditional' | 'pending' | 'fail';
  vetoTriggered?: boolean;
  vetoReason?: string | null;
  objectionRaised?: boolean;
  objectionReason?: string | null;
  strongOpposition?: boolean;
  oppositionReason?: string | null;
  strongPoints?: string[];
  improvements?: string[];
  closing?: string;
  debatePosition?: string;
  silenceBeforeSpeaking?: number;
  firstImpressionNote?: string;
  vocalAnalysisInternal?: string;
  globalAnalysisInternal?: string;
  smLineComparison?: string;
  vocalReferenceSm?: string;
  smGlobalReference?: string;
  tenYearVision?: string;
  specificTrainingPlan?: string;
  source?: 'claude' | 'fallback';
};

export type SmJudgeState = {
  messages: { role: 'judge' | 'user'; text: string; timestamp: number }[];
  currentReaction: SmJudgeReaction | null;
  finalEval: SmJudgeReaction | null;
};

export type SmDebateScript = {
  round1: { speaker: string; line: string; silenceBefore?: number; immediateReaction?: boolean; tabletDown?: boolean }[];
  round2_conflict: { speaker: string; line: string }[];
  finalVoteDeclaration: { speaker: string; vote: string; line: string; silenceBefore?: number }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerDecision?: string | null;
  tiebreakerLine?: string | null;
};

export type SmDebateResult = {
  debateNeeded: boolean;
  vetoApplied: boolean;
  vetoBy?: string;
  vetoReason?: string;
  recommendOtherAgency?: boolean;
  yujinObjectionApplied?: boolean;
  seoyoungOppositionApplied?: boolean;
  unanimousVerdict?: boolean;
  debateScript: SmDebateScript | null;
  finalVerdict: 'pass' | 'conditional' | 'pending' | 'fail';
};

export type SmFinalResult = {
  finalVerdict: 'pass' | 'conditional' | 'pending' | 'fail';
  avgScore: number;
  allCriteriaPass: boolean;
  individualPass: { seongho: boolean; yujin: boolean; seoyoung: boolean };
  judgeResults: any[];
  debateResult: SmDebateResult;
  verdictInfo: { title: string; message: string; color: string; next: string };
  routine: {
    routine: { week: number; focus: string; daily: string[]; goal: string }[];
    priorityImprovement: string;
    nextAuditionTarget: string;
    smSpecificAdvice: string;
  };
  judgeSummaries: any[];
};

const INITIAL_JUDGE_STATE: Record<SmJudgeId, SmJudgeState> = {
  'sm-seongho': { messages: [], currentReaction: null, finalEval: null },
  'sm-yujin': { messages: [], currentReaction: null, finalEval: null },
  'sm-seoyoung': { messages: [], currentReaction: null, finalEval: null },
};

const ENDPOINTS: Record<SmJudgeId, string> = {
  'sm-seongho': '/api/audition/sm/judge-seongho',
  'sm-yujin': '/api/audition/sm/judge-yujin',
  'sm-seoyoung': '/api/audition/sm/judge-seoyoung',
};

async function callJudge(judgeId: SmJudgeId, payload: Record<string, any>): Promise<SmJudgeReaction> {
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

export type UseSmAuditionOptions = {
  language?: string;
};

export function useSmAudition({ language = 'ko' }: UseSmAuditionOptions = {}) {
  const [phase, setPhase] = useState<SmPhase>('idle');
  const [judgeStates, setJudgeStates] = useState<Record<SmJudgeId, SmJudgeState>>(INITIAL_JUDGE_STATE);
  const [debateResult, setDebateResult] = useState<SmDebateResult | null>(null);
  const [finalResult, setFinalResult] = useState<SmFinalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (phase === 'performing') {
      startedAtRef.current = Date.now();
    }
  }, [phase]);

  // 실기 중 3명 동시 실시간 반응 (병렬)
  const getRealtimeReactions = useCallback(
    async (analysisData: Record<string, any>) => {
      const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const payload = {
        phase: 'realtime_react',
        auditionData: { currentAnalysis: analysisData, elapsedSeconds },
        language,
      };

      const [seongho, yujin, seoyoung] = await Promise.all([
        callJudge('sm-seongho', payload),
        callJudge('sm-yujin', payload),
        callJudge('sm-seoyoung', payload),
      ]);

      setJudgeStates((prev) => ({
        'sm-seongho': { ...prev['sm-seongho'], currentReaction: seongho },
        'sm-yujin': { ...prev['sm-yujin'], currentReaction: yujin },
        'sm-seoyoung': { ...prev['sm-seoyoung'], currentReaction: seoyoung },
      }));

      return { seongho, yujin, seoyoung };
    },
    [language],
  );

  // 인터뷰 질문
  const askInterview = useCallback(
    async (judgeId: SmJudgeId, performanceData: Record<string, any>) => {
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
    async (judgeId: SmJudgeId, userAnswer: string, previousQuestion: string) => {
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

  // 최종 평가 + 토론 + 최종 결과 (전체 파이프라인)
  const getFinalEvaluations = useCallback(
    async (auditionData: Record<string, any>) => {
      setLoading(true);
      setError(null);
      setPhase('deliberation');

      try {
        const payload = { phase: 'final_evaluation', auditionData, language };
        const [seongho, yujin, seoyoung] = await Promise.all([
          callJudge('sm-seongho', payload),
          callJudge('sm-yujin', payload),
          callJudge('sm-seoyoung', payload),
        ]);

        setJudgeStates((prev) => ({
          'sm-seongho': { ...prev['sm-seongho'], finalEval: seongho },
          'sm-yujin': { ...prev['sm-yujin'], finalEval: yujin },
          'sm-seoyoung': { ...prev['sm-seoyoung'], finalEval: seoyoung },
        }));

        const judgeResults = [
          { ...seongho, judgeId: 'sm-seongho', name: '이성호' },
          { ...yujin, judgeId: 'sm-yujin', name: '최유진' },
          { ...seoyoung, judgeId: 'sm-seoyoung', name: '박서영' },
        ];

        const debateRes = await fetch('/api/audition/sm/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, language }),
        });
        const debateData: SmDebateResult = debateRes.ok
          ? await debateRes.json()
          : {
              debateNeeded: false,
              vetoApplied: false,
              debateScript: null,
              finalVerdict: 'conditional',
            };
        setDebateResult(debateData);

        const finalRes = await fetch('/api/audition/sm/final-verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, debateResult: debateData, auditionData, language }),
        });
        const finalData: SmFinalResult = finalRes.ok
          ? await finalRes.json()
          : {
              finalVerdict: debateData.finalVerdict,
              avgScore: 0,
              allCriteriaPass: false,
              individualPass: { seongho: false, yujin: false, seoyoung: false },
              judgeResults,
              debateResult: debateData,
              verdictInfo: {
                title: '결과 처리 중 오류',
                message: '잠시 후 다시 시도해주세요.',
                color: '#636E72',
                next: '재시도해주세요.',
              },
              routine: {
                routine: [],
                priorityImprovement: 'SM 발성 기초',
                nextAuditionTarget: '6개월 후',
                smSpecificAdvice: '',
              },
              judgeSummaries: [],
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
