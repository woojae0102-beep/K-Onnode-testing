// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LyricsDisplay from '../components/vocal/LyricsDisplay';
import LiveScore from '../components/vocal/LiveScore';
import PitchGraph from '../components/vocal/PitchGraph';
import PitchMeter from '../components/vocal/PitchMeter';
import WaveformVisualizer from '../components/vocal/WaveformVisualizer';
import { useAudioAnalysis } from '../hooks/useAudioAnalysis';
import { useSpotifyAnalysis } from '../hooks/useSpotifyAnalysis';
import { useVocalSoulCoach } from '../hooks/useVocalSoulCoach';
import { useSettingsStore } from '../store/settingsSlice';
import SongPersonaCard from '../components/coaching/SongPersonaCard';
import VocalSoulFeedback from '../components/coaching/VocalSoulFeedback';
import PlaybackSpeedControl from '../components/teaching/PlaybackSpeedControl';

export default function VocalTrainingView({ onNavigate, onReportUpdate }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [targetMidi, setTargetMidi] = useState(60);
  const [autoTarget, setAutoTarget] = useState(true);
  const [lineScores, setLineScores] = useState([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
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

  // ── 곡 페르소나 + 보컬 소울 코칭 ──
  const settings = useSettingsStore((state) => state.settings);
  const vocalCoachPersona = (settings?.vocalPersona || 'jyp_park');
  const language = settings?.coachLanguage || 'ko';
  const aiCoachOptions = useMemo(
    () => ({
      coachTone: settings?.coachTone || 'friendly',
      feedbackSensitivity: settings?.feedbackSensitivity || 3,
      coachMode: settings?.coachMode || 'single',
    }),
    [settings?.coachMode, settings?.coachTone, settings?.feedbackSensitivity]
  );
  const [songQuery, setSongQuery] = useState('');
  const {
    songAnalysis,
    isAnalyzing: isSongAnalyzing,
    analyzeSong,
    resetSongAnalysis,
  } = useSpotifyAnalysis();
  const {
    vocalCharacteristics,
    analyzeVocalCharacteristics,
    latest: soulFeedback,
    isLoading: isSoulLoading,
    requestCoaching: requestSoulCoaching,
    resetCoach: resetSoulCoach,
  } = useVocalSoulCoach();
  const [soulPhase, setSoulPhase] = useState('idle');
  const lastRealtimeAtRef = useRef(0);
  const pitchHistoryRef = useRef([]);
  const characteristicsDoneRef = useRef(false);

  const handleAnalyzeSong = async () => {
    const q = songQuery.trim();
    if (!q) return;
    resetSoulCoach();
    const analysis = await analyzeSong(q, { language });
    if (!analysis) return;
    setSoulPhase('start');
    await requestSoulCoaching({
      songAnalysis: analysis,
      pitchData: null,
      sessionPhase: 'start',
      coachPersona: vocalCoachPersona,
      userVocalCharacteristics: vocalCharacteristics,
      language,
      ...aiCoachOptions,
    });
  };

  // 녹음 중 음정 히스토리 수집 + 첫 30개에서 보이스 특성 자동 분석
  useEffect(() => {
    if (!recording) return undefined;
    pitchHistoryRef.current = [];
    characteristicsDoneRef.current = false;
    const id = window.setInterval(() => {
      const hz = Number(currentHz);
      if (Number.isFinite(hz) && hz > 0) {
        pitchHistoryRef.current.push(hz);
        if (
          !characteristicsDoneRef.current &&
          pitchHistoryRef.current.length >= 30
        ) {
          analyzeVocalCharacteristics(pitchHistoryRef.current.slice());
          characteristicsDoneRef.current = true;
        }
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [recording, currentHz, analyzeVocalCharacteristics]);

  // 음정 이탈 시(쓰로틀 적용) 감정 언어로 실시간 코칭
  useEffect(() => {
    if (!recording || !songAnalysis) return;
    if (!Number.isFinite(pitchAccuracy)) return;
    if (pitchAccuracy >= 60) return;
    const now = Date.now();
    if (now - lastRealtimeAtRef.current < 12000) return;
    lastRealtimeAtRef.current = now;
    setSoulPhase('realtime');
    requestSoulCoaching({
      songAnalysis,
      pitchData: {
        avgAccuracy: pitchAccuracy,
        problemSections: [`${currentNote || '?'} 구간`],
        bestMoments: [],
        breathingStability: Math.round(Number(volumeLevel) || 0),
        emotionScore: Math.round(Number(liveScore) || 0),
      },
      sessionPhase: 'realtime',
      coachPersona: vocalCoachPersona,
      userVocalCharacteristics: vocalCharacteristics,
      language,
      ...aiCoachOptions,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchAccuracy, recording, songAnalysis?.trackId]);

  // 녹음을 멈췄을 때 종합 코칭
  const prevRecordingRef = useRef(false);
  useEffect(() => {
    if (prevRecordingRef.current && !recording && songAnalysis) {
      setSoulPhase('end');
      requestSoulCoaching({
        songAnalysis,
        pitchData: {
          avgAccuracy: pitchAccuracy,
          problemSections: [],
          bestMoments: lineScores
            .map((v, idx) => ({ v, idx }))
            .filter((x) => Number.isFinite(x.v) && x.v >= 80)
            .map((x) => `${x.idx + 1}번 라인`),
          breathingStability: Math.round(Number(volumeLevel) || 0),
          emotionScore: Math.round(Number(liveScore) || 0),
        },
        sessionPhase: 'end',
        coachPersona: vocalCoachPersona,
        userVocalCharacteristics: vocalCharacteristics,
        language,
        ...aiCoachOptions,
      });
    }
    prevRecordingRef.current = recording;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, songAnalysis?.trackId]);

  const phaseLabel = useMemo(() => {
    if (!soulPhase || soulPhase === 'idle') return undefined;
    return t(`coaching.phaseLabels.${soulPhase}`, { defaultValue: '' });
  }, [soulPhase, t]);

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

  const voiceMatch = useMemo(() => {
    const pitch = Number(pitchAccuracy) || 0;
    const rhythm = Number(rhythmScore) || 0;
    const voice = Number(summary?.voice) || 0;
    const emotion = Number(summary?.emotion) || 0;
    return Math.round(pitch * 0.38 + rhythm * 0.22 + voice * 0.24 + emotion * 0.16);
  }, [pitchAccuracy, rhythmScore, summary?.emotion, summary?.voice]);

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#F5F5F7] space-y-4">
      <header className="rounded-xl border border-[#E5E5E5] bg-white p-4 flex items-center justify-between">
        <input
          value={songQuery}
          onChange={(e) => setSongQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyzeSong(); }}
          placeholder={t('coaching.song.placeholder')}
          className="flex-1 rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm"
        />
        <div className="flex gap-2 ml-3">
          <button
            type="button"
            onClick={handleAnalyzeSong}
            disabled={isSongAnalyzing || !songQuery.trim()}
            className="rounded-lg bg-[#FF1F8E] text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {isSongAnalyzing ? t('coaching.song.analyzing') : t('coaching.song.analyze')}
          </button>
          {songAnalysis ? (
            <button
              type="button"
              onClick={() => {
                resetSongAnalysis();
                resetSoulCoach();
                setSongQuery('');
                setSoulPhase('idle');
              }}
              className="rounded-lg border border-[#E5E5E5] px-3 py-2 text-xs text-[#888888]"
            >
              {t('coaching.song.reset')}
            </button>
          ) : null}
        </div>
      </header>

      {songAnalysis ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-3">
            <PlaybackSpeedControl
              value={playbackSpeed}
              onChange={setPlaybackSpeed}
              variant="light"
              compact
              label="코치 음성 속도"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SongPersonaCard analysis={songAnalysis} mode="vocal" />
            <VocalSoulFeedback
              feedback={soulFeedback}
              coachPersona={vocalCoachPersona}
              language={language}
              vocalCharacteristics={vocalCharacteristics}
              loading={isSoulLoading}
              phaseLabel={phaseLabel}
              autoPlay={soulPhase !== 'realtime' || !recording}
              playbackSpeed={playbackSpeed}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-3">
        <VoiceMatchCoachPanel
          recording={recording}
          currentHz={currentHz}
          currentNote={currentNote}
          targetMidi={targetMidi}
          targetNote={targetNote}
          tuningState={tuningState}
          pitchAccuracy={pitchAccuracy}
          rhythmScore={rhythmScore}
          voiceScore={summary.voice}
          emotionScore={summary.emotion}
          volumeLevel={volumeLevel}
          vocalCharacteristics={vocalCharacteristics}
          voiceMatch={voiceMatch}
        />

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
        {soulFeedback ? (
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white border border-[#E5E5E5] px-3 py-2">
              <p className="text-[10px] text-[#888888]">{t('coaching.vocal.soulScore')}</p>
              <p className="text-xl font-black text-[#FF1F8E]">{soulFeedback.soulScore}</p>
            </div>
            <div className="rounded-lg bg-white border border-[#E5E5E5] px-3 py-2">
              <p className="text-[10px] text-[#888888]">{t('coaching.vocal.pitchScore')}</p>
              <p className="text-xl font-black text-[#4A6BFF]">{soulFeedback.pitchScore}</p>
            </div>
          </div>
        ) : null}
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

function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function voiceCoachCopy({ tuningState, pitchAccuracy, rhythmScore, emotionScore, volumeLevel }) {
  if (tuningState === 'sharp') return '음정이 살짝 높아요. 턱 힘을 빼고 호흡을 아래로 내려보세요.';
  if (tuningState === 'flat') return '음정이 살짝 낮아요. 첫 자음 전에 호흡 압력을 조금 더 만들어주세요.';
  if (pitchAccuracy < 55) return '한 음을 길게 유지하면서 목표 음정에 천천히 붙여보세요.';
  if (rhythmScore < 55) return '박자 시작점이 흔들려요. 첫 박을 손뼉처럼 짧게 찍어보세요.';
  if (emotionScore < 55 || volumeLevel < 20) return '감정 에너지가 작아요. 가사를 말하듯 선명하게 밀어주세요.';
  return '좋아요. 지금은 음정 안정감이 있으니 바이브와 끝음 처리에 집중하세요.';
}

function vibeLabel(score) {
  if (score >= 80) return '표현 강함';
  if (score >= 60) return '표현 안정';
  if (score >= 40) return '표현 준비';
  return '표현 약함';
}

function VoiceMatchCoachPanel({
  recording,
  currentHz,
  currentNote,
  targetMidi,
  targetNote,
  tuningState,
  pitchAccuracy,
  rhythmScore,
  voiceScore,
  emotionScore,
  volumeLevel,
  vocalCharacteristics,
  voiceMatch,
}) {
  const [playing, setPlaying] = useState(false);
  const coachLine = voiceCoachCopy({ tuningState, pitchAccuracy, rhythmScore, emotionScore, volumeLevel });

  const playReference = async () => {
    if (playing) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    setPlaying(true);
    try {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const baseFreq = currentHz && Number.isFinite(currentHz) ? currentHz : midiToHz(targetMidi);
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1050;
      osc.type = 'sine';
      overtone.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      overtone.frequency.setValueAtTime(baseFreq * 2, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
      osc.connect(tone);
      overtone.connect(tone);
      tone.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      overtone.start(now);
      osc.stop(now + 1.35);
      overtone.stop(now + 1.35);
      window.setTimeout(() => {
        ctx.close().catch(() => {});
        setPlaying(false);
      }, 1450);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-gradient-to-br from-[#111111] via-[#1A1020] to-[#FF1F8E] p-4 text-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">AI Voice Match Coach</p>
          <h3 className="text-lg font-black">내 목소리 기반 기준 보컬</h3>
          <p className="mt-1 text-xs text-white/70">
            {vocalCharacteristics
              ? `${vocalCharacteristics.type} · ${vocalCharacteristics.range} 분석 반영`
              : recording
                ? '목소리 톤을 수집해 기준 보컬을 맞추는 중'
                : '녹음 버튼을 누르면 내 목소리 특성을 분석합니다'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/60">유사도</p>
          <p className="text-3xl font-black">{voiceMatch}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[10px]">
        <VoiceMetric label="음정" value={pitchAccuracy} />
        <VoiceMetric label="박자" value={rhythmScore} />
        <VoiceMetric label="톤" value={voiceScore} />
        <VoiceMetric label="감정" value={emotionScore} />
      </div>

      <div className="rounded-xl bg-white/10 border border-white/15 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-white/60">기준 음정</p>
            <p className="text-sm font-bold">
              목표 {targetNote} · 현재 {currentNote === '-' ? '감지 중' : currentNote}
            </p>
          </div>
          <button
            type="button"
            onClick={playReference}
            className="rounded-lg bg-white px-3 py-2 text-xs font-black text-[#111111] disabled:opacity-60"
            disabled={playing}
          >
            {playing ? '재생 중...' : '기준 보컬 듣기'}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/85 leading-relaxed">{coachLine}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
          <p className="text-white/55">바이브</p>
          <p className="mt-1 font-bold">{vibeLabel(emotionScore)}</p>
        </div>
        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
          <p className="text-white/55">호흡/볼륨</p>
          <p className="mt-1 font-bold">{volumeLevel >= 35 ? '충분함' : '조금 더 필요'}</p>
        </div>
      </div>
    </div>
  );
}

function VoiceMetric({ label, value }) {
  const safe = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div className="rounded-xl bg-white/10 border border-white/10 p-2">
      <p className="text-white/60">{label}</p>
      <p className="mt-1 text-lg font-black">{safe}</p>
      <div className="mt-1 h-1 rounded-full bg-white/15 overflow-hidden">
        <div className="h-full rounded-full bg-white" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
