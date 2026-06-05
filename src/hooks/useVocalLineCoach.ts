// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVocalVoiceClone } from './useVocalVoiceClone';
import { speakLineWithCoaching } from '../utils/voiceCoverTts';
import {
  VOCAL_LINE_MAX_ATTEMPTS,
  VOCAL_LINE_PASS_SCORE,
  VOCAL_LINE_RETRY_MS,
  averageSamples,
  buildLineCoachingIntro,
  buildRefinedLineTip,
  buildRetryLiveTip,
  findAllWeakLines,
  findWeakestLine,
} from '../utils/vocalLineCoach';

export function useVocalLineCoach() {
  const { cloneProfile, cloneVoice, generateCover, isCloning, isGeneratingCover } = useVocalVoiceClone();

  const [phase, setPhase] = useState('idle');
  const [weakLineIdx, setWeakLineIdx] = useState(-1);
  const [weakQueue, setWeakQueue] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [retryScore, setRetryScore] = useState(null);
  const [liveTip, setLiveTip] = useState('');
  const [lineCover, setLineCover] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const stopTtsRef = useRef(null);
  const retryTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const retrySamplesRef = useRef([]);
  const pitchStateRef = useRef({ tuningState: 'idle', pitchAccuracy: 0, pitchFeedback: '' });
  const contextRef = useRef({});

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    stopTtsRef.current?.();
    stopTtsRef.current = null;
    clearTimers();
    setRetryCountdown(0);
  }, [clearTimers]);

  useEffect(() => () => stopAll(), [stopAll]);

  const runAiLine = useCallback(
    async ({ lineText, tip, intro, voiceProfile, language, playbackSpeed }) => {
      stopTtsRef.current?.();
      setPhase('ai_singing');
      return new Promise((resolve) => {
        stopTtsRef.current = speakLineWithCoaching({
          lineText,
          tip,
          intro,
          voiceProfile: voiceProfile || cloneProfile,
          language,
          playbackSpeed,
          onComplete: () => {
            setPhase('user_retry');
            resolve(true);
          },
        });
      });
    },
    [cloneProfile],
  );

  const prepareLineCover = useCallback(
    async ({ songAnalysis, vocalCharacteristics, pitchHistory, lyrics, lineIdx, attempt: att, lastRetryScore }) => {
      const lineText = lyrics[lineIdx] || '';
      const profile =
        cloneProfile ||
        (await cloneVoice({ vocalCharacteristics, songAnalysis, pitchHistory }));
      if (!profile) return null;

      const cover = await generateCover({
        songAnalysis,
        cloneProfile: profile,
        lyrics: [lineText],
      });
      const coverLine = cover?.coverLines?.[0] || { text: lineText, tip: '감정을 먼저 떠올리고 불러보세요.' };
      const intro = buildLineCoachingIntro({
        lineText,
        attempt: att,
        retryScore: lastRetryScore,
      });
      const refinedTip =
        att > 0
          ? buildRefinedLineTip({
              retryScore: lastRetryScore,
              tuningState: pitchStateRef.current.tuningState,
              lineText,
              attempt: att,
            })
          : coverLine.tip;

      const payload = {
        text: coverLine.text || lineText,
        tip: refinedTip || coverLine.tip,
        intro,
        profile,
      };
      setLineCover(payload);
      return payload;
    },
    [cloneProfile, cloneVoice, generateCover],
  );

  const startWeakLineCoaching = useCallback(
    async ({
      lineScores,
      lyrics,
      songAnalysis,
      vocalCharacteristics,
      pitchHistory = [],
      language = 'ko',
      playbackSpeed = 1,
      lineIdx: forcedIdx,
    }) => {
      if (!songAnalysis || !lyrics?.length) return false;
      stopAll();
      setRetryScore(null);
      setAttempt(0);
      retrySamplesRef.current = [];

      const weak =
        typeof forcedIdx === 'number'
          ? { idx: forcedIdx, score: lineScores[forcedIdx] }
          : findWeakestLine(lineScores);
      if (!weak) return false;

      const queue = findAllWeakLines(lineScores).map((x) => x.idx);
      setWeakQueue(queue.length ? queue : [weak.idx]);
      setWeakLineIdx(weak.idx);
      contextRef.current = {
        lineScores,
        lyrics,
        songAnalysis,
        vocalCharacteristics,
        pitchHistory,
        language,
        playbackSpeed,
      };
      setPhase('preparing');
      setLiveTip('내 목소리를 학습하고 부족한 구간 모범창을 준비 중이에요…');

      const payload = await prepareLineCover({
        songAnalysis,
        vocalCharacteristics,
        pitchHistory,
        lyrics,
        lineIdx: weak.idx,
        attempt: 0,
        lastRetryScore: weak.score,
      });
      if (!payload) {
        setPhase('idle');
        return false;
      }

      await runAiLine({
        lineText: payload.text,
        tip: payload.tip,
        intro: payload.intro,
        voiceProfile: payload.profile,
        language,
        playbackSpeed,
      });
      setLiveTip('모범창을 들었으면 같은 호흡으로 바로 따라 불러보세요.');
      return true;
    },
    [prepareLineCover, runAiLine, stopAll],
  );

  const finishUserRetry = useCallback(async () => {
    clearTimers();
    setRetryCountdown(0);
    const avg = averageSamples(retrySamplesRef.current);
    setRetryScore(avg);
    const nextAttempt = attempt + 1;
    setAttempt(nextAttempt);

    if (avg >= VOCAL_LINE_PASS_SCORE) {
      setPhase('passed');
      setLiveTip(`잘했어요! 이 구간 ${avg}점으로 많이 좋아졌어요.`);
      return;
    }

    if (nextAttempt >= VOCAL_LINE_MAX_ATTEMPTS) {
      setPhase('needs_practice');
      setLiveTip(
        `이 구간은 ${avg}점이에요. 천천히 AI 모범창을 따라 여러 번 연습해 보세요.`,
      );
      return;
    }

    const ctx = contextRef.current || {};
    setPhase('preparing');
    setLiveTip('아직 부족해요. AI가 다시 모범창과 피드백을 들려줄게요.');
    const payload = await prepareLineCover({
      songAnalysis: ctx.songAnalysis,
      vocalCharacteristics: ctx.vocalCharacteristics,
      pitchHistory: ctx.pitchHistory || [],
      lyrics: ctx.lyrics || [],
      lineIdx: weakLineIdx,
      attempt: nextAttempt,
      lastRetryScore: avg,
    });
    if (payload) {
      await runAiLine({
        lineText: payload.text,
        tip: payload.tip,
        intro: payload.intro,
        voiceProfile: payload.profile,
        language: ctx.language || 'ko',
        playbackSpeed: ctx.playbackSpeed || 1,
      });
      setLiveTip('모범창을 들었으면 같은 호흡으로 바로 따라 불러보세요.');
    } else {
      setPhase('needs_practice');
    }
  }, [attempt, clearTimers, prepareLineCover, runAiLine, weakLineIdx]);

  const beginUserRetry = useCallback(() => {
    if (phase !== 'user_retry' && phase !== 'needs_practice') return;
    stopTtsRef.current?.();
    clearTimers();
    retrySamplesRef.current = [];
    setPhase('user_retry');
    setLiveTip('지금 이 문장을 불러주세요. 실시간으로 음정을 분석할게요.');
    const endAt = Date.now() + VOCAL_LINE_RETRY_MS;
    setRetryCountdown(Math.ceil(VOCAL_LINE_RETRY_MS / 1000));

    countdownRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRetryCountdown(left);
    }, 250);

    retryTimerRef.current = window.setTimeout(() => {
      finishUserRetry();
    }, VOCAL_LINE_RETRY_MS);
  }, [clearTimers, finishUserRetry, phase]);

  const sampleLivePitch = useCallback(
    ({ pitchAccuracy, tuningState, pitchFeedback }) => {
      pitchStateRef.current = { pitchAccuracy, tuningState, pitchFeedback };
      if (phase !== 'user_retry') return;
      if (Number.isFinite(pitchAccuracy) && pitchAccuracy > 0) {
        retrySamplesRef.current.push(pitchAccuracy);
      }
      if (pitchAccuracy < VOCAL_LINE_PASS_SCORE || tuningState !== 'in-tune') {
        setLiveTip(
          buildRetryLiveTip({ tuningState, pitchAccuracy, pitchFeedback, attempt }),
        );
      }
    },
    [attempt, phase],
  );

  const replayAiLine = useCallback(
    async ({ language = 'ko', playbackSpeed = 1, lyrics = [] }) => {
      if (!lineCover || weakLineIdx < 0) return;
      const intro = buildLineCoachingIntro({
        lineText: lyrics[weakLineIdx],
        attempt,
        retryScore,
      });
      const tip = buildRefinedLineTip({
        retryScore: retryScore ?? 0,
        tuningState: pitchStateRef.current.tuningState,
        lineText: lyrics[weakLineIdx],
        attempt,
      });
      await runAiLine({
        lineText: lineCover.text,
        tip,
        intro,
        voiceProfile: lineCover.profile || cloneProfile,
        language,
        playbackSpeed,
      });
    },
    [attempt, cloneProfile, lineCover, retryScore, runAiLine, weakLineIdx],
  );

  const goNextWeakLine = useCallback(
    async ({
      lineScores,
      lyrics,
      songAnalysis,
      vocalCharacteristics,
      pitchHistory,
      language,
      playbackSpeed,
    }) => {
      const remaining = weakQueue.filter((i) => i !== weakLineIdx);
      if (!remaining.length) {
        setPhase('idle');
        setLiveTip('모든 부족한 구간 연습을 마쳤어요!');
        return false;
      }
      const nextIdx = remaining[0];
      setWeakQueue(remaining);
      setAttempt(0);
      setRetryScore(null);
      return startWeakLineCoaching({
        lineScores,
        lyrics,
        songAnalysis,
        vocalCharacteristics,
        pitchHistory,
        language,
        playbackSpeed,
        lineIdx: nextIdx,
      });
    },
    [startWeakLineCoaching, weakLineIdx, weakQueue],
  );

  const resetCoach = useCallback(() => {
    stopAll();
    setPhase('idle');
    setWeakLineIdx(-1);
    setWeakQueue([]);
    setAttempt(0);
    setRetryScore(null);
    setLiveTip('');
    setLineCover(null);
    retrySamplesRef.current = [];
  }, [stopAll]);

  return {
    phase,
    weakLineIdx,
    attempt,
    retryScore,
    liveTip,
    lineCover,
    retryCountdown,
    cloneProfile,
    isPreparing: phase === 'preparing' || isCloning || isGeneratingCover,
    isAiSinging: phase === 'ai_singing',
    isUserRetry: phase === 'user_retry',
    isPassed: phase === 'passed',
    needsMorePractice: phase === 'needs_practice',
    startWeakLineCoaching,
    beginUserRetry,
    sampleLivePitch,
    finishUserRetry,
    replayAiLine,
    goNextWeakLine,
    resetCoach,
    stopAll,
  };
}

export default useVocalLineCoach;
