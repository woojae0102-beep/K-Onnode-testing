// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJudgeVoice } from './useJudgeVoice';

export type AuditionPhase =
  | 'idle'
  | 'greeting'
  | 'instruction_vocal'
  | 'instruction_dance'
  | 'react_performance'
  | 'additional_instruction'
  | 'interview'
  | 'react_answer'
  | 'deliberation'
  | 'done';

export type JudgeMessage = {
  id: number;
  judgeId: string;
  type: 'instruction' | 'reaction' | 'question' | 'comment' | 'result';
  text: string;
  timestamp: number;
  requiresResponse: boolean;
  responseType: 'voice' | 'action' | 'none';
  actionType?: 'sing' | 'dance' | 'rap' | 'introduce' | null;
  duration?: number;
  source?: 'claude' | 'fallback';
  phase?: AuditionPhase;
};

type SpeakContext = {
  phase: AuditionPhase;
  previousResponse?: string;
  analysisData?: Record<string, any>;
  triggerType?: 'auto' | 'response' | 'analysis';
};

type Judge = {
  id: string;
  name?: string;
  [key: string]: any;
};

type UseRealTimeJudgeOptions = {
  agencyId: string;
  judges: Judge[];
  language?: string; // 'ko' | 'en' | 'ja' ...
  voiceEnabled?: boolean;
};

let MESSAGE_ID = 0;

export function useRealTimeJudge({ agencyId, judges, language = 'ko', voiceEnabled = true }: UseRealTimeJudgeOptions) {
  const [messages, setMessages] = useState<JudgeMessage[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [awaitingResponse, setAwaitingResponse] = useState<boolean>(false);
  const [phase, setPhase] = useState<AuditionPhase>('idle');
  const [pendingMessage, setPendingMessage] = useState<JudgeMessage | null>(null);
  const messagesRef = useRef<JudgeMessage[]>([]);
  const speakingLockRef = useRef<boolean>(false);

  const voice = useJudgeVoice();
  // Sync voice toggle from props in an effect so we don't setState during render.
  useEffect(() => {
    if (voice.enabled !== voiceEnabled) {
      voice.setVoiceEnabled(voiceEnabled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled]);

  const setMessagesAndRef = useCallback((updater: any) => {
    setMessages((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      messagesRef.current = next;
      return next;
    });
  }, []);

  const selectNextSpeaker = useCallback(
    (excludeJudgeId?: string): Judge | null => {
      if (!judges || judges.length === 0) return null;
      const last = messagesRef.current[messagesRef.current.length - 1];
      const lastIdx = last ? judges.findIndex((j) => j.id === last.judgeId) : -1;
      for (let i = 1; i <= judges.length; i += 1) {
        const candidate = judges[(lastIdx + i + judges.length) % judges.length];
        if (!excludeJudgeId || candidate.id !== excludeJudgeId) return candidate;
      }
      return judges[0];
    },
    [judges],
  );

  const judgeSpeak = useCallback(
    async (judgeId: string, context: SpeakContext): Promise<JudgeMessage | null> => {
      if (!judgeId) return null;
      // Avoid overlapping speeches; if one is in flight, queue serially.
      while (speakingLockRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 80));
      }
      speakingLockRef.current = true;
      setCurrentSpeaker(judgeId);

      let payloadResult: any = null;
      try {
        const res = await fetch('/api/audition/judge-speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agencyId,
            judgeId,
            phase: context.phase,
            previousResponse: context.previousResponse,
            analysisData: context.analysisData,
            conversationHistory: messagesRef.current.slice(-6).map((m) => ({
              judgeId: m.judgeId,
              text: m.text,
              type: m.type,
            })),
            language,
          }),
        });
        if (res.ok) {
          payloadResult = await res.json();
        }
      } catch {
        payloadResult = null;
      }

      const data = payloadResult || {
        text: phase === 'idle' ? '안녕하세요.' : '...',
        type: 'comment',
        requiresResponse: false,
        responseType: 'none',
        source: 'fallback',
      };

      MESSAGE_ID += 1;
      const newMessage: JudgeMessage = {
        id: MESSAGE_ID,
        judgeId,
        type: data.type || 'comment',
        text: String(data.text || ''),
        timestamp: Date.now(),
        requiresResponse: !!data.requiresResponse,
        responseType: data.responseType || 'none',
        actionType: data.actionType || null,
        duration: data.duration,
        source: data.source,
        phase: context.phase,
      };

      setMessagesAndRef((prev: JudgeMessage[]) => [...prev, newMessage]);
      setPendingMessage(newMessage);

      try {
        await voice.speakText(newMessage.text, judgeId);
      } catch {
        /* TTS errors are non-fatal */
      }

      setCurrentSpeaker(null);
      if (newMessage.requiresResponse) {
        setAwaitingResponse(true);
      }
      speakingLockRef.current = false;
      return newMessage;
    },
    [agencyId, language, phase, setMessagesAndRef, voice],
  );

  const startAudition = useCallback(async () => {
    if (!judges || judges.length === 0) return null;
    setPhase('greeting');
    return judgeSpeak(judges[0].id, { phase: 'greeting', triggerType: 'auto' });
  }, [judges, judgeSpeak]);

  const handleResponse = useCallback(
    async (responseText: string) => {
      setAwaitingResponse(false);
      const trimmed = (responseText || '').trim();
      const next = selectNextSpeaker();
      if (!next) return null;

      // After greeting, the second judge generally moves to a vocal instruction
      // unless the consumer overrides phase explicitly.
      const nextPhase: AuditionPhase = phase === 'greeting'
        ? 'instruction_vocal'
        : phase === 'interview' || phase === 'react_answer'
          ? 'react_answer'
          : phase;

      setPhase(nextPhase);
      return judgeSpeak(next.id, {
        phase: nextPhase,
        previousResponse: trimmed,
        triggerType: 'response',
      });
    },
    [judgeSpeak, phase, selectNextSpeaker],
  );

  const reactToPerformance = useCallback(
    async (analysisData: Record<string, any>) => {
      if (speakingLockRef.current) return null;
      const next = selectNextSpeaker();
      if (!next) return null;
      return judgeSpeak(next.id, {
        phase: 'react_performance',
        analysisData,
        triggerType: 'analysis',
      });
    },
    [judgeSpeak, selectNextSpeaker],
  );

  const askInterview = useCallback(
    async (judgeId?: string) => {
      const target = judgeId
        ? judges.find((j) => j.id === judgeId) || judges[0]
        : selectNextSpeaker();
      if (!target) return null;
      setPhase('interview');
      return judgeSpeak(target.id, { phase: 'interview', triggerType: 'auto' });
    },
    [judgeSpeak, judges, selectNextSpeaker],
  );

  const giveAdditionalInstruction = useCallback(
    async (judgeId?: string) => {
      const target = judgeId ? judges.find((j) => j.id === judgeId) : selectNextSpeaker();
      if (!target) return null;
      setPhase('additional_instruction');
      return judgeSpeak(target.id, { phase: 'additional_instruction', triggerType: 'auto' });
    },
    [judgeSpeak, judges, selectNextSpeaker],
  );

  const closeAudition = useCallback(async () => {
    setPhase('deliberation');
    // Each judge gives a one-line closing remark in turn.
    for (const judge of judges) {
      // eslint-disable-next-line no-await-in-loop
      await judgeSpeak(judge.id, { phase: 'deliberation', triggerType: 'auto' });
    }
    setPhase('done');
  }, [judgeSpeak, judges]);

  const submitInterviewAnswer = useCallback(
    async (judgeId: string, question: string, answer: string) => {
      try {
        const res = await fetch('/api/audition/judge-interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agencyId, judgeId, question, answer, language }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.reaction) {
          MESSAGE_ID += 1;
          const reactionMessage: JudgeMessage = {
            id: MESSAGE_ID,
            judgeId,
            type: data.followUpQuestion ? 'question' : 'reaction',
            text: data.followUpQuestion ? `${data.reaction} ${data.followUpQuestion}` : data.reaction,
            timestamp: Date.now(),
            requiresResponse: !!data.followUpQuestion,
            responseType: data.followUpQuestion ? 'voice' : 'none',
            source: data.source,
            phase: 'react_answer',
          };
          setMessagesAndRef((prev: JudgeMessage[]) => [...prev, reactionMessage]);
          setAwaitingResponse(!!data.followUpQuestion);
          try {
            await voice.speakText(reactionMessage.text, judgeId);
          } catch {
            /* noop */
          }
        }
        return data;
      } catch {
        return null;
      }
    },
    [agencyId, language, setMessagesAndRef, voice],
  );

  const reset = useCallback(() => {
    setMessagesAndRef([]);
    setPendingMessage(null);
    setAwaitingResponse(false);
    setCurrentSpeaker(null);
    setPhase('idle');
  }, [setMessagesAndRef]);

  return useMemo(
    () => ({
      messages,
      currentSpeaker,
      awaitingResponse,
      phase,
      pendingMessage,
      setPhase,
      setAwaitingResponse,
      judgeSpeak,
      startAudition,
      handleResponse,
      reactToPerformance,
      askInterview,
      giveAdditionalInstruction,
      closeAudition,
      submitInterviewAnswer,
      reset,
      voice,
    }),
    [
      messages,
      currentSpeaker,
      awaitingResponse,
      phase,
      pendingMessage,
      judgeSpeak,
      startAudition,
      handleResponse,
      reactToPerformance,
      askInterview,
      giveAdditionalInstruction,
      closeAudition,
      submitInterviewAnswer,
      reset,
      voice,
    ],
  );
}

export default useRealTimeJudge;
