// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKoreanSpeechCoach } from '../../hooks/useKoreanSpeechCoach';

// Drama scene used as the speaking-practice reference. Picked by the producer.
// To swap the scene, only change these constants.
const DRAMA_VIDEO_ID = 'QnBdaeu8VC8';
const DRAMA_PLAYLIST_ID = 'PLnZKJXHN_A1QrV00bS2LOsCq6_Ns8EHJu';
const DRAMA_TITLE = 'K-드라마 한 장면으로 한국어 회화 연습';
const DRAMA_DESCRIPTION =
  '아래 영상을 한 번 듣고 → 멈춘 뒤 → 한 줄씩 따라 말해 보세요. 오른쪽 점수가 실시간으로 채점됩니다.';

const PRACTICE_LINES = [
  '안녕하세요, 처음 뵙겠습니다.',
  '오늘 정말 잘 부탁드려요.',
  '괜찮아요, 천천히 말씀해 주세요.',
  '저는 한국어를 공부하고 있어요.',
  '같이 가도 될까요?',
];

export default function FollowAlongMode({ onReportUpdate }) {
  const { t } = useTranslation();
  const [activeLineIdx, setActiveLineIdx] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [lineScores, setLineScores] = useState(Array.from({ length: PRACTICE_LINES.length }, () => null));
  const scoreAccRef = useRef({ sum: 0, count: 0 });
  const currentLineRef = useRef(-1);
  const { combinedTranscript, metrics, micError, speechError } = useKoreanSpeechCoach({
    active: recording,
    referenceText: activeLineIdx >= 0 ? PRACTICE_LINES[activeLineIdx] : '',
  });

  const finalizeLineScore = () => {
    const idx = currentLineRef.current;
    if (idx < 0) return;
    const { sum, count } = scoreAccRef.current;
    if (!count) return;
    const avg = Math.round(sum / count);
    setLineScores((prev) => {
      const next = [...prev];
      next[idx] = avg;
      return next;
    });
    scoreAccRef.current = { sum: 0, count: 0 };
  };

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => {
      scoreAccRef.current.sum += metrics.overall;
      scoreAccRef.current.count += 1;
    }, 500);
    return () => clearInterval(timer);
  }, [metrics.overall, recording]);

  useEffect(() => {
    const validScores = lineScores.filter((value) => Number.isFinite(value));
    const avg = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;
    onReportUpdate?.({
      mode: 'korean-follow',
      recording,
      activeLineIdx,
      transcript: combinedTranscript,
      metrics,
      lineScores,
      lineAverage: avg,
      updatedAt: Date.now(),
    });
  }, [activeLineIdx, combinedTranscript, lineScores, metrics, onReportUpdate, recording]);

  const toggleLineRecording = (idx) => {
    if (recording && idx === activeLineIdx) {
      finalizeLineScore();
      setRecording(false);
      setActiveLineIdx(-1);
      currentLineRef.current = -1;
      return;
    }
    if (recording) finalizeLineScore();
    scoreAccRef.current = { sum: 0, count: 0 };
    setActiveLineIdx(idx);
    currentLineRef.current = idx;
    setRecording(true);
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#111111]">{t('korean.followTitle')}</p>
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#FF1F8E]">🎬 {DRAMA_TITLE}</p>
          <p className="text-[11px] text-[#666666]">{DRAMA_DESCRIPTION}</p>
        </div>
        <div
          className="relative w-full overflow-hidden rounded-lg border border-[#E5E5E5] bg-black"
          style={{ paddingBottom: '56.25%' }}
        >
          <iframe
            title={DRAMA_TITLE}
            src={`https://www.youtube.com/embed/${DRAMA_VIDEO_ID}?list=${DRAMA_PLAYLIST_ID}&rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
          />
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${DRAMA_VIDEO_ID}&list=${DRAMA_PLAYLIST_ID}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#666666] hover:text-[#FF1F8E]"
        >
          유튜브에서 전체 재생목록 보기 →
        </a>
      </div>
      <div className="h-px bg-[#EDEDED]" />
      <p className="text-[11px] text-[#888888]">아래 한 줄씩 녹음 → 점수 확인 → 다시 듣기 흐름으로 연습해요.</p>
      {PRACTICE_LINES.map((line, idx) => (
        <div key={idx} className="rounded-lg border border-[#E5E5E5] p-3 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-[#111111]">{line}</p>
            <p className="text-[11px] text-[#666666] mt-0.5">
              점수: {lineScores[idx] ?? '—'} {activeLineIdx === idx && recording ? `· 실시간 ${metrics.overall}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-[#E5E5E5] px-2 py-1 text-xs">{t('korean.nativePlay')}</button>
            <button
              type="button"
              onClick={() => toggleLineRecording(idx)}
              className={`rounded-lg px-2 py-1 text-xs text-white ${recording && activeLineIdx === idx ? 'bg-rose-500' : 'bg-[#FF1F8E]'}`}
            >
              {recording && activeLineIdx === idx ? '중지' : t('korean.record')}
            </button>
          </div>
        </div>
      ))}
      <div className="rounded-lg bg-[#F5F5F7] p-3">
        <p className="text-xs text-[#666666]">실시간 인식</p>
        <p className="text-sm text-[#111111] mt-1">{combinedTranscript || '라인 녹음을 시작하면 실시간 문장이 표시됩니다.'}</p>
        <p className="text-xs text-[#666666] mt-2">문장 일치 {metrics.similarity}% · 속도 {metrics.pace}% · 선명도 {metrics.clarity}%</p>
      </div>
      {micError ? <p className="text-xs text-rose-500">{micError}</p> : null}
      {speechError ? <p className="text-xs text-rose-500">{speechError}</p> : null}
    </div>
  );
}
