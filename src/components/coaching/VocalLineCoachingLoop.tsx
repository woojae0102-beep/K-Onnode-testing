// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useVocalLineCoach } from '../../hooks/useVocalLineCoach';
import { findWeakestLine } from '../../utils/vocalLineCoach';

export default function VocalLineCoachingLoop({
  songAnalysis,
  vocalCharacteristics,
  lyrics = [],
  lineScores = [],
  pitchHistory = [],
  pitchAccuracy = 0,
  tuningState = 'idle',
  pitchFeedback = '',
  language = 'ko',
  playbackSpeed = 1,
  micActive = false,
  variant = 'light',
  autoStart = false,
}) {
  const { t } = useTranslation();
  const coach = useVocalLineCoach();
  const autoRetryStartedRef = useRef(false);
  const isDark = variant === 'dark';
  const weak = findWeakestLine(lineScores);
  const hasWeakLine = Boolean(weak);

  useEffect(() => {
    if (!autoStart || !hasWeakLine || !songAnalysis || coach.phase !== 'idle') return;
    coach.startWeakLineCoaching({
      lineScores,
      lyrics,
      songAnalysis,
      vocalCharacteristics,
      pitchHistory,
      language,
      playbackSpeed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, hasWeakLine, songAnalysis?.trackId]);

  useEffect(() => {
    if (!micActive || !coach.isUserRetry) return;
    coach.sampleLivePitch({ pitchAccuracy, tuningState, pitchFeedback });
  }, [coach, micActive, pitchAccuracy, tuningState, pitchFeedback, coach.isUserRetry]);

  useEffect(() => {
    if (coach.phase === 'user_retry' && micActive && !autoRetryStartedRef.current) {
      autoRetryStartedRef.current = true;
      coach.beginUserRetry();
    }
    if (coach.phase !== 'user_retry') {
      autoRetryStartedRef.current = false;
    }
  }, [coach.phase, micActive, coach]);

  const shell = isDark
    ? 'rounded-xl border border-white/10 bg-black/40 p-3 space-y-3'
    : 'rounded-2xl border border-[#4A6BFF]/25 bg-white p-4 space-y-3';
  const titleColor = isDark ? 'text-white' : 'text-[#111111]';
  const subColor = isDark ? 'text-white/55' : 'text-[#666666]';
  const tipBox = isDark
    ? 'rounded-lg bg-white/8 border border-white/10 p-3 text-sm text-white/90'
    : 'rounded-lg bg-[#F0F4FF] border border-[#4A6BFF]/20 p-3 text-sm text-[#333333]';

  if (!songAnalysis) return null;

  const phaseLabel = {
    idle: t('coaching.vocal.lineLoop.idle', { defaultValue: '대기' }),
    preparing: t('coaching.vocal.lineLoop.preparing', { defaultValue: '목소리 학습 중…' }),
    ai_singing: t('coaching.vocal.lineLoop.aiSinging', { defaultValue: 'AI 모범창 재생 중' }),
    user_retry: t('coaching.vocal.lineLoop.userRetry', { defaultValue: '따라 불러보세요' }),
    evaluating: t('coaching.vocal.lineLoop.evaluating', { defaultValue: '분석 중…' }),
    passed: t('coaching.vocal.lineLoop.passed', { defaultValue: '구간 통과!' }),
    needs_practice: t('coaching.vocal.lineLoop.needsPractice', { defaultValue: '추가 연습 필요' }),
  }[coach.phase] || coach.phase;

  return (
    <section className={shell}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold ${titleColor}`}>
            {t('coaching.vocal.lineLoop.title', { defaultValue: '부족한 구간 AI 코칭' })}
          </h3>
          <p className={`text-xs mt-0.5 ${subColor}`}>
            {t('coaching.vocal.lineLoop.subtitle', {
              defaultValue: '내 목소리로 모범창 → 따라 부르기 → 실시간 피드백',
            })}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${
            isDark ? 'bg-[#FF1F8E]/20 text-[#FF1F8E]' : 'bg-[#FFF0F7] text-[#FF1F8E]'
          }`}
        >
          {phaseLabel}
        </span>
      </div>

      {coach.weakLineIdx >= 0 && lyrics[coach.weakLineIdx] ? (
        <div className={tipBox}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${subColor}`}>
            {t('coaching.vocal.lineLoop.targetLine', {
              defaultValue: '{{n}}번 문장',
              n: coach.weakLineIdx + 1,
            })}
          </p>
          <p className={`mt-1 font-semibold ${titleColor}`}>{lyrics[coach.weakLineIdx]}</p>
          {lineScores[coach.weakLineIdx] != null ? (
            <p className={`text-xs mt-1 ${subColor}`}>
              {t('coaching.vocal.lineLoop.prevScore', {
                defaultValue: '이전 점수 {{score}}점',
                score: lineScores[coach.weakLineIdx],
              })}
            </p>
          ) : null}
        </div>
      ) : hasWeakLine ? (
        <p className={`text-xs ${subColor}`}>
          {t('coaching.vocal.lineLoop.weakDetected', {
            defaultValue: '{{n}}번 문장이 부족해요 ({{score}}점)',
            n: weak.idx + 1,
            score: weak.score,
          })}
        </p>
      ) : (
        <p className={`text-xs ${subColor}`}>
          {t('coaching.vocal.lineLoop.noWeak', { defaultValue: '부족한 구간이 없거나 아직 점수가 없어요.' })}
        </p>
      )}

      {coach.liveTip ? <p className={`text-xs leading-relaxed ${subColor}`}>{coach.liveTip}</p> : null}

      {coach.isUserRetry && coach.retryCountdown > 0 ? (
        <p className={`text-center text-lg font-bold tabular-nums ${isDark ? 'text-[#FF1F8E]' : 'text-[#4A6BFF]'}`}>
          {coach.retryCountdown}s
        </p>
      ) : null}

      {micActive && coach.isUserRetry ? (
        <div className={`grid grid-cols-2 gap-2 text-xs ${subColor}`}>
          <div className={isDark ? 'rounded-lg bg-white/5 p-2' : 'rounded-lg bg-[#FAFAFA] p-2'}>
            <p>음정 {Math.round(pitchAccuracy)}%</p>
          </div>
          <div className={isDark ? 'rounded-lg bg-white/5 p-2' : 'rounded-lg bg-[#FAFAFA] p-2'}>
            <p>{pitchFeedback || '실시간 분석 중…'}</p>
          </div>
        </div>
      ) : null}

      {coach.retryScore != null ? (
        <p className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
          {t('coaching.vocal.lineLoop.retryScore', {
            defaultValue: '재시도 점수 {{score}}점 (시도 {{attempt}}/3)',
            score: coach.retryScore,
            attempt: coach.attempt,
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {coach.phase === 'idle' && hasWeakLine ? (
          <button
            type="button"
            disabled={coach.isPreparing}
            onClick={() =>
              coach.startWeakLineCoaching({
                lineScores,
                lyrics,
                songAnalysis,
                vocalCharacteristics,
                pitchHistory,
                language,
                playbackSpeed,
              })
            }
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation ${
              isDark ? 'bg-[#FF1F8E] text-white' : 'bg-[#4A6BFF] text-white'
            } disabled:opacity-50`}
          >
            {t('coaching.vocal.lineLoop.start', { defaultValue: '부족한 구간 코칭 시작' })}
          </button>
        ) : null}

        {coach.phase === 'user_retry' && !coach.retryCountdown ? (
          <button
            type="button"
            onClick={coach.beginUserRetry}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation ${
              isDark ? 'bg-[#FF1F8E] text-white' : 'bg-[#4A6BFF] text-white'
            }`}
          >
            {t('coaching.vocal.lineLoop.singNow', { defaultValue: '따라 불러보기' })}
          </button>
        ) : null}

        {(coach.isUserRetry || coach.needsMorePractice) && coach.retryCountdown > 0 ? (
          <button
            type="button"
            onClick={coach.finishUserRetry}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation ${
              isDark ? 'border border-white/20 text-white' : 'border border-[#E5E5E5] text-[#444444]'
            }`}
          >
            {t('coaching.vocal.lineLoop.evaluate', { defaultValue: '평가 완료' })}
          </button>
        ) : null}

        {(coach.isAiSinging || coach.isUserRetry || coach.needsMorePractice) && (
          <button
            type="button"
            onClick={() => coach.replayAiLine({ language, playbackSpeed, lyrics })}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation ${
              isDark ? 'border border-white/20 text-white' : 'border border-[#4A6BFF] text-[#4A6BFF]'
            }`}
          >
            {t('coaching.vocal.lineLoop.replayAi', { defaultValue: 'AI 모범창 다시 듣기' })}
          </button>
        )}

        {coach.isPassed ? (
          <button
            type="button"
            onClick={() =>
              coach.goNextWeakLine({
                lineScores,
                lyrics,
                songAnalysis,
                vocalCharacteristics,
                pitchHistory,
                language,
                playbackSpeed,
              })
            }
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold touch-manipulation ${
              isDark ? 'bg-white/10 text-white' : 'border border-[#E5E5E5] text-[#444444]'
            }`}
          >
            {t('coaching.vocal.lineLoop.nextWeak', { defaultValue: '다음 부족한 구간' })}
          </button>
        ) : null}

        {coach.phase !== 'idle' ? (
          <button
            type="button"
            onClick={coach.resetCoach}
            className={`min-h-[44px] px-3 rounded-xl text-xs touch-manipulation ${
              isDark ? 'text-white/50' : 'text-[#888888]'
            }`}
          >
            {t('coaching.vocal.lineLoop.reset', { defaultValue: '초기화' })}
          </button>
        ) : null}
      </div>
    </section>
  );
}
