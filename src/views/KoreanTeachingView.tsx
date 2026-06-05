// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeachingStepBar from '../components/teaching/TeachingStepBar';
import TeachingPracticePanel from '../components/teaching/TeachingPracticePanel';
import TeachingReviewPanel from '../components/teaching/TeachingReviewPanel';
import TeachingUploadFallback from '../components/teaching/TeachingUploadFallback';
import { AnalysisLoadingScreen } from '../components/teaching/AnalysisLoadingScreen';
import SplitScreenPlayer from '../components/teaching/SplitScreenPlayer';
import PronunciationWave from '../components/teaching/PronunciationWave';
import SyllableAccuracyBar from '../components/teaching/SyllableAccuracyBar';
import IntonationCompareGraph from '../components/teaching/IntonationCompareGraph';
import KoreanPersonaCoach from '../components/teaching/KoreanPersonaCoach';
import { useKoreanPronunciation } from '../hooks/useKoreanPronunciation';
import { useTeachingTts } from '../hooks/useTeachingTts';
import { getKoreanCoachMessage } from '../utils/koreanCoaching';
import { saveTeachingReport } from '../services/teachingReportStore';

const KO_STEPS = [
  { id: 1, label: '발음 녹음 업로드...', icon: '📤' },
  { id: 2, label: 'Whisper 음성 인식 중...', icon: '🎤' },
  { id: 3, label: '발음 정확도 분석...', icon: '📊' },
  { id: 4, label: '내 목소리로 교정 발음 생성...', icon: '✨' },
  { id: 5, label: '비교 화면 준비...', icon: '🇰🇷' },
  { id: 6, label: '완료!', icon: '✅' },
];

const SAMPLE_LINES = '안녕하세요, 오늘도 열심히 연습해 볼게요. 발음을 또렷하게 하면서 천천히 읽어 주세요.';

export default function KoreanTeachingView({ onNavigate }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('setup');
  const [audioFile, setAudioFile] = useState(null);
  const [myAudioUrl, setMyAudioUrl] = useState('');
  const [referenceText, setReferenceText] = useState(SAMPLE_LINES);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [loadingStep, setLoadingStep] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState('both');

  const myAudioRef = useRef(null);
  const correctedRef = useRef(null);

  const {
    analyze,
    cloneAndCorrect,
    fetchLyrics,
    analysis,
    correctedAudioUrl,
    correctedFallbackText,
    error,
    isGenerating,
    reset,
  } = useKoreanPronunciation();
  const { playAudioUrl } = useTeachingTts();

  const coachMessage = useMemo(() => getKoreanCoachMessage(analysis, currentTime), [analysis, currentTime]);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setMyAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [audioFile]);

  const handleLoadLyrics = async () => {
    try {
      const lyrics = await fetchLyrics(songTitle, songArtist);
      setReferenceText(lyrics);
    } catch (e) {
      alert(String(e?.message || '가사를 불러오지 못했습니다.'));
    }
  };

  const handleStart = async () => {
    if (!audioFile) return;
    setPhase('analyzing');
    setLoadingStep(2);
    try {
      const analysisResult = await analyze(audioFile, referenceText);
      setLoadingStep(4);
      setPhase('generating');
      await cloneAndCorrect(audioFile, referenceText);
      setLoadingStep(6);
      setPhase('teaching');
      saveTeachingReport('korean', {
        metrics: { overall: analysisResult?.accuracy },
        transcript: analysisResult?.recognizedText || analysisResult?.transcript,
        feedback: analysisResult?.feedback,
        syllables: analysisResult?.syllables,
        updatedAt: Date.now(),
      });
    } catch {
      setPhase('review');
    }
  };

  useEffect(() => {
    if (!correctedAudioUrl && correctedFallbackText && phase === 'teaching') {
      playAudioUrl('', correctedFallbackText);
    }
  }, [correctedAudioUrl, correctedFallbackText, phase, playAudioUrl]);

  const syncPlay = (playing) => {
    const my = myAudioRef.current;
    const corrected = correctedRef.current;
    if (!my) return;
    if (playing) {
      if (playMode === 'mine' || playMode === 'both') my.play().catch(() => {});
      else my.pause();
      if (corrected && (playMode === 'corrected' || playMode === 'both')) corrected.play().catch(() => {});
      else corrected?.pause();
    } else {
      my.pause();
      corrected?.pause();
    }
    setIsPlaying(playing);
  };

  if (phase === 'setup') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-4 md:p-6">
        <TeachingStepBar current="setup" />
        <h1 className="text-xl font-bold mb-1">{t('teaching.session.koreanTitle')}</h1>
        <p className="text-sm text-white/50 mb-6">{t('teaching.session.koreanSubtitle')}</p>
        <div className="mb-4">
          <label className="text-sm font-semibold block mb-2">연습할 텍스트/가사</label>
          <textarea
            value={referenceText}
            onChange={(e) => setReferenceText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2 text-sm"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 space-y-2">
          <p className="text-sm font-semibold">K-POP 가사 불러오기</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="곡명"
              className="flex-1 min-w-[100px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
            <input
              value={songArtist}
              onChange={(e) => setSongArtist(e.target.value)}
              placeholder="아티스트"
              className="flex-1 min-w-[100px] rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm"
            />
            <button type="button" onClick={handleLoadLyrics} className="rounded-lg px-3 py-2 bg-[#FF1F8E] text-sm font-semibold shrink-0">
              가사 불러오기
            </button>
          </div>
        </div>
        <TeachingUploadFallback
          accept="audio"
          maxSizeMb={50}
          label={t('teaching.korean.uploadLabel')}
          hint="mp3, wav, m4a"
          onFile={(f) => {
            setAudioFile(f);
            setPhase('review');
          }}
        />
        {error ? <p className="text-rose-400 text-sm mb-4">{error}</p> : null}
        <button
          type="button"
          disabled={!referenceText.trim()}
          onClick={() => setPhase('practice')}
          className="w-full py-4 rounded-xl font-bold disabled:opacity-40 mt-4"
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
        <p className="text-xs text-white/50 mb-3 line-clamp-2">{referenceText}</p>
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
        <TeachingReviewPanel
          file={audioFile}
          mode="vocal"
          isLoading={isGenerating}
          onRetake={() => {
            setAudioFile(null);
            setPhase('practice');
          }}
          onAnalyze={handleStart}
        />
      </div>
    );
  }

  if (phase === 'analyzing' || phase === 'generating') {
    return (
      <div className="min-h-full bg-[#0a0a0f]">
        <AnalysisLoadingScreen
          steps={KO_STEPS}
          currentStep={loadingStep}
          title="한국어 발음 분석"
          subtitle={isGenerating ? '교정 발음을 생성하고 있습니다...' : '발음을 분석하고 있습니다...'}
        />
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="min-h-full bg-[#0a0a0f] text-white p-6">
        <h2 className="text-2xl font-bold mb-4">발음 결과</h2>
        <p className="text-4xl font-black text-[#FF1F8E] mb-2">{analysis?.accuracy ?? 0}%</p>
        <p className="text-sm text-white/60 mb-4">인식: {analysis?.transcript}</p>
        <SyllableAccuracyBar syllables={analysis?.syllables} />
        <button type="button" onClick={() => { reset(); setPhase('setup'); }} className="w-full py-3 rounded-xl bg-[#FF1F8E] mt-6">
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
        <h2 className="text-lg font-bold text-white">한국어 티칭</h2>
        <button type="button" onClick={() => setPhase('result')} className="text-sm text-[#FF1F8E]">
          결과
        </button>
      </div>
      <SplitScreenPlayer
        leftLabel="내 발음"
        rightLabel="AI 교정 발음"
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onSeek={(t) => {
          setCurrentTime(t);
          if (myAudioRef.current) myAudioRef.current.currentTime = t;
          if (correctedRef.current) correctedRef.current.currentTime = t;
        }}
        onPlayPause={() => syncPlay(!isPlaying)}
        extraControls={
          <>
            {[
              { id: 'both', label: '동시 재생' },
              { id: 'mine', label: '내 것만' },
              { id: 'corrected', label: 'AI 교정만' },
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
          <div className="flex flex-col justify-center h-full p-4">
            <audio
              ref={myAudioRef}
              src={myAudioUrl}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            />
            <PronunciationWave
              myWave={analysis?.waveform}
              correctedWave={[]}
              currentTime={currentTime}
              duration={duration}
              labelMine="내 발음 파형"
              labelCorrected=""
            />
          </div>
        }
        rightContent={
          <div className="flex flex-col justify-center h-full p-4">
            {correctedAudioUrl ? <audio ref={correctedRef} src={correctedAudioUrl} /> : <p className="text-center text-white/40 text-sm">교정 음성 미생성</p>}
            <PronunciationWave
              myWave={[]}
              correctedWave={analysis?.correctedWaveform || analysis?.waveform}
              currentTime={currentTime}
              duration={duration}
              labelMine=""
              labelCorrected="AI 교정 파형"
            />
          </div>
        }
        footer={
          <div className="px-4 py-3 space-y-4 border-t border-white/10">
            <div>
              <p className="text-xs text-white/50 mb-2">음절별 정확도</p>
              <SyllableAccuracyBar syllables={analysis?.syllables} />
            </div>
            <IntonationCompareGraph
              standardSeries={analysis?.standardIntonation}
              mySeries={analysis?.myIntonation}
              currentTime={currentTime}
              duration={duration}
            />
          </div>
        }
      />
      <KoreanPersonaCoach
        instruction={coachMessage.instruction}
        highlightSyllable={coachMessage.highlightSyllable}
        personaName={t('teaching.korean.coachName')}
        personaAvatar="🇰🇷"
        autoSpeak
      />
    </div>
  );
}
