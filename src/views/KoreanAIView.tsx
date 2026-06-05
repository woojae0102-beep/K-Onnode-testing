// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CorrectionMode from '../components/korean/CorrectionMode';
import FollowAlongMode from '../components/korean/FollowAlongMode';
import LyricsVocabMode from '../components/korean/LyricsVocabMode';
import PronunciationMode from '../components/korean/PronunciationMode';
import KoreanPersonaCoachPanel from '../components/coaching/KoreanPersonaCoachPanel';
import { useSpotifyAnalysis } from '../hooks/useSpotifyAnalysis';
import { useKoreanPersonaCoach } from '../hooks/useKoreanPersonaCoach';
import { useKoreanLyrics } from '../hooks/useKoreanLyrics';
import { useSettingsStore } from '../store/settingsSlice';

const modes = ['pronunciation', 'follow', 'correction', 'lyricsVocab'];

const DEFAULT_TEXT =
  '안녕하세요, 오늘도 열심히 연습해 볼게요. 발음을 또렷하게 하면서 천천히 읽어 주세요.';

export default function KoreanAIView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('pronunciation');
  const [referenceText, setReferenceText] = useState(DEFAULT_TEXT);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [recording, setRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveMetrics, setLiveMetrics] = useState({});
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [koreanPhase, setKoreanPhase] = useState('idle');
  const lastCoachAtRef = useRef(0);

  const language = useSettingsStore((s) => s.settings?.coachLanguage || 'ko');
  const coachTone = useSettingsStore((s) => s.settings?.coachTone || 'friendly');

  const { songAnalysis, isAnalyzing: isSongAnalyzing, analyzeSong, resetSongAnalysis } = useSpotifyAnalysis();
  const { fetchLyrics, isLoading: isLyricsLoading } = useKoreanLyrics();
  const {
    latest: koreanFeedback,
    isLoading: isCoachLoading,
    requestCoaching,
    resetCoach,
  } = useKoreanPersonaCoach();

  const practiceLines = useMemo(
    () =>
      referenceText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean),
    [referenceText]
  );

  const handleLoadLyrics = async () => {
    const lyrics = await fetchLyrics(songTitle, songArtist);
    if (lyrics) setReferenceText(lyrics);
  };

  const handleAnalyzeSong = async () => {
    const q = [songTitle, songArtist].filter(Boolean).join(' ');
    if (!q) return;
    resetCoach();
    const analysis = await analyzeSong(q, { language });
    if (!analysis) return;
    setKoreanPhase('start');
    await requestCoaching({
      referenceText,
      transcript: '',
      metrics: {},
      songAnalysis: analysis,
      sessionPhase: 'start',
      language,
      coachTone,
    });
  };

  const handleReset = () => {
    resetSongAnalysis();
    resetCoach();
    setSongTitle('');
    setSongArtist('');
    setReferenceText(DEFAULT_TEXT);
    setKoreanPhase('idle');
    setLiveTranscript('');
    setLiveMetrics({});
  };

  const handleSpeechUpdate = ({ transcript, metrics, isRecording }) => {
    setRecording(isRecording);
    setLiveTranscript(transcript || '');
    setLiveMetrics(metrics || {});
  };

  useEffect(() => {
    if (!recording || !referenceText.trim()) return;
    if (!liveTranscript.trim() && !liveMetrics.overall) return;
    const now = Date.now();
    if (now - lastCoachAtRef.current < 8000) return;
    lastCoachAtRef.current = now;
    setKoreanPhase('realtime');
    requestCoaching({
      referenceText,
      transcript: liveTranscript,
      metrics: liveMetrics,
      songAnalysis,
      sessionPhase: 'realtime',
      language,
      coachTone,
    });
  }, [recording, liveTranscript, liveMetrics, referenceText, songAnalysis, language, coachTone, requestCoaching]);

  useEffect(() => {
    if (recording || koreanPhase !== 'realtime') return;
    if (!liveTranscript.trim()) return;
    setKoreanPhase('end');
    requestCoaching({
      referenceText,
      transcript: liveTranscript,
      metrics: liveMetrics,
      songAnalysis,
      sessionPhase: 'end',
      language,
      coachTone,
    });
  }, [recording]);

  const phaseLabel = useMemo(() => {
    if (!koreanPhase || koreanPhase === 'idle') return undefined;
    return t(`coaching.phaseLabels.${koreanPhase}`, { defaultValue: '' });
  }, [koreanPhase, t]);

  const modeProps = {
    referenceText,
    practiceLines,
    onSpeechUpdate: handleSpeechUpdate,
    koreanFeedback,
  };

  return (
    <div className="min-h-full bg-[#F5F5F7] p-4 md:p-6">
      <KoreanPersonaCoachPanel
        songTitle={songTitle}
        songArtist={songArtist}
        onSongTitleChange={setSongTitle}
        onSongArtistChange={setSongArtist}
        onLoadLyrics={handleLoadLyrics}
        onAnalyzeSong={handleAnalyzeSong}
        onReset={handleReset}
        isLyricsLoading={isLyricsLoading}
        isSongAnalyzing={isSongAnalyzing}
        songAnalysis={songAnalysis}
        referenceText={referenceText}
        onReferenceTextChange={setReferenceText}
        feedback={koreanFeedback}
        loading={isCoachLoading}
        phaseLabel={phaseLabel}
        currentPhase={koreanPhase}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={setPlaybackSpeed}
        autoPlay={koreanPhase !== 'realtime' || !recording}
        recording={recording}
      />

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        <aside className="rounded-xl border border-[#E5E5E5] bg-white p-3 space-y-2">
          {modes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm min-h-[44px] touch-manipulation ${
                mode === item
                  ? 'bg-[#FF1F8E18] text-[#FF1F8E] border border-[#FF1F8E]'
                  : 'border border-[#E5E5E5] text-[#888888]'
              }`}
            >
              {t(`korean.modes.${item}`)}
            </button>
          ))}
        </aside>
        <section className="overflow-visible md:overflow-y-auto">
          {mode === 'pronunciation' ? <PronunciationMode {...modeProps} /> : null}
          {mode === 'follow' ? <FollowAlongMode {...modeProps} /> : null}
          {mode === 'correction' ? <CorrectionMode {...modeProps} /> : null}
          {mode === 'lyricsVocab' ? <LyricsVocabMode {...modeProps} /> : null}
        </section>
      </div>
    </div>
  );
}
