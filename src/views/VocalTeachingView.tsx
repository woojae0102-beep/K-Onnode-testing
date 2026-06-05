// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeachingStepBar from '../components/teaching/TeachingStepBar';
import TeachingPracticePanel from '../components/teaching/TeachingPracticePanel';
import TeachingReviewPanel from '../components/teaching/TeachingReviewPanel';
import TeachingUploadFallback from '../components/teaching/TeachingUploadFallback';
import { AnalysisLoadingScreen } from '../components/teaching/AnalysisLoadingScreen';
import SplitScreenPlayer from '../components/teaching/SplitScreenPlayer';
import PitchCompareGraph from '../components/teaching/PitchCompareGraph';
import VocalPersonaCoach from '../components/teaching/VocalPersonaCoach';
import { useVocalClone } from '../hooks/useVocalClone';
import { useSpotifyAnalysis } from '../hooks/useSpotifyAnalysis';
import { getVocalCoachMessage } from '../utils/vocalCoaching';
import { saveTeachingReport } from '../services/teachingReportStore';
import { useTeachingTts } from '../hooks/useTeachingTts';

const VOCAL_STEPS = [
  { id: 1, label: '녹음 업로드 중...', icon: '📤' },
  { id: 2, label: '내 목소리 특성 학습 중...', icon: '🎙️' },
  { id: 3, label: '음정 분석 중...', icon: '📊' },
  { id: 4, label: 'AI 모범창 생성 중...', icon: '✨' },
  { id: 5, label: '티칭 화면 준비 중...', icon: '🎵' },
  { id: 6, label: '완료!', icon: '✅' },
];

function WaveBars({ bars, color }) {
  return (
    <div className="flex items-end gap-0.5 h-20 px-2">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: color, opacity: 0.9 }} />
      ))}
    </div>
  );
}

export default function VocalTeachingView({ onNavigate }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('setup');
  const [audioFile, setAudioFile] = useState(null);
  const [myAudioUrl, setMyAudioUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [enableClone, setEnableClone] = useState(true);
  const [enablePitchGraph, setEnablePitchGraph] = useState(true);
  const [loadingStep, setLoadingStep] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState('both');

  const myAudioRef = useRef(null);
  const coverAudioRef = useRef(null);

  const {
    cloneVoice,
    analyzeVocal,
    generateCover,
    coverUrl,
    analysis,
    error,
    isCloning,
    cloneProgress,
    reset,
  } = useVocalClone();
  const { songAnalysis, analyzeSong } = useSpotifyAnalysis();
  const { playAudioUrl } = useTeachingTts();
  const [coverFallbackText, setCoverFallbackText] = useState('');

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setMyAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [audioFile]);

  const myBars = Array.from({ length: 48 }, (_, i) => 20 + Math.sin(i * 0.3) * 30);

  const coachMessage = useMemo(
    () => getVocalCoachMessage(analysis, currentTime),
    [analysis, currentTime]
  );

  const lyrics = analysis?.lyrics || [];

  useEffect(() => {
    if (phase === 'teaching' && !coverUrl && coverFallbackText) {
      playAudioUrl('', coverFallbackText);
    }
  }, [phase, coverUrl, coverFallbackText, playAudioUrl]);

  const handleStart = async () => {
    if (!audioFile) return;
    setPhase('cloning');
    setLoadingStep(1);
    try {
      const q = [songTitle, songArtist].filter(Boolean).join(' ');
      const sa = q ? await analyzeSong(q) : songAnalysis;

      if (enableClone) {
        setLoadingStep(2);
        await cloneVoice(audioFile);
      }
      setPhase('analyzing');
      setLoadingStep(3);
      const analysisResult = await analyzeVocal(audioFile, sa, { language: 'ko' });

      if (enableClone) {
        setPhase('generating');
        setLoadingStep(4);
        const lyricsText =
          analysisResult?.transcript ||
          (analysisResult?.lyrics || []).map((l) => l.text).join(' ') ||
          songTitle;
        const coverData = await generateCover({
          lyrics: lyricsText,
          songTitle: sa?.trackName || songTitle,
          songAnalysis: sa,
          targetPitches: analysisResult?.targetPitchSeries,
          language: 'ko',
        });
        if (!coverData?.audioUrl) {
          setCoverFallbackText(coverData?.fallbackText || lyricsText);
        }
      }
      setLoadingStep(6);
      setPhase('teaching');
      saveTeachingReport('vocal', {
        overallPitchScore: analysisResult?.overallPitchScore,
        metrics: {
          overall: analysisResult?.overallPitchScore ?? analysisResult?.feedback?.overallScore,
        },
        feedback: analysisResult?.feedback,
        transcript: analysisResult?.transcript,
        updatedAt: Date.now(),
      });
    } catch {
      setPhase('review');
    }
  };

  const syncPlay = (playing) => {
    const my = myAudioRef.current;
    const cover = coverAudioRef.current;
    if (!my) return;
    if (playing) {
      if (playMode === 'mine' || playMode === 'both') my.play().catch(() => {});
      else my.pause();
      if (cover && (playMode === 'cover' || playMode === 'both')) cover.play().catch(() => {});
      else if (cover) cover.pause();
    } else {
      my.pause();
      cover?.pause();
    }
    setIsPlaying(playing);
  };

  if (phase === 'setup') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="setup" />
        <h1 className="text-xl font-bold mb-1">{t('teaching.session.vocalTitle')}</h1>
        <p className="text-sm text-white/50 mb-6">{t('teaching.session.vocalSubtitle')}</p>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold">원곡 정보 (선택)</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="곡명"
              className="flex-1 min-w-[120px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              value={songArtist}
              onChange={(e) => setSongArtist(e.target.value)}
              placeholder="아티스트"
              className="flex-1 min-w-[120px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => analyzeSong([songTitle, songArtist].filter(Boolean).join(' '))} className="rounded-lg px-3 py-2 bg-white/10 text-sm">
              Spotify
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={enableClone} onChange={(e) => setEnableClone(e.target.checked)} />
          내 목소리로 모범창 생성
        </label>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={enablePitchGraph} onChange={(e) => setEnablePitchGraph(e.target.checked)} />
          음정 그래프 비교
        </label>
        <TeachingUploadFallback
          accept="audio"
          maxSizeMb={100}
          label="녹음 파일 업로드"
          hint="mp3, wav, m4a"
          onFile={(f) => {
            setAudioFile(f);
            setPhase('review');
          }}
        />
        <button
          type="button"
          onClick={() => setPhase('practice')}
          className="w-full py-4 rounded-xl font-bold mt-4"
          style={{ background: '#FF1F8E' }}
        >
          {t('teaching.session.practiceFirst')}
        </button>
      </div>
    );
  }

  if (phase === 'practice') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="practice" />
        <TeachingPracticePanel
          mode="vocal"
          onComplete={(file) => {
            setAudioFile(file);
            setPhase('review');
          }}
          onCancel={() => setPhase('setup')}
        />
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="review" />
        {error ? <p className="text-rose-400 text-sm mb-4">{error}</p> : null}
        <TeachingReviewPanel
          file={audioFile}
          mode="vocal"
          isLoading={isCloning}
          onRetake={() => {
            setAudioFile(null);
            setPhase('practice');
          }}
          onAnalyze={handleStart}
        />
      </div>
    );
  }

  if (phase === 'cloning' || phase === 'analyzing' || phase === 'generating') {
    return (
      <div className="min-h-full bg-[#0a0a0f]">
        <AnalysisLoadingScreen steps={VOCAL_STEPS} currentStep={loadingStep} title="보컬 분석" />
        {isCloning ? (
          <div className="max-w-md mx-auto px-6 -mt-20">
            <p className="text-sm text-white/60 text-center mb-2">내 목소리 특성을 학습하고 있습니다...</p>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#FF1F8E] transition-all" style={{ width: `${cloneProgress}%` }} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === 'result') {
    const score = analysis?.overallPitchScore ?? analysis?.feedback?.overallScore ?? 0;
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-6">
        <h2 className="text-2xl font-bold mb-4">보컬 결과</h2>
        <p className="text-4xl font-black text-[#FF1F8E] mb-4">{score}%</p>
        <p className="text-white/70 text-sm mb-2">{analysis?.feedback?.pitchAnalysis}</p>
        <p className="text-white/70 text-sm mb-6">{analysis?.coachingAdvice || analysis?.feedback?.coachingAdvice}</p>
        <button type="button" onClick={() => { reset(); setPhase('setup'); }} className="w-full py-3 rounded-xl bg-[#FF1F8E]">
          다시 연습
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-full bg-[#0a0a0f] p-4 flex flex-col gap-4"
      style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex justify-between">
        <h2 className="text-lg font-bold text-white">보컬 티칭</h2>
        <button type="button" onClick={() => setPhase('result')} className="text-sm text-[#FF1F8E]">결과</button>
      </div>
      <SplitScreenPlayer
        leftLabel="내 보컬"
        rightLabel="AI 모범창"
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={(t) => {
          setCurrentTime(t);
          if (myAudioRef.current) myAudioRef.current.currentTime = t;
          if (coverAudioRef.current) coverAudioRef.current.currentTime = t;
        }}
        onPlayPause={() => syncPlay(!isPlaying)}
        extraControls={
          <>
            {[
              { id: 'both', label: '동시 재생' },
              { id: 'mine', label: '내 것만' },
              { id: 'cover', label: 'AI만' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPlayMode(id)}
                className={`px-2 py-1 rounded text-xs ${playMode === id ? 'bg-[#FF1F8E]' : 'bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </>
        }
        leftContent={
          <div className="flex flex-col h-full justify-center">
            <audio ref={myAudioRef} src={myAudioUrl} onLoadedMetadata={(e) => setDuration(e.target.duration)} onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)} />
            <WaveBars bars={myBars} color="#FF1F8E" />
          </div>
        }
        rightContent={
          <div className="flex flex-col h-full justify-center">
            {coverUrl ? <audio ref={coverAudioRef} src={coverUrl} /> : <p className="text-center text-white/40 text-sm p-4">모범창 미생성 (API 키 확인)</p>}
            <WaveBars bars={myBars.map((b) => Math.min(100, b * 0.9))} color="#60a5fa" />
          </div>
        }
        footer={
          enablePitchGraph && analysis ? (
            <div className="px-4 pb-2">
              <PitchCompareGraph
                mySeries={analysis.pitchSeries}
                targetSeries={analysis.targetPitchSeries}
                currentTime={currentTime}
                duration={duration}
              />
            </div>
          ) : null
        }
      />
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-xs text-white/50 mb-2">가사</p>
        <div className="flex flex-wrap gap-2">
          {lyrics.length ? lyrics.map((line, i) => {
            const active = currentTime >= line.start && currentTime < line.end;
            return (
              <span
                key={i}
                className={`text-sm px-2 py-1 rounded ${active ? (line.match ? 'bg-emerald-500/30 text-emerald-200' : 'bg-rose-500/30 text-rose-200') : 'text-white/50'}`}
              >
                {line.text}
              </span>
            );
          }) : (
            <span className="text-white/50 text-sm">{analysis?.transcript || '가사 없음'}</span>
          )}
        </div>
      </div>
      <VocalPersonaCoach
        instruction={coachMessage.instruction}
        highlightText={coachMessage.highlightText}
        personaName={songAnalysis?.personaName || '보컬 페르소나 코치'}
        personaAvatar="🎤"
        autoSpeak
      />
    </div>
  );
}
