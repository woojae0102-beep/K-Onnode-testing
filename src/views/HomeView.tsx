// @ts-nocheck
// TODO: replace with GET /api/user/stats
import React from 'react';
import { useTranslation } from 'react-i18next';

const COLOR = {
  bgPrimary: 'var(--color-background-primary, #FFFFFF)',
  bgSecondary: 'var(--color-background-secondary, #F5F5F7)',
  textPrimary: 'var(--color-text-primary, #111111)',
  textSecondary: 'var(--color-text-secondary, #666666)',
  textTertiary: 'var(--color-text-tertiary, #999999)',
  borderSecondary: 'var(--color-border-secondary, #E5E5E5)',
};

const QUICK_TRACK_STYLES = {
  dance: {
    icon: '🕺',
    accentColor: '#FF1F8E',
  },
  vocal: {
    icon: '🎤',
    accentColor: '#4A6BFF',
  },
  korean: {
    icon: '🇰🇷',
    accentColor: '#1DB971',
  },
  audition: {
    icon: '🏆',
    accentColor: '#6C5CE7',
    isNew: true,
  },
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: COLOR.textTertiary,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  marginBottom: 10,
};

function HeroBanner({ onStartToday, onScrollToQuickStart }) {
  const { t } = useTranslation();
  return (
    <section
      style={{
        border: `1px solid ${COLOR.borderSecondary}`,
        borderRadius: 12,
        background: COLOR.bgPrimary,
        padding: 24,
        marginBottom: 20,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          background: '#FFF0F7',
          color: '#FF1F8E',
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: 4,
          marginBottom: 14,
          letterSpacing: '0.02em',
        }}
      >
        {t('home.heroTag')}
      </span>

      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: 6,
          color: COLOR.textPrimary,
          letterSpacing: '-0.01em',
        }}
      >
        {t('home.heroTitleLine1')}{' '}
        <span style={{ color: '#FF1F8E' }}>{t('home.heroTitleLine2')}</span>
      </h1>

      <p
        style={{
          fontSize: 13,
          color: COLOR.textSecondary,
          lineHeight: 1.55,
          margin: 0,
          marginBottom: 18,
        }}
      >
        {t('home.heroSubtitle')}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onStartToday}
          style={{
            background: '#FF1F8E',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('home.startBtn')}
        </button>
        <button
          type="button"
          onClick={onScrollToQuickStart}
          style={{
            background: 'transparent',
            color: COLOR.textPrimary,
            border: `1px solid ${COLOR.borderSecondary}`,
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('home.selectTrack')}
        </button>
      </div>
    </section>
  );
}

function StatusSection() {
  const { t } = useTranslation();
  const stats = [
    { value: '12', unit: ` ${t('home.unitLv')}`, label: t('home.currentLevel') },
    { value: '7', unit: ` ${t('home.unitDays')}`, label: t('home.streakDays') },
    { value: '84', unit: t('home.unitScore'), label: t('home.recentScore') },
  ];
  return (
    <section style={{ marginBottom: 20 }}>
      <p style={sectionLabelStyle}>{t('home.myStatus')}</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          border: `1px solid ${COLOR.borderSecondary}`,
          borderRadius: 12,
          background: COLOR.bgPrimary,
          padding: 6,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '12px 14px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: COLOR.textPrimary,
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
              }}
            >
              {stat.value}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: COLOR.textSecondary,
                }}
              >
                {stat.unit}
              </span>
            </p>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 11,
                color: COLOR.textSecondary,
              }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickStartCard({ track, onNavigate }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => onNavigate(track.view)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        background: COLOR.bgPrimary,
        border: `1px solid ${hover ? track.accentColor : COLOR.borderSecondary}`,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${track.accentColor}14`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
          marginBottom: 10,
        }}
      >
        {track.icon}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: COLOR.textPrimary,
          }}
        >
          {track.title}
        </p>
        {track.isNew ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: track.accentColor,
              background: `${track.accentColor}14`,
              padding: '1px 5px',
              borderRadius: 3,
              letterSpacing: '0.04em',
            }}
          >
            NEW
          </span>
        ) : null}
      </div>

      <p
        style={{
          margin: '4px 0 0',
          fontSize: 11,
          color: COLOR.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {track.desc}
      </p>
    </button>
  );
}

function QuickStartSection({ onNavigate }) {
  const { t } = useTranslation();
  const quickTracks = [
    {
      view: 'dance',
      ...QUICK_TRACK_STYLES.dance,
      title: t('home.danceTitle'),
      desc: t('home.danceDesc'),
    },
    {
      view: 'vocal',
      ...QUICK_TRACK_STYLES.vocal,
      title: t('home.vocalTitle'),
      desc: t('home.vocalDesc'),
    },
    {
      view: 'korean',
      ...QUICK_TRACK_STYLES.korean,
      title: t('home.koreanTitle'),
      desc: t('home.koreanDesc'),
    },
    {
      view: 'agency-audition',
      ...QUICK_TRACK_STYLES.audition,
      title: t('home.auditionTitle', { defaultValue: '기획사 오디션' }),
      desc: t('home.auditionDesc', {
        defaultValue: 'HYBE · YG · JYP · SM · Starship 5개 기획사 AI 심사',
      }),
    },
  ];
  return (
    <section id="quick-start">
      <p style={sectionLabelStyle}>{t('home.quickStart')}</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}
      >
        {quickTracks.map((track) => (
          <QuickStartCard key={track.view} track={track} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

export default function HomeView({ onNavigate }) {
  const handleScrollToQuickStart = () => {
    const el =
      typeof document !== 'undefined'
        ? document.getElementById('quick-start')
        : null;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStartToday = () => {
    onNavigate?.('aicoach');
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        maxWidth: 860,
        margin: '0 auto',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <HeroBanner
        onStartToday={handleStartToday}
        onScrollToQuickStart={handleScrollToQuickStart}
      />
      <StatusSection />
      <QuickStartSection onNavigate={(view) => onNavigate?.(view)} />
    </div>
  );
}
