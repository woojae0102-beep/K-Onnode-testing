// @ts-nocheck
// STARSHIP 결과 단계 래퍼 — useStarshipAudition 훅으로 3명 병렬 평가 → 회의 → 최종 결과
// agency.id === 'starship'일 때만 AgencyAuditionView가 이 컴포넌트로 분기시킵니다.

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStarshipAudition } from '../../hooks/useStarshipAudition';
import StarshipResultScreen from './starship/StarshipResultScreen';
import StarshipDebateScreen from './starship/StarshipDebateScreen';

export default function StarshipAuditionResult({ rounds, ticketNumber, onRetry, onSelectAgency }) {
  const { i18n } = useTranslation();
  const language = (i18n?.language || 'ko').slice(0, 2);
  const audition = useStarshipAudition({ language });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    audition.getFinalEvaluations({
      performanceData: rounds || {},
      ticketNumber,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (audition.loading || !audition.finalResult) {
    return (
      <div
        style={{
          minHeight: '100%',
          background: '#0A0814',
          color: '#FFFFFF',
          padding: 'clamp(24px, 4vw, 40px)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 520 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              color: '#A29BFE',
            }}
          >
            STARSHIP ENTERTAINMENT
          </p>
          <h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>
            3인 심사위원 회의 진행 중
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            한승훈(스타성·결정권) · 박나리(카메라·퍼포먼스) · 최지수(장기 성장)이 평가 중입니다.
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 720 }}>
          <StarshipDebateScreen debate={audition.debateResult} loading={true} />
        </div>

        {audition.error && (
          <p style={{ margin: 0, fontSize: 12, color: '#E84393' }}>⚠️ {audition.error}</p>
        )}
      </div>
    );
  }

  return (
    <StarshipResultScreen
      result={audition.finalResult}
      onRetry={onRetry}
      onAskCoach={onSelectAgency}
    />
  );
}
