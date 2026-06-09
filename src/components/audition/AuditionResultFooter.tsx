// @ts-nocheck
import React from 'react';
import PracticeComparisonPanel from '../common/PracticeComparisonPanel';
import PracticeResultActions from '../common/PracticeResultActions';

export default function AuditionResultFooter({
  comparison,
  accent = '#6C5CE7',
  onRetry,
  onHome,
  onAskCoach,
  onSaveCertificate,
  showCertificate = false,
  askCoachLabel = '다른 기획사 오디션 보기',
}) {
  return (
    <>
      <PracticeComparisonPanel comparison={comparison} accent={accent} dark />
      {showCertificate && onSaveCertificate ? (
        <button
          type="button"
          onClick={onSaveCertificate}
          style={{
            marginBottom: 8,
            padding: '12px 20px',
            background: accent,
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          합격증 저장
        </button>
      ) : null}
      <PracticeResultActions onRetry={onRetry} onHome={onHome} retryLabel="다시 연습하기" accent={accent} dark />
      {onAskCoach ? (
        <button
          type="button"
          onClick={onAskCoach}
          style={{
            marginTop: 10,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {askCoachLabel}
        </button>
      ) : null}
    </>
  );
}
