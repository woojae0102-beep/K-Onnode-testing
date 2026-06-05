// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PersonaCoachAvatar from './PersonaCoachAvatar';
import { useVocalVoiceClone } from '../../hooks/useVocalVoiceClone';
import { speakCoverLines } from '../../utils/voiceCoverTts';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

export default function VocalVoiceTeachingPanel({
  songAnalysis,
  vocalCharacteristics,
  vocalCoachPersona,
  language = 'ko',
  playbackSpeed = 1,
  lyrics = [],
  liveRecording = false,
  pitchHistory = [],
  pitchSampleCount = 0,
  pitchAccuracy = 0,
}) {
  const { t } = useTranslation();
  const {
    cloneProfile,
    cover,
    isCloning,
    isGeneratingCover,
    error,
    cloneVoice,
    generateCover,
    reset,
  } = useVocalVoiceClone();
  const { isRecording: isFileRecording, startRecording, stopRecording, error: recError } = useAudioRecorder();
  const [myAudioUrl, setMyAudioUrl] = useState('');
  const [isPlayingCover, setIsPlayingCover] = useState(false);
  const [activeLine, setActiveLine] = useState(-1);
  const stopTtsRef = useRef(null);

  useEffect(() => () => stopTtsRef.current?.(), []);

  const hasVoiceSample =
    Boolean(vocalCharacteristics) ||
    Boolean(myAudioUrl) ||
    pitchSampleCount >= 20 ||
    (Array.isArray(pitchHistory) && pitchHistory.length >= 20);

  const handleCloneAndCover = async () => {
    if (!songAnalysis) return;
    const profile =
      cloneProfile ||
      (await cloneVoice({
        vocalCharacteristics,
        songAnalysis,
        pitchHistory,
      }));
    if (!profile) return;
    await generateCover({
      songAnalysis,
      cloneProfile: profile,
      lyrics,
    });
  };

  const handlePlayCover = () => {
    if (!cover?.coverLines?.length) return;
    stopTtsRef.current?.();
    setIsPlayingCover(true);
    setActiveLine(0);
    stopTtsRef.current = speakCoverLines({
      lines: cover.coverLines,
      voiceProfile: cloneProfile || vocalCharacteristics,
      language,
      playbackSpeed,
      onLineStart: (idx) => setActiveLine(idx),
      onComplete: () => {
        setIsPlayingCover(false);
        setActiveLine(-1);
      },
    });
  };

  const handleStopCover = () => {
    stopTtsRef.current?.();
    setIsPlayingCover(false);
    setActiveLine(-1);
  };

  const handleRecordToggle = async () => {
    if (isFileRecording) {
      try {
        const file = await stopRecording();
        const url = URL.createObjectURL(file);
        if (myAudioUrl) URL.revokeObjectURL(myAudioUrl);
        setMyAudioUrl(url);
      } catch {
        /* ignore */
      }
      return;
    }
    await startRecording();
  };

  if (!songAnalysis) {
    return (
      <section className="rounded-2xl border border-dashed border-[#4A6BFF]/30 bg-[#F8FAFF] p-4 text-center">
        <p className="text-2xl mb-2">🎵</p>
        <p className="text-sm font-semibold text-[#111111]">{t('coaching.vocal.cover.waitSong')}</p>
        <p className="text-xs text-[#888888] mt-1">{t('coaching.vocal.cover.waitSongDesc')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#4A6BFF]/25 bg-white overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#4A6BFF]/10 to-transparent px-4 py-3 border-b border-[#4A6BFF]/15">
        <h2 className="text-sm font-bold text-[#111111]">{t('coaching.vocal.cover.panelTitle')}</h2>
        <p className="text-xs text-[#666666] mt-0.5">{t('coaching.vocal.cover.panelSubtitle')}</p>
      </div>

      <div className="p-4 space-y-4">
        <PersonaCoachAvatar
          mode="vocal"
          personaName={songAnalysis.personaName}
          coachPersona={vocalCoachPersona}
          active={Boolean(cloneProfile || cover)}
          subtitle={
            vocalCharacteristics
              ? `${vocalCharacteristics.type} · ${vocalCharacteristics.range}`
              : t('coaching.vocal.characteristicsLoading')
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#111111]">{t('coaching.vocal.cover.myVoice')}</p>
            {myAudioUrl ? (
              <audio controls src={myAudioUrl} className="w-full" />
            ) : (
              <p className="text-[11px] text-[#888888]">
                {liveRecording
                  ? t('coaching.vocal.cover.liveCapturing')
                  : t('coaching.vocal.cover.recordHint')}
              </p>
            )}
            <button
              type="button"
              onClick={handleRecordToggle}
              className={`w-full min-h-[44px] rounded-xl text-sm font-semibold touch-manipulation ${
                isFileRecording ? 'bg-red-500 text-white' : 'border border-[#E5E5E5] bg-white text-[#444444]'
              }`}
            >
              {isFileRecording ? t('coaching.vocal.cover.stopRecord') : t('coaching.vocal.cover.startRecord')}
            </button>
            {liveRecording ? (
              <p className="text-[10px] text-emerald-600">{t('coaching.vocal.cover.liveOn')}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-[#4A6BFF]/20 bg-[#F0F4FF] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#111111]">{t('coaching.vocal.cover.aiCover')}</p>
            {cover?.teachingIntro ? (
              <p className="text-[11px] text-[#444444] leading-relaxed">{cover.teachingIntro}</p>
            ) : (
              <p className="text-[11px] text-[#888888]">{t('coaching.vocal.cover.coverHint')}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCloneAndCover}
                disabled={!hasVoiceSample || isCloning || isGeneratingCover}
                className="flex-1 min-h-[44px] rounded-xl bg-[#4A6BFF] text-white text-sm font-semibold disabled:opacity-50 touch-manipulation"
              >
                {isCloning || isGeneratingCover
                  ? t('coaching.vocal.cover.generating')
                  : t('coaching.vocal.cover.generate')}
              </button>
              {cover ? (
                <button
                  type="button"
                  onClick={isPlayingCover ? handleStopCover : handlePlayCover}
                  className="min-h-[44px] px-4 rounded-xl border border-[#4A6BFF] text-[#4A6BFF] text-sm font-semibold touch-manipulation"
                >
                  {isPlayingCover ? '⏹' : '▶'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {cover?.coverLines?.length ? (
          <div className="rounded-xl border border-[#E5E5E5] p-3 space-y-1.5 max-h-40 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888888]">
              {t('coaching.vocal.cover.lyricsGuide')}
            </p>
            {cover.coverLines.map((line, idx) => (
              <p
                key={`${idx}-${line.text?.slice(0, 8)}`}
                className={`text-xs leading-relaxed ${
                  activeLine === idx ? 'text-[#4A6BFF] font-semibold' : 'text-[#444444]'
                }`}
              >
                {line.text}
                {line.tip ? <span className="block text-[10px] text-[#888888] mt-0.5">💡 {line.tip}</span> : null}
              </p>
            ))}
          </div>
        ) : null}

        {cover?.comparisonTip ? (
          <p className="text-xs text-[#666666] bg-[#FAFAFA] rounded-lg px-3 py-2">{cover.comparisonTip}</p>
        ) : null}

        {pitchAccuracy > 0 ? (
          <p className="text-[11px] text-center text-[#888888]">
            {t('coaching.vocal.cover.pitchStatus', { value: Math.round(pitchAccuracy) })}
          </p>
        ) : null}

        {(error || recError) ? (
          <p className="text-xs text-rose-500">{error || recError}</p>
        ) : null}

        {cloneProfile || cover ? (
          <button
            type="button"
            onClick={() => {
              handleStopCover();
              reset();
              if (myAudioUrl) URL.revokeObjectURL(myAudioUrl);
              setMyAudioUrl('');
            }}
            className="text-xs text-[#888888] underline"
          >
            {t('coaching.vocal.cover.reset')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
