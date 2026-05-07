// @ts-nocheck
// JYP 오디션 전용 훅 — 3명의 JYP 심사위원 AI를 동시에 호출하고 토론·최종 결과까지 조율합니다.
// 박재원(보컬) · 정민지(댄스) · 이성현(인성·결정권)

import { useCallback, useEffect, useRef, useState } from 'react';

export type JypPhase = 'idle' | 'performing' | 'interview' | 'deliberation' | 'result';

export type JypJudgeId = 'jyp-jaewon' | 'jyp-minji' | 'jyp-seonghyeon';

export type JypJudgeReaction = {
  speaking?: string;
  scores?: Record<string, number>;
  verdict?: 'pass' | 'conditional' | 'pending' | 'fail';
  vetoTriggered?: boolean;
  vetoReason?: string | null;
  strongPoints?: string[];
  improvements?: string[];
  closing?: string;
  debatePosition?: string;
  // 박재원 고유 필드
  stopSignal?: boolean;
  stopReason?: string | null;
  habitDetected?: string | null;
  habitCorrectionTime?: string;
  liveRating?: string;
  // 정민지 고유 필드
  bodyReaction?: string | null;
  demonstrationNeeded?: boolean;
  jypGroupLine?: string;
  choreographyAbsorptionSpeed?: string;
  livePerformanceRating?: string;
  // 이성현 고유 필드
  listeningNote?: string;
  sincerityAssessment?: string;
  nod?: boolean;
  characterRating?: string;
  longTermPotential?: string;
  source?: 'claude' | 'fallback';
};

export type JypJudgeState = {
  messages: { role: 'judge' | 'user'; text: string; timestamp: number }[];
  currentReaction: JypJudgeReaction | null;
  finalEval: JypJudgeReaction | null;
};

export type JypDebateScript = {
  round1: {
    speaker: string;
    line: string;
    stopSignal?: boolean;
    habitDetected?: string | null;
    bodyReaction?: string | null;
    nod?: boolean;
  }[];
  round2_conflict: { speaker: string; line: string }[];
  jypPhilosophyMoment?: string;
  finalVoteDeclaration: { speaker: string; vote: string; line: string }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerDecision?: string | null;
  tiebreakerLine?: string | null;
  tiebreakerPhilosophy?: string | null;
};

export type JypDebateResult = {
  debateNeeded: boolean;
  vetoApplied: boolean;
  vetoBy?: string;
  vetoReason?: string;
  recommendCharacterRetraining?: boolean;
  jaewonObjectionApplied?: boolean;
  minjiOppositionApplied?: boolean;
  unanimousVerdict?: boolean;
  debateScript: JypDebateScript | null;
  finalVerdict: 'pass' | 'conditional' | 'pending' | 'fail';
};

export type JypVerdictInfo = {
  title: string;
  message: string;
  color: string;
  jypPhilosophy?: string;
  nextStep?: string;
  // 호환용 (이전 final-verdict 응답)
  next?: string;
};

export type JypRoutineWeek = {
  week: number;
  focus: string;
  daily: string[];
  goal: string;
  jypPhilosophyPoint?: string;
};

export type JypJudgeSummary = {
  judgeId?: string;
  name: string;
  score: number;
  verdict: 'pass' | 'conditional' | 'pending' | 'fail' | string;
  scores?: Record<string, number>;
  summary?: string;
  strongPoints: string[];
  improvements: string[];
  closing: string;
  vetoTriggered?: boolean;
  vetoReason?: string | null;
  // 박재원 고유
  habitDetected?: string | null;
  habitCorrectionTime?: string;
  liveRating?: string;
  // 정민지 고유
  jypGroupLine?: string;
  choreographyAbsorptionSpeed?: string;
  // 이성현 고유
  characterRating?: string;
  longTermPotential?: string;
};

export type JypFinalResult = {
  finalVerdict: 'pass' | 'conditional' | 'pending' | 'fail';
  avgScore: number;
  allCriteriaPass: boolean;
  characterScorePassed?: boolean;
  individualPass: { jaewon: boolean; minji: boolean; seonghyeon: boolean };
  judgeResults: any[];
  debateResult: JypDebateResult;
  verdictInfo: JypVerdictInfo;
  judgeSummaries: JypJudgeSummary[];
  // 신규 풀 결과 필드
  debateHighlight?: string;
  jypPhilosophyHighlight?: string;
  finalVotes?: Record<string, string>;
  decisionMethod?: 'unanimous' | 'majority' | 'tiebreaker' | string;
  routine: JypRoutineWeek[];
  jypSpecialAdvice?: string;
  parkJinyoungWouldSay?: string;
  nextAuditionTarget?: string;
};

const INITIAL_JUDGE_STATE: Record<JypJudgeId, JypJudgeState> = {
  'jyp-jaewon': { messages: [], currentReaction: null, finalEval: null },
  'jyp-minji': { messages: [], currentReaction: null, finalEval: null },
  'jyp-seonghyeon': { messages: [], currentReaction: null, finalEval: null },
};

const ENDPOINTS: Record<JypJudgeId, string> = {
  'jyp-jaewon': '/api/audition/jyp/judge-jaewon',
  'jyp-minji': '/api/audition/jyp/judge-minji',
  'jyp-seonghyeon': '/api/audition/jyp/judge-seonghyeon',
};

async function callJudge(judgeId: JypJudgeId, payload: Record<string, any>): Promise<JypJudgeReaction> {
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

export type UseJypAuditionOptions = {
  language?: string;
};

export function useJypAudition({ language = 'ko' }: UseJypAuditionOptions = {}) {
  const [phase, setPhase] = useState<JypPhase>('idle');
  const [judgeStates, setJudgeStates] = useState<Record<JypJudgeId, JypJudgeState>>(INITIAL_JUDGE_STATE);
  const [debateResult, setDebateResult] = useState<JypDebateResult | null>(null);
  const [finalResult, setFinalResult] = useState<JypFinalResult | null>(null);
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

      const [jaewon, minji, seonghyeon] = await Promise.all([
        callJudge('jyp-jaewon', payload),
        callJudge('jyp-minji', payload),
        callJudge('jyp-seonghyeon', payload),
      ]);

      setJudgeStates((prev) => ({
        'jyp-jaewon': { ...prev['jyp-jaewon'], currentReaction: jaewon },
        'jyp-minji': { ...prev['jyp-minji'], currentReaction: minji },
        'jyp-seonghyeon': { ...prev['jyp-seonghyeon'], currentReaction: seonghyeon },
      }));

      return { jaewon, minji, seonghyeon };
    },
    [language],
  );

  const askInterview = useCallback(
    async (judgeId: JypJudgeId, performanceData: Record<string, any>) => {
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
    async (judgeId: JypJudgeId, userAnswer: string, previousQuestion: string) => {
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
        const [jaewon, minji, seonghyeon] = await Promise.all([
          callJudge('jyp-jaewon', payload),
          callJudge('jyp-minji', payload),
          callJudge('jyp-seonghyeon', payload),
        ]);

        setJudgeStates((prev) => ({
          'jyp-jaewon': { ...prev['jyp-jaewon'], finalEval: jaewon },
          'jyp-minji': { ...prev['jyp-minji'], finalEval: minji },
          'jyp-seonghyeon': { ...prev['jyp-seonghyeon'], finalEval: seonghyeon },
        }));

        const judgeResults = [
          { ...jaewon, judgeId: 'jyp-jaewon', name: '박재원' },
          { ...minji, judgeId: 'jyp-minji', name: '정민지' },
          { ...seonghyeon, judgeId: 'jyp-seonghyeon', name: '이성현' },
        ];

        const debateRes = await fetch('/api/audition/jyp/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, language }),
        });
        const debateData: JypDebateResult = debateRes.ok
          ? await debateRes.json()
          : {
              debateNeeded: false,
              vetoApplied: false,
              debateScript: null,
              finalVerdict: 'conditional',
            };
        setDebateResult(debateData);

        const finalRes = await fetch('/api/audition/jyp/final-verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, debateResult: debateData, auditionData, language }),
        });
        const finalData: JypFinalResult = finalRes.ok
          ? await finalRes.json()
          : {
              finalVerdict: debateData.finalVerdict,
              avgScore: 0,
              allCriteriaPass: false,
              characterScorePassed: false,
              individualPass: { jaewon: false, minji: false, seonghyeon: false },
              judgeResults,
              debateResult: debateData,
              verdictInfo: {
                title: '결과 처리 중 오류',
                message: '잠시 후 다시 시도해주세요.',
                color: '#636E72',
                jypPhilosophy: '',
                nextStep: '재시도해주세요.',
              },
              judgeSummaries: [],
              debateHighlight: '',
              jypPhilosophyHighlight: '',
              finalVotes: {},
              decisionMethod: 'majority',
              routine: [],
              jypSpecialAdvice: '',
              parkJinyoungWouldSay: '',
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
