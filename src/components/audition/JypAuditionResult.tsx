// @ts-nocheck
// JYP 결과 단계 래퍼 — useJypAudition 훅으로 3명 병렬 평가 → 토론 → 최종 결과
// agency.id === 'jyp'일 때만 AgencyAuditionView가 이 컴포넌트로 분기시킵니다.

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useJypAudition } from '../../hooks/useJypAudition';
import JypResultScreen from './jyp/JypResultScreen';
import JypDebateScreen from './jyp/JypDebateScreen';

export default function JypAuditionResult({ rounds, ticketNumber, onRetry, onSelectAgency }) {
  const { i18n } = useTranslation();
  const language = (i18n?.language || 'ko').slice(0, 2);
  const audition = useJypAudition({ language });
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
          background: '#0A0A0A',
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
              letterSpacing: 3,
              color: '#FF6348',
            }}
          >
            JYP 엔터테인먼트
          </p>
          <h1 style={{ margin: '8px 0 4px', fontSize: 24, fontWeight: 900 }}>
            3인 심사위원 평의 진행 중
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            박재원(보컬) · 정민지(댄스) · 이성현(인성·결정권)이 동시에 평가하고 있습니다.
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: 720 }}>
          <JypDebateScreen debate={audition.debateResult} loading={true} />
        </div>

        {audition.error && (
          <p style={{ margin: 0, fontSize: 12, color: '#FF4757' }}>
            ⚠️ {audition.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <JypResultScreen
      result={audition.finalResult}
      onRetry={onRetry}
      onAskCoach={onSelectAgency}
    />
  );
}
