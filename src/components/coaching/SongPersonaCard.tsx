// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SongAnalysis } from '../../hooks/useSpotifyAnalysis';

interface Props {
  analysis: SongAnalysis;
  mode?: 'dance' | 'vocal';
}

export default function SongPersonaCard({ analysis, mode = 'dance' }: Props) {
  const { t } = useTranslation();
  const energyColor =
    analysis.energy > 0.7 ? '#E24B4A' : analysis.energy > 0.4 ? '#FF1F8E' : '#4A6BFF';

  const attitude = mode === 'vocal' ? analysis.vocalAttitude : analysis.danceAttitude;
  const attitudeLabel =
    mode === 'vocal' ? t('coaching.persona.vocalAttitude') : t('coaching.persona.danceAttitude');
  const personaLabel =
    mode === 'vocal'
      ? t('coaching.persona.vocalPersonaLabel')
      : t('coaching.persona.dancePersonaLabel');

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-[#0a0a0a] p-4 text-white"
      style={{ borderColor: `${energyColor}55` }}
    >
      {analysis.albumArt ? (
        <img
          src={analysis.albumArt}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.1, filter: 'blur(22px)' }}
        />
      ) : null}

      <div className="relative z-10 space-y-3">
        <div className="flex items-center gap-3">
          {analysis.albumArt ? (
            <img
              src={analysis.albumArt}
              alt={analysis.trackName}
              className="h-14 w-14 rounded-lg object-cover"
            />
          ) : (
            <div
              className="h-14 w-14 rounded-lg"
              style={{ background: `${energyColor}33` }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{analysis.trackName}</p>
            <p className="truncate text-xs text-slate-300">{analysis.artistName || '—'}</p>
            <p className="mt-1 text-[10px]" style={{ color: energyColor }}>
              {analysis.bpm ? `${analysis.bpm} BPM` : '—'} · {analysis.genre}
            </p>
          </div>
        </div>

        <div
          className="rounded-xl border px-3 py-2"
          style={{
            background: `${energyColor}1f`,
            borderColor: `${energyColor}55`,
          }}
        >
          <p className="text-[10px] uppercase tracking-wider" style={{ color: energyColor }}>
            {personaLabel}
          </p>
          <p className="mt-0.5 text-base font-black">{analysis.personaName}</p>
          <p className="mt-1 text-xs text-slate-200">{analysis.personaDescription}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(analysis.emotionKeywords || []).map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200"
            >
              #{keyword}
            </span>
          ))}
          {(analysis.movementKeywords || []).slice(0, 2).map((keyword) => (
            <span
              key={`m-${keyword}`}
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{
                background: `${energyColor}33`,
                color: '#fff',
              }}
            >
              {keyword}
            </span>
          ))}
        </div>

        <div className="border-t border-white/10 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            {attitudeLabel}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">{attitude}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <Metric label={t('coaching.persona.energy')} value={Math.round(analysis.energy * 100)} />
          <Metric label={t('coaching.persona.dance')} value={Math.round(analysis.danceability * 100)} />
          <Metric label={t('coaching.persona.valence')} value={Math.round(analysis.valence * 100)} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}
