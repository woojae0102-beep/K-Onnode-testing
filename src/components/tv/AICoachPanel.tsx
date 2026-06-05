// @ts-nocheck
import React from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { useAgencyPersona } from '../../hooks/useAgencyPersona';

export function AICoachPanel({
  agency,
  mode,
  agencyColor,
}: {
  agency: Agency;
  mode: TrainingMode;
  agencyColor: string;
}) {
  const persona = useAgencyPersona(agency);

  return (
    <div className="tv-simple-panel tv-coach-panel">
      <div className="tv-panel-label">{agency.toUpperCase()} AI 코치</div>
      <div className="tv-coach-body">
        <div
          className="tv-coach-avatar"
          style={{
            borderColor: `${agencyColor}55`,
            boxShadow: `0 0 32px ${agencyColor}25`,
          }}
        >
          <span style={{ fontSize: 56 }}>{persona.coachAvatar}</span>
        </div>
        <div className="tv-coach-name">{persona.coachName}</div>
        <div className="tv-coach-tagline">{persona.coachTagline}</div>
        <p className="tv-coach-hint">
          {mode === 'dance'
            ? '코치 동작을 보며 따라 연습하세요.'
            : '코치 가이드에 맞춰 발성·음정을 연습하세요.'}
        </p>
      </div>
    </div>
  );
}

export default AICoachPanel;
