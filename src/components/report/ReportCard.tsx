// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TRACK_COLORS, TRACK_ICONS, formatReportDateShort } from '../../mocks/reportMocks';

const TRACK_LABEL_KEY = {
  dance: 'report.trackDance',
  vocal: 'report.trackVocal',
  korean: 'report.trackKorean',
};

export default function ReportCard({ report, onOpen }) {
  const { t } = useTranslation();
  const accent = TRACK_COLORS[report.track] || '#FF1F8E';
  const trackLabel = t(TRACK_LABEL_KEY[report.track] || 'report.trackDance');
  const fields = Object.keys(report.detailScores);
  const top3 = fields.slice(0, 3);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(report)}
      style={{
        display: 'block',
        width: 'calc(100% - 32px)',
        margin: '0 16px 10px',
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: 16,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{TRACK_ICONS[report.track]}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111111' }}>{trackLabel} {t('report.trackReportSuffix')}</span>
        </div>
        <span style={{ fontSize: 11, color: '#888888' }}>{formatReportDateShort(report.date)}</span>
      </div>

      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#111111' }}>{report.contentName}</p>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <ScoreBlock label={t('report.overallScore')} value={report.overallScore} accent={accent} t={t} />
        {top3.map((key) => {
          const fieldDef = (report.detailScores && key in report.detailScores) ? key : null;
          if (!fieldDef) return null;
          return (
            <ScoreBlock
              key={key}
              label={t(`report.scoreLabel.${key}`, key)}
              value={report.detailScores[key]}
              accent={accent}
              dim
              t={t}
            />
          );
        }).slice(0, 2)}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 12, color: '#888888' }}>
        {t('report.aiOneLine')}: <span style={{ color: '#555555' }}>"{report.aiComment}"</span>
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <span style={{ fontSize: 12, color: accent, fontWeight: 500 }}>{t('report.viewDetail')}</span>
      </div>
    </button>
  );
}

function ScoreBlock({ label, value, accent, dim = false, t }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 10, color: '#888888' }}>{label}</p>
      <p
        style={{
          margin: '2px 0 0',
          fontSize: dim ? 14 : 18,
          fontWeight: dim ? 400 : 600,
          color: dim ? '#111111' : accent,
        }}
      >
        {t ? t('report.score', { value }) : value}
      </p>
    </div>
  );
}
