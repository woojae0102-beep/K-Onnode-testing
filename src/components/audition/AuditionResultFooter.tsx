// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
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
  askCoachLabel,
}) {
  const { t } = useTranslation();
  const resolvedAskCoachLabel = askCoachLabel || t('practiceResult.otherAgencyAudition');

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
          {t('practiceResult.saveCertificate')}
        </button>
      ) : null}
      <PracticeResultActions onRetry={onRetry} onHome={onHome} accent={accent} dark />
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
          {resolvedAskCoachLabel}
        </button>
      ) : null}
    </>
  );
}
