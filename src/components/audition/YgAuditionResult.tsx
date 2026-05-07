// @ts-nocheck
// YG 결과 단계 래퍼 — useYgAudition 훅으로 3명 병렬 평가 → 회의 → 최종 결과
// agency.id === 'yg'일 때만 AgencyAuditionView가 이 컴포넌트로 분기시킵니다.

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useYgAudition } from '../../hooks/useYgAudition';
import YgResultScreen from './yg/YgResultScreen';
import YgDebateScreen from './yg/YgDebateScreen';

export default function YgAuditionResult({ rounds, ticketNumber, onRetry, onSelectAgency }) {
  const { i18n } = useTranslation();
  const language = (i18n?.language || 'ko').slice(0, 2);
  const audition = useYgAudition({ language });
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
          background: '#050505',
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
              color: '#FFD700',
            }}
          >
            YG ENTERTAINMENT
          </p>
          <h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>
            3인 심사위원 회의 진행 중
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            양태준(스타성·결정권) · 이나래(퍼포먼스) · Marcus Kim(글로벌)이 평가 중입니다.
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 720 }}>
          <YgDebateScreen debate={audition.debateResult} loading={true} />
        </div>

        {audition.error && (
          <p style={{ margin: 0, fontSize: 12, color: '#FF4757' }}>⚠️ {audition.error}</p>
        )}
      </div>
    );
  }

  return (
    <YgResultScreen
      result={audition.finalResult}
      onRetry={onRetry}
      onAskCoach={onSelectAgency}
    />
  );
}
