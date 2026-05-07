// @ts-nocheck
// HYBE 오디션 전용 훅 — 3명의 심사위원 AI를 동시에 호출하고 토론·최종 결과까지 조율합니다.
// 각 단계는 명세대로 병렬 실행되어 응답 시간을 최소화합니다.

import { useCallback, useEffect, useRef, useState } from 'react';

export type HybePhase = 'idle' | 'performing' | 'interview' | 'deliberation' | 'result';

export type JudgeId = 'lee-junhyuk' | 'kim-soyeon' | 'david-lim';

export type JudgeReaction = {
  speaking?: string;
  scores?: Record<string, number>;
  verdict?: 'pass' | 'conditional' | 'pending' | 'fail';
  vetoTriggered?: boolean;
  vetoReason?: string | null;
  strongPoints?: string[];
  improvements?: string[];
  closing?: string;
  debatePosition?: string;
  internalNote?: string;
  instinct?: string;
  globalAssessment?: string;
  source?: 'claude' | 'fallback';
};

export type JudgeState = {
  messages: { role: 'judge' | 'user'; text: string; timestamp: number }[];
  currentReaction: JudgeReaction | null;
  finalEval: JudgeReaction | null;
};

export type DebateScript = {
  round1: { speaker: string; line: string }[];
  round2_conflict: { speaker: string; line: string }[];
  finalVoteDeclaration: { speaker: string; vote: string; line: string }[];
  tiebreakerUsed: boolean;
  tiebreakerBy: string | null;
  tiebreakerDecision?: string | null;
};

export type DebateResult = {
  debateNeeded: boolean;
  vetoApplied: boolean;
  vetoBy?: string;
  vetoReason?: string;
  unanimousVerdict?: boolean;
  debateScript: DebateScript | null;
  finalVerdict: 'pass' | 'conditional' | 'pending' | 'fail';
};

export type FinalResult = {
  finalVerdict: 'pass' | 'conditional' | 'pending' | 'fail';
  avgScore: number;
  allCriteriaPass: boolean;
  individualPass: { lee: boolean; kim: boolean; david: boolean };
  judgeResults: any[];
  debateResult: DebateResult;
  verdictInfo: { title: string; message: string; color: string; next: string };
  routine: {
    routine: { week: number; focus: string; daily: string[]; goal: string }[];
    priorityImprovement: string;
    nextAuditionTarget: string;
    hybeSpecificAdvice: string;
  };
  judgeSummaries: any[];
};

const INITIAL_JUDGE_STATE: Record<JudgeId, JudgeState> = {
  'lee-junhyuk': { messages: [], currentReaction: null, finalEval: null },
  'kim-soyeon': { messages: [], currentReaction: null, finalEval: null },
  'david-lim': { messages: [], currentReaction: null, finalEval: null },
};

const ENDPOINTS: Record<JudgeId, string> = {
  'lee-junhyuk': '/api/audition/hybe/judge-lee',
  'kim-soyeon': '/api/audition/hybe/judge-kim',
  'david-lim': '/api/audition/hybe/judge-david',
};

async function callJudge(judgeId: JudgeId, payload: Record<string, any>): Promise<JudgeReaction> {
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

export type UseHybeAuditionOptions = {
  language?: string;
};

export function useHybeAudition({ language = 'ko' }: UseHybeAuditionOptions = {}) {
  const [phase, setPhase] = useState<HybePhase>('idle');
  const [judgeStates, setJudgeStates] = useState<Record<JudgeId, JudgeState>>(INITIAL_JUDGE_STATE);
  const [debateResult, setDebateResult] = useState<DebateResult | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
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

      const [lee, kim, david] = await Promise.all([
        callJudge('lee-junhyuk', payload),
        callJudge('kim-soyeon', payload),
        callJudge('david-lim', payload),
      ]);

      setJudgeStates((prev) => ({
        'lee-junhyuk': { ...prev['lee-junhyuk'], currentReaction: lee },
        'kim-soyeon': { ...prev['kim-soyeon'], currentReaction: kim },
        'david-lim': { ...prev['david-lim'], currentReaction: david },
      }));

      return { lee, kim, david };
    },
    [language],
  );

  // 인터뷰 질문 (특정 심사위원만)
  const askInterview = useCallback(
    async (judgeId: JudgeId, performanceData: Record<string, any>) => {
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

  // 답변 받은 후 반응
  const reactToAnswer = useCallback(
    async (judgeId: JudgeId, userAnswer: string, previousQuestion: string) => {
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
        const [lee, kim, david] = await Promise.all([
          callJudge('lee-junhyuk', payload),
          callJudge('kim-soyeon', payload),
          callJudge('david-lim', payload),
        ]);

        setJudgeStates((prev) => ({
          'lee-junhyuk': { ...prev['lee-junhyuk'], finalEval: lee },
          'kim-soyeon': { ...prev['kim-soyeon'], finalEval: kim },
          'david-lim': { ...prev['david-lim'], finalEval: david },
        }));

        const judgeResults = [
          { ...lee, judgeId: 'lee-junhyuk', name: '이준혁' },
          { ...kim, judgeId: 'kim-soyeon', name: '김소연' },
          { ...david, judgeId: 'david-lim', name: 'David Lim' },
        ];

        // 토론 단계
        const debateRes = await fetch('/api/audition/hybe/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, language }),
        });
        const debateData: DebateResult = debateRes.ok
          ? await debateRes.json()
          : {
              debateNeeded: false,
              vetoApplied: false,
              debateScript: null,
              finalVerdict: 'conditional',
            };
        setDebateResult(debateData);

        // 최종 결과 + 루틴
        const finalRes = await fetch('/api/audition/hybe/final-verdict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ judgeResults, debateResult: debateData, auditionData, language }),
        });
        const finalData: FinalResult = finalRes.ok
          ? await finalRes.json()
          : {
              finalVerdict: debateData.finalVerdict,
              avgScore: 0,
              allCriteriaPass: false,
              individualPass: { lee: false, kim: false, david: false },
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
                priorityImprovement: '음악적 기본기',
                nextAuditionTarget: '6개월 후',
                hybeSpecificAdvice: '',
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
