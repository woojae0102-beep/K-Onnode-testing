// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LyricsDisplay from '../components/vocal/LyricsDisplay';
import LiveScore from '../components/vocal/LiveScore';
import PitchGraph from '../components/vocal/PitchGraph';
import PitchMeter from '../components/vocal/PitchMeter';
import WaveformVisualizer from '../components/vocal/WaveformVisualizer';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';

export default function VocalTrainingView({ onNavigate, onReportUpdate }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [targetMidi, setTargetMidi] = useState(60);
  const [autoTarget, setAutoTarget] = useState(true);
  const [lineScores, setLineScores] = useState([]);
  const lineScoreAccRef = useRef({ sum: 0, count: 0 });
  const currentLineIdxRef = useRef(0);
  const liveScoreRef = useRef(0);
  const isListeningRef = useRef(false);
  const lines = useMemo(() => [t('vocal.line1'), t('vocal.line2'), t('vocal.line3'), t('vocal.line4')], [t]);
  const {
    pitchSeries,
    pitchScore,
    rhythmScore,
    liveScore,
    summary,
    currentHz,
    currentNote,
    currentCents,
    targetNote,
    tuningState,
    pitchFeedback,
    pitchAccuracy,
    volumeLevel,
    waveBars,
    micError,
    isListening,
    suggestedMidi,
    suggestedNote,
  } = useAudioAnalysis({ active: recording, targetMidi });
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    setLineScores(Array.from({ length: lines.length }, () => null));
  }, [lines.length]);

  useEffect(() => {
    currentLineIdxRef.current = lineIdx;
  }, [lineIdx]);

  useEffect(() => {
    liveScoreRef.current = liveScore;
  }, [liveScore]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if (autoTarget && suggestedMidi) {
      setTargetMidi(suggestedMidi);
    }
  }, [autoTarget, suggestedMidi]);

  const finalizeCurrentLineScore = () => {
    const { sum, count } = lineScoreAccRef.current;
    const idx = currentLineIdxRef.current;
    if (!count || idx >= lines.length) return;
    const avg = Math.round(sum / count);
    setLineScores((prev) => {
      const next = [...prev];
      next[idx] = avg;
      return next;
    });
    lineScoreAccRef.current = { sum: 0, count: 0 };
  };

  useEffect(() => {
    if (!recording) return undefined;
    setLineIdx(0);
    currentLineIdxRef.current = 0;
    setLineScores(Array.from({ length: lines.length }, () => null));
    lineScoreAccRef.current = { sum: 0, count: 0 };

    const sampleTimer = setInterval(() => {
      if (!isListeningRef.current) return;
      lineScoreAccRef.current.sum += liveScoreRef.current;
      lineScoreAccRef.current.count += 1;
    }, 500);

    const segmentTimer = setInterval(() => {
      finalizeCurrentLineScore();
      setLineIdx((prev) => {
        const next = Math.min(prev + 1, lines.length - 1);
        currentLineIdxRef.current = next;
        return next;
      });
    }, 5000);

    return () => {
      clearInterval(sampleTimer);
      clearInterval(segmentTimer);
      finalizeCurrentLineScore();
    };
  }, [lines.length, recording]);

  const lineAverage = useMemo(() => {
    const valid = lineScores.filter((v) => Number.isFinite(v));
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  }, [lineScores]);

  useEffect(() => {
    onReportUpdate?.({
      mode: 'vocal',
      recording,
      isListening,
      summary,
      liveScore,
      pitchScore,
      rhythmScore,
      currentHz,
      currentNote,
      currentCents,
      targetNote,
      tuningState,
      lineScores,
      lineAverage,
      pitchFeedback,
      updatedAt: Date.now(),
    });
  }, [
    currentCents,
    currentHz,
    currentNote,
    isListening,
    lineAverage,
    lineScores,
    liveScore,
    onReportUpdate,
    pitchFeedback,
    pitchScore,
    recording,
    rhythmScore,
    summary,
    targetNote,
    tuningState,
  ]);

  const tuningLabel = useMemo(() => {
    if (tuningState === 'in-tune') return '정확';
    if (tuningState === 'sharp') return '조금 높음';
    if (tuningState === 'flat') return '조금 낮음';
    return '대기';
  }, [tuningState]);

  const tuningColor = useMemo(() => {
    if (tuningState === 'in-tune') return 'text-emerald-500';
    if (tuningState === 'sharp') return 'text-amber-500';
    if (tuningState === 'flat') return 'text-sky-500';
    return 'text-slate-400';
  }, [tuningState]);

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#F5F5F7] space-y-4">
      <header className="rounded-xl border border-[#E5E5E5] bg-white p-4 flex items-center justify-between">
        <input placeholder={t('vocal.searchSong')} className="flex-1 rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm" />
        <div className="flex gap-2 ml-3">
          {['myUpload', 'popular', 'discover'].map((tab) => (
            <button key={tab} type="button" className="rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs text-[#888888]">
              {t(`vocal.tabs.${tab}`)}
            </button>
          ))}
        </div>
      </header>

      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
        <div className="rounded-xl border border-[#E5E5E5] bg-[#111111] text-white p-3">
          <p className="text-[11px] text-slate-300">실시간 음정</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-black leading-none">{currentNote === '-' ? '--' : currentNote}</p>
              <p className="text-xs text-slate-300 mt-1">
                {currentHz ? `${currentHz.toFixed(1)} Hz` : '음정 감지 중'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-300">목표: {targetNote}</p>
              <p className={`text-sm font-semibold ${tuningColor}`}>
                {currentCents == null ? '--' : `${currentCents > 0 ? '+' : ''}${currentCents} cents`} · {tuningLabel}
              </p>
            </div>
          </div>
        </div>
        <WaveformVisualizer active={recording && isListening} bars={waveBars} />
        <div className="rounded-xl border border-[#E5E5E5] p-3 bg-[#FAFAFA] space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#666666]">목표 음정 (MIDI {targetMidi})</p>
            <p className="text-xs font-semibold text-[#111111]">현재 {currentNote}{currentHz ? ` · ${currentHz.toFixed(1)}Hz` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoTarget((v) => !v)}
              className={`rounded-lg px-2 py-1 text-[11px] border ${
                autoTarget ? 'bg-[#FF1F8E] text-white border-[#FF1F8E]' : 'bg-white text-[#444444] border-[#E5E5E5]'
              }`}
            >
              {autoTarget ? '자동 추천 ON' : '자동 추천 OFF'}
            </button>
            <p className="text-[11px] text-[#666666]">
              추천: {suggestedMidi ? `MIDI ${suggestedMidi} (${suggestedNote})` : '음정 수집 중'}
            </p>
          </div>
          <input type="range" min="48" max="84" value={targetMidi} onChange={(e) => setTargetMidi(Number(e.target.value))} className="w-full" />
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-white border border-[#E5E5E5] px-2 py-1.5">
              <p className="text-[#888888]">피치 정확도</p>
              <p className="font-semibold text-[#111111]">{pitchAccuracy}%</p>
            </div>
            <div className="rounded-lg bg-white border border-[#E5E5E5] px-2 py-1.5">
              <p className="text-[#888888]">볼륨</p>
              <p className="font-semibold text-[#111111]">{volumeLevel}%</p>
            </div>
            <div className="rounded-lg bg-white border border-[#E5E5E5] px-2 py-1.5">
              <p className="text-[#888888]">마이크 상태</p>
              <p className="font-semibold text-[#111111]">{recording ? (isListening ? '입력 중' : '준비 중') : '꺼짐'}</p>
            </div>
          </div>
          <p className="text-xs text-[#444444]">{pitchFeedback}</p>
          {micError ? <p className="text-xs text-rose-500">{micError}</p> : null}
        </div>
        <LyricsDisplay lines={lines} activeIndex={lineIdx} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`w-16 h-16 rounded-full ${recording ? 'bg-red-500' : 'bg-[#FF1F8E]'} text-white text-xs font-semibold`}
            onClick={() => {
              setRecording((v) => !v);
            }}
          >
            {recording ? t('vocal.stop') : t('vocal.record')}
          </button>
          <PitchMeter value={pitchScore} />
          <div className="flex-1">
            <PitchGraph data={pitchSeries} />
          </div>
          <LiveScore value={liveScore} />
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
        <p className="text-lg font-semibold text-[#111111]">{t('vocal.result')}</p>
        <p className="text-4xl font-black text-[#111111]">{summary.total}</p>
        <div className="grid grid-cols-4 gap-2">
          <ScoreCard label={t('vocal.pitch')} value={summary.pitch} />
          <ScoreCard label={t('vocal.rhythm')} value={summary.rhythm} />
          <ScoreCard label={t('vocal.voice')} value={summary.voice} />
          <ScoreCard label={t('vocal.emotion')} value={summary.emotion} />
        </div>
        <div className="rounded-xl border border-[#E5E5E5] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#111111]">라인별 점수</p>
            <p className="text-xs text-[#666666]">평균: {lineAverage ?? '—'}</p>
          </div>
          <div className="space-y-1.5">
            {lines.map((line, idx) => (
              <div key={`${idx}-${line.slice(0, 10)}`} className="flex items-center gap-2">
                <p className={`flex-1 text-[11px] truncate ${idx === lineIdx ? 'text-[#111111] font-semibold' : 'text-[#666666]'}`}>{line}</p>
                <span className="w-10 text-right text-[11px] font-semibold text-[#111111]">{lineScores[idx] ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-[#888888]">{pitchFeedback || t('vocal.aiComment')}</p>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="rounded-lg border border-[#E5E5E5] py-2 text-xs">{t('vocal.retry')}</button>
          <button type="button" className="rounded-lg border border-[#E5E5E5] py-2 text-xs">{t('vocal.save')}</button>
          <button type="button" className="rounded-lg bg-[#FF1F8E] text-white py-2 text-xs">
            {t('vocal.share')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, value }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-[#F5F5F7] p-2">
      <p className="text-[10px] text-[#888888]">{label}</p>
      <p className="text-xl font-bold text-[#111111]">{value}</p>
    </div>
  );
}
