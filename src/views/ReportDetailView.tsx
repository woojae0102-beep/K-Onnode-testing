// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import ScoreGauge from '../components/report/ScoreGauge';
import DetailScoreCard from '../components/report/DetailScoreCard';
import TimelineSection from '../components/report/TimelineSection';
import RecommendedRoutine from '../components/report/RecommendedRoutine';
import RecommendedContent from '../components/report/RecommendedContent';
import {
  DETAIL_FIELDS,
  TRACK_COLORS,
  formatReportDateShort,
} from '../mocks/reportMocks';

const RETRY_PRACTICE_BAR_HEIGHT = 78;

const TRACK_LABEL_KEY = {
  dance: 'report.trackDance',
  vocal: 'report.trackVocal',
  korean: 'report.trackKorean',
};

export default function ReportDetailView({ report, onBack, onSwitchSubTab }) {
  const { t } = useTranslation();
  if (!report) return null;
  const accent = TRACK_COLORS[report.track] || '#FF1F8E';
  const trackLabel = t(TRACK_LABEL_KEY[report.track] || 'report.trackDance');
  const detailFields = DETAIL_FIELDS[report.track] || [];

  const handleStartRoutine = () => {
    const firstStep = report.recommendedRoutine?.[0];
    const target = firstStep?.track || report.track;
    onSwitchSubTab?.(target);
  };

  const handleSelectContent = (content) => {
    onSwitchSubTab?.(content.track || report.track);
  };

  const handleRetry = () => {
    onSwitchSubTab?.(report.track);
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        background: '#F5F5F7',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          height: 52,
          background: '#FFFFFF',
          borderBottom: '1px solid #F0F0F0',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={t('report.back')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: '#111111',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <p style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: '#111111' }}>
          {trackLabel} {t('report.trackReportSuffix')}
        </p>
        <span style={{ fontSize: 12, color: '#888888' }}>{formatReportDateShort(report.date)}</span>
      </header>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: `16px 16px ${RETRY_PRACTICE_BAR_HEIGHT + 16}px`,
        }}
      >
        <Section>
          <SectionLabel>{t('report.sections.summary')}</SectionLabel>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '0.5px solid #E5E5E5',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111111' }}>{report.contentName}</p>
            <div style={{ marginTop: 14 }}>
              <ScoreGauge value={report.overallScore} color={accent} />
            </div>

            {detailFields.length ? (
              <div
                style={{
                  width: '100%',
                  marginTop: 18,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                }}
              >
                {detailFields.map((field) => (
                  <DetailScoreCard
                    key={field.key}
                    label={t(`report.scoreLabel.${field.key}`, field.label)}
                    value={report.detailScores?.[field.key]}
                    accent={accent}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </Section>

        <Section>
          <SectionLabel>{t('report.sections.feedback')}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#FF1F8E',
                color: '#FFFFFF',
                fontWeight: 800,
                fontStyle: 'italic',
                display: 'grid',
                placeItems: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              O
            </div>
            <div
              style={{
                background: '#FFF0F7',
                borderRadius: 12,
                padding: 14,
                fontSize: 13,
                color: '#111111',
                lineHeight: 1.55,
                flex: 1,
              }}
            >
              {report.aiFeedback}
            </div>
          </div>
        </Section>

        <Section>
          <SectionLabel>{t('report.sections.timeline')}</SectionLabel>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '0.5px solid #E5E5E5',
              padding: 16,
            }}
          >
            <TimelineSection items={report.timeline} />
          </div>
        </Section>

        <Section>
          <SectionLabel>{t('report.sections.routine')}</SectionLabel>
          <RecommendedRoutine items={report.recommendedRoutine || []} onStart={handleStartRoutine} />
        </Section>

        <Section>
          <RecommendedContent items={report.recommendedContent || []} onSelect={handleSelectContent} />
        </Section>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 16px 16px',
          background: 'linear-gradient(to top, #F5F5F7 60%, rgba(245,245,247,0))',
          pointerEvents: 'none',
        }}
      >
        <button
          type="button"
          onClick={handleRetry}
          style={{
            width: '100%',
            background: '#FF1F8E',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            padding: 14,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxShadow: '0 4px 14px rgba(255,31,142,0.25)',
          }}
        >
          {t('report.practiceAgain')}
        </button>
      </div>
    </div>
  );
}

function Section({ children }) {
  return <section style={{ marginBottom: 18 }}>{children}</section>;
}

function SectionLabel({ children }) {
  return (
    <p
      style={{
        margin: '0 0 8px',
        fontSize: 11,
        color: '#888888',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </p>
  );
}
