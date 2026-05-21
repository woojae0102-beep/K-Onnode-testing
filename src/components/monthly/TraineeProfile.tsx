// @ts-nocheck
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TraineeAIProfile } from '../../data/monthlyEvalData';

interface Props {
  profile: TraineeAIProfile;
  month: string;
}

export default function TraineeProfile({ profile, month }: Props) {
  const { t } = useTranslation();

  const growthLabel = profile?.growthRate
    ? t(`monthly.profile.growth.${profile.growthRate}`, { defaultValue: '—' })
    : '—';
  const marketLabel = profile?.marketability
    ? t(`monthly.profile.marketability.${profile.marketability}`, { defaultValue: '—' })
    : '—';

  return (
    <div className="rounded-3xl p-6 bg-gradient-to-br from-[#0F0F12] via-[#1A1A24] to-[#28102A] text-white shadow-xl">
      <div className="flex items-center gap-2 text-[11px] text-white/60 uppercase tracking-wider">
        <Sparkles size={14} />
        {month} · {t('monthly.profile.tagLine')}
      </div>
      <h2 className="mt-3 text-3xl font-black leading-tight">{profile?.traineeType || '—'}</h2>
      <p className="mt-3 text-sm text-white/85 leading-relaxed">
        “{profile?.growthNarrative || t('monthly.profile.narrativeEmpty')}”
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Tag label={t('monthly.profile.tags.strength')} value={profile?.mainStrength} accent="#FF8FCB" />
        <Tag label={t('monthly.profile.tags.weakness')} value={profile?.mainWeakness} accent="#FFC95B" />
        <Tag label={t('monthly.profile.tags.growthRate')} value={growthLabel} accent="#7CE7FF" />
        <Tag
          label={t('monthly.profile.tags.stagePresence')}
          value={t('monthly.profile.stagePresenceValue', { grade: profile?.stagePresence || '—' })}
          accent="#FF6BB1"
        />
        <Tag label={t('monthly.profile.tags.position')} value={profile?.primaryPosition} accent="#A0FF8F" />
        <Tag label={t('monthly.profile.tags.marketability')} value={marketLabel} accent="#FFD16B" />
      </div>

      {profile?.specialNote ? (
        <div className="mt-5 rounded-2xl bg-white/10 border border-white/10 p-3 text-xs text-white/80">
          <span className="font-semibold text-white">{t('monthly.profile.specialNote')}</span>
          {profile.specialNote}
        </div>
      ) : null}
    </div>
  );
}

function Tag({ label, value, accent }: { label: string; value?: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/55">{label}</p>
      <p className="mt-1 text-sm font-bold" style={{ color: accent || '#FFFFFF' }}>
        {value || '—'}
      </p>
    </div>
  );
}
