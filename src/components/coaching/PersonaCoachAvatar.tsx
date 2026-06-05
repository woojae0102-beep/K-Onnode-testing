// @ts-nocheck
import React from 'react';

const COACH_EMOJI = {
  jyp_jung: '💃',
  jyp_park: '🎤',
  yg_lee: '🔥',
  yg_vocal: '🎵',
  sm_choi: '✨',
  hybe_kim: '🌟',
  hybe_soul: '💫',
};

export default function PersonaCoachAvatar({
  mode = 'dance',
  personaName,
  coachPersona,
  active = false,
  subtitle,
}) {
  const emoji = COACH_EMOJI[coachPersona] || (mode === 'dance' ? '💃' : '🎤');
  const accent = mode === 'dance' ? '#FF1F8E' : '#4A6BFF';

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3"
      style={{
        borderColor: `${accent}33`,
        background: `linear-gradient(135deg, ${accent}12, transparent)`,
      }}
    >
      <div
        className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl"
        style={{ background: `${accent}22` }}
      >
        {active ? (
          <span
            className="absolute inset-0 rounded-2xl animate-ping opacity-30"
            style={{ background: accent }}
          />
        ) : null}
        <span className="relative">{emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
          {mode === 'dance' ? 'AI 댄스 페르소나' : 'AI 보컬 티칭'}
        </p>
        <p className="truncate text-sm font-bold text-[#111111]">
          {personaName || '곡을 분석하면 페르소나가 생성됩니다'}
        </p>
        {subtitle ? <p className="mt-0.5 text-xs text-[#666666]">{subtitle}</p> : null}
      </div>
    </div>
  );
}
