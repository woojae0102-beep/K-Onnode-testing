// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import SongPersonaCard from './SongPersonaCard';
import DancePersonaFeedback from './DancePersonaFeedback';
import PersonaCoachAvatar from './PersonaCoachAvatar';

const STEPS = [
  { id: 1, key: 'coaching.dance.steps.search' },
  { id: 2, key: 'coaching.dance.steps.persona' },
  { id: 3, key: 'coaching.dance.steps.practice' },
];

export default function DancePersonaCoachPanel({
  songQuery,
  onSongQueryChange,
  onAnalyze,
  onReset,
  isSongAnalyzing,
  songAnalysis,
  feedback,
  coachPersona,
  language,
  loading,
  phaseLabel,
  currentPhase,
  playbackSpeed,
  autoPlay,
  cameraOn,
}) {
  const { t } = useTranslation();
  const activeStep = !songAnalysis ? 1 : currentPhase === 'idle' || currentPhase === 'start' ? 2 : 3;

  return (
    <section className="rounded-2xl border border-[#FF1F8E]/25 bg-white overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#FF1F8E]/10 to-transparent px-4 py-3 border-b border-[#FF1F8E]/15">
        <h2 className="text-sm font-bold text-[#111111]">{t('coaching.dance.panelTitle')}</h2>
        <p className="text-xs text-[#666666] mt-0.5">{t('coaching.dance.panelSubtitle')}</p>
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
                    ? 'border-[#FF1F8E] bg-[#FFF0F7]'
                    : done
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-[#E5E5E5] bg-[#FAFAFA]'
                }`}
              >
                <p className={`text-[10px] font-bold ${current ? 'text-[#FF1F8E]' : done ? 'text-emerald-600' : 'text-[#AAAAAA]'}`}>
                  {done ? '✓' : step.id}
                </p>
                <p className="text-[10px] text-[#555555] mt-0.5 leading-tight">{t(step.key)}</p>
              </div>
            );
          })}
        </div>

        <PersonaCoachAvatar
          mode="dance"
          personaName={songAnalysis?.personaName}
          coachPersona={coachPersona}
          active={Boolean(songAnalysis && feedback?.personaActivated)}
          subtitle={
            songAnalysis
              ? songAnalysis.danceAttitude
              : t('coaching.dance.empty')
          }
        />

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#111111]">{t('coaching.song.title')}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={songQuery}
              onChange={(e) => onSongQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAnalyze?.();
              }}
              placeholder={t('coaching.song.placeholder')}
              className="flex-1 rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-sm min-h-[44px]"
            />
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isSongAnalyzing || !songQuery?.trim()}
              className="rounded-xl bg-[#FF1F8E] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 min-h-[44px] touch-manipulation shrink-0"
            >
              {isSongAnalyzing ? t('coaching.song.analyzing') : t('coaching.song.analyze')}
            </button>
            {songAnalysis ? (
              <button
                type="button"
                onClick={onReset}
                className="rounded-xl border border-[#E5E5E5] px-3 py-2.5 text-xs text-[#666666] min-h-[44px] touch-manipulation shrink-0"
              >
                {t('coaching.song.reset')}
              </button>
            ) : null}
          </div>
        </div>

        {songAnalysis ? (
          <SongPersonaCard analysis={songAnalysis} mode="dance" />
        ) : (
          <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-4 text-center">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm font-semibold text-[#111111]">{t('coaching.dance.waitingTitle')}</p>
            <p className="text-xs text-[#888888] mt-1">{t('coaching.dance.waitingDesc')}</p>
          </div>
        )}

        <DancePersonaFeedback
          feedback={feedback}
          coachPersona={coachPersona}
          language={language}
          personaName={songAnalysis?.personaName}
          loading={loading}
          phaseLabel={phaseLabel}
          autoPlay={autoPlay}
          playbackSpeed={playbackSpeed}
        />

        {songAnalysis && !cameraOn ? (
          <p className="text-xs text-center text-[#FF1F8E] font-medium">
            {t('coaching.dance.cameraHint')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
