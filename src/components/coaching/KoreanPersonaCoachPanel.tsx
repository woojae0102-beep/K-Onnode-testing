// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import SongPersonaCard from './SongPersonaCard';
import KoreanPersonaFeedback from './KoreanPersonaFeedback';
import PersonaCoachAvatar from './PersonaCoachAvatar';
import PlaybackSpeedControl from '../common/PlaybackSpeedControl';

const STEPS = [
  { id: 1, key: 'coaching.korean.steps.lyrics' },
  { id: 2, key: 'coaching.korean.steps.persona' },
  { id: 3, key: 'coaching.korean.steps.speak' },
];

export default function KoreanPersonaCoachPanel({
  songTitle,
  songArtist,
  onSongTitleChange,
  onSongArtistChange,
  onLoadLyrics,
  onAnalyzeSong,
  onReset,
  isLyricsLoading,
  isSongAnalyzing,
  songAnalysis,
  referenceText,
  onReferenceTextChange,
  feedback,
  loading,
  phaseLabel,
  currentPhase,
  playbackSpeed,
  onPlaybackSpeedChange,
  autoPlay,
  recording,
}) {
  const { t } = useTranslation();
  const activeStep = !referenceText?.trim() ? 1 : !songAnalysis ? 2 : recording ? 3 : 2;

  return (
    <section className="rounded-2xl border border-[#1DB971]/25 bg-white overflow-hidden shadow-sm mb-4">
      <div className="bg-gradient-to-r from-[#1DB971]/10 to-transparent px-4 py-3 border-b border-[#1DB971]/15">
        <h2 className="text-sm font-bold text-[#111111]">{t('coaching.korean.panelTitle')}</h2>
        <p className="text-xs text-[#666666] mt-0.5">{t('coaching.korean.panelSubtitle')}</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((step) => {
            const done = activeStep > step.id;
            const current = activeStep === step.id;
            return (
              <div
                key={step.id}
                className={`rounded-xl px-2 py-2 text-center border ${
                  current
                    ? 'border-[#1DB971] bg-[#F0FFF7]'
                    : done
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-[#E5E5E5] bg-[#FAFAFA]'
                }`}
              >
                <p className={`text-[10px] font-bold ${current ? 'text-[#1DB971]' : done ? 'text-emerald-600' : 'text-[#AAAAAA]'}`}>
                  {done ? '✓' : step.id}
                </p>
                <p className="text-[10px] text-[#555555] mt-0.5 leading-tight">{t(step.key)}</p>
              </div>
            );
          })}
        </div>

        <PersonaCoachAvatar
          mode="vocal"
          personaName={songAnalysis?.personaName || t('coaching.korean.defaultPersona')}
          coachPersona="hybe_soul"
          active={Boolean(feedback && (feedback.accuracy || 0) >= 60)}
          subtitle={songAnalysis?.vocalAttitude || t('coaching.korean.empty')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={songTitle}
            onChange={(e) => onSongTitleChange(e.target.value)}
            placeholder={t('coaching.korean.songTitle')}
            className="rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm min-h-[44px]"
          />
          <input
            value={songArtist}
            onChange={(e) => onSongArtistChange(e.target.value)}
            placeholder={t('coaching.korean.songArtist')}
            className="rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLoadLyrics}
            disabled={isLyricsLoading || !songTitle.trim()}
            className="rounded-xl border border-[#1DB971] text-[#1DB971] px-4 py-2.5 text-sm font-semibold disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            {isLyricsLoading ? t('coaching.korean.loadingLyrics') : t('coaching.korean.loadLyrics')}
          </button>
          <button
            type="button"
            onClick={onAnalyzeSong}
            disabled={isSongAnalyzing || !songTitle.trim()}
            className="rounded-xl bg-[#1DB971] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            {isSongAnalyzing ? t('coaching.song.analyzing') : t('coaching.korean.analyzePersona')}
          </button>
          {songAnalysis || referenceText ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-xs text-[#666666] min-h-[44px] touch-manipulation"
            >
              {t('coaching.song.reset')}
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#111111]">{t('coaching.korean.practiceText')}</p>
          <textarea
            value={referenceText}
            onChange={(e) => onReferenceTextChange(e.target.value)}
            rows={4}
            placeholder={t('coaching.korean.practicePlaceholder')}
            className="w-full rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm resize-y min-h-[100px]"
          />
        </div>

        {songAnalysis ? <SongPersonaCard analysis={songAnalysis} mode="vocal" /> : null}

        <PlaybackSpeedControl
          value={playbackSpeed}
          onChange={onPlaybackSpeedChange}
          variant="light"
          label={t('coaching.korean.coachSpeed')}
        />

        <KoreanPersonaFeedback
          feedback={feedback}
          personaName={songAnalysis?.personaName}
          loading={loading}
          phaseLabel={phaseLabel}
          autoPlay={autoPlay}
          playbackSpeed={playbackSpeed}
        />

        {referenceText?.trim() && !recording ? (
          <p className="text-xs text-center text-[#1DB971] font-medium">{t('coaching.korean.recordHint')}</p>
        ) : null}
      </div>
    </section>
  );
}
