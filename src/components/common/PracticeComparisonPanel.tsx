// @ts-nocheck

import React from 'react';

import { useTranslation } from 'react-i18next';



function formatDate(iso, locale) {

  if (!iso) return '';

  try {

    const d = new Date(iso);

    return d.toLocaleString(locale, {

      month: 'numeric',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit',

    });

  } catch {

    return '';

  }

}



function metricLabel(t, item) {

  if (item.text) return item.text;

  const label = t(`metrics.${item.key}`, { defaultValue: item.label || item.key });

  if (item.current == null && item.previous == null) return label;

  const delta =

    item.delta > 0 ? ` (+${item.delta})` : item.delta < 0 ? ` (${item.delta})` : '';

  return t('practiceResult.scoreChange', {

    label,

    previous: item.previous ?? '-',

    current: item.current ?? '-',

    delta,

    defaultValue: `${label}: ${item.previous ?? '-'} → ${item.current ?? '-'}${delta}`,

  });

}



function weakLabel(t, item) {
  if (item.text) return item.text;
  const label = t(`metrics.${item.key}`, { defaultValue: item.label || item.key });
  if (item.current == null) return label;
  const deltaPart =
    item.delta != null && item.delta !== 0
      ? ` (${item.delta > 0 ? '+' : ''}${item.delta})`
      : '';
  return `${label}: ${item.current}${deltaPart}`;
}



export default function PracticeComparisonPanel({ comparison, accent = '#FF1F8E', dark = false }) {

  const { t, i18n } = useTranslation();

  if (!comparison?.previousDate) return null;



  const textMuted = dark ? 'rgba(255,255,255,0.45)' : '#888';

  const textMain = dark ? 'rgba(255,255,255,0.85)' : '#333';

  const bg = dark ? 'rgba(255,255,255,0.04)' : '#fff';

  const border = dark ? 'rgba(255,255,255,0.08)' : '#E5E5E5';



  const delta = comparison.overallDelta;

  const deltaColor = delta > 0 ? '#00B894' : delta < 0 ? '#FF4757' : textMuted;

  const deltaSign = delta > 0 ? '+' : '';



  return (

    <section

      style={{

        marginBottom: 20,

        padding: 16,

        background: bg,

        border: `1px solid ${border}`,

        borderRadius: 14,

      }}

    >

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>

        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textMain }}>

          {t('practiceResult.compareTitle')}

        </h3>

        <span style={{ fontSize: 11, color: textMuted }}>

          {t('practiceResult.compareBasedOn', {

            date: formatDate(comparison.previousDate, i18n.language),

          })}

        </span>

      </div>



      <div

        style={{

          display: 'flex',

          alignItems: 'center',

          gap: 12,

          marginBottom: 16,

          padding: '10px 14px',

          background: dark ? 'rgba(255,255,255,0.03)' : '#F8F8FA',

          borderRadius: 10,

        }}

      >

        <span style={{ fontSize: 12, color: textMuted }}>{t('practiceResult.overall')}</span>

        <span style={{ fontSize: 14, color: textMuted }}>{comparison.previousOverall}</span>

        <span style={{ color: textMuted }}>→</span>

        <span style={{ fontSize: 18, fontWeight: 800, color: accent }}>{comparison.currentOverall}</span>

        <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor }}>

          {t('practiceResult.scoreDelta', { sign: deltaSign, delta, defaultValue: `${deltaSign}${delta}` })}

        </span>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: textMuted }}>

          {t('practiceResult.sessionCount', { count: comparison.sessionCount })}

        </span>

      </div>



      {comparison.improved?.length > 0 ? (

        <div style={{ marginBottom: 12 }}>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#00B894' }}>

            {t('practiceResult.improved')}

          </p>

          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: textMain, lineHeight: 1.6 }}>

            {comparison.improved.map((item, i) => (

              <li key={`imp-${i}`}>{metricLabel(t, item)}</li>

            ))}

          </ul>

        </div>

      ) : null}



      {comparison.stillWeak?.length > 0 ? (

        <div>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#FF9F43' }}>

            {t('practiceResult.stillWeak')}

          </p>

          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: textMain, lineHeight: 1.6 }}>

            {comparison.stillWeak.map((item, i) => (

              <li key={`weak-${i}`}>{weakLabel(t, item)}</li>

            ))}

          </ul>

        </div>

      ) : null}

    </section>

  );

}

