// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import JudgeEvaluationCard from './JudgeEvaluationCard';

export default function JudgePanel({ agency, onContinue, onBack }) {
  const { t } = useTranslation();
  if (!agency) return null;
  return (
    <div
      style={{
        minHeight: '100%',
        background: '#0A0A0A',
        padding: 'clamp(20px, 4vw, 32px) clamp(14px, 3vw, 24px) 80px',
        boxSizing: 'border-box',
        color: '#FFFFFF',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid #333',
            color: '#AAA',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 12,
            cursor: 'pointer',
            marginBottom: 20,
          }}
        >
          ← 뒤로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>{agency.logo}</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
            {agency.name} · {t('audition.judgePanel', { defaultValue: '심사위원 소개' })}
          </h1>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#888' }}>
          {agency.philosophy}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {agency.judges.map((j) => (
            <JudgeEvaluationCard key={j.id} judge={j} />
          ))}
        </div>

        <button
          type="button"
          onClick={onContinue}
          style={{
            width: '100%',
            background: agency.accentColor,
            color: '#0A0A0A',
            border: 'none',
            padding: '16px 24px',
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          오디션 무대로 입장 →
        </button>
      </div>
    </div>
  );
}
