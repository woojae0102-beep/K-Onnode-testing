// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

const TRACK_LABEL_KEY = {
  dance: 'report.trackDance',
  vocal: 'report.trackVocal',
  korean: 'report.trackKorean',
};

export default function RecommendedRoutine({ items = [], onStart }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        border: '0.5px solid #FF1F8E44',
        borderRadius: 12,
        padding: 16,
        background: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111111' }}>{t('report.routineCardTitle')}</p>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#888888' }}>
        {t('report.routineCardSub')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {items.map((row) => (
          <div
            key={`day-${row.day}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 10px',
              background: '#FAFAFA',
              borderRadius: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#FF1F8E' }}>
                {t('report.dayLabel', { day: row.day })}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 500, color: '#111111' }}>
                {t(TRACK_LABEL_KEY[row.track] || 'report.trackDance')} — {row.activity}
              </p>
            </div>
            <span style={{ flexShrink: 0, fontSize: 11, color: '#888888' }}>
              {t('report.estMin', { min: row.duration })}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        style={{
          width: '100%',
          padding: 10,
          background: '#FF1F8E',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('report.startRoutine')}
      </button>
    </div>
  );
}
