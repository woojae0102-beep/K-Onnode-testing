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
    bg: '#FFF0F7',
    borderColor: '#FF1F8E33',
    icon: '🕺',
    badgeBg: '#FF1F8E18',
    badgeColor: '#CC1070',
  },
  vocal: {
    bg: '#F0F4FF',
    borderColor: '#4A6BFF33',
    icon: '🎤',
    badgeBg: '#4A6BFF18',
    badgeColor: '#2A4BCC',
  },
  korean: {
    bg: '#F0FBF5',
    borderColor: '#1DB97133',
    icon: '🇰🇷',
    badgeBg: '#1DB97118',
    badgeColor: '#0E8A50',
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
        border: '0.5px solid #FF1F8E44',
        borderRadius: 16,
        background: COLOR.bgPrimary,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          background: '#FF1F8E18',
          color: '#FF1F8E',
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 20,
          marginBottom: 12,
        }}
      >
        {t('home.heroTag')}
      </span>

      <h1
        style={{
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.35,
          marginBottom: 8,
          color: COLOR.textPrimary,
        }}
      >
        {t('home.heroTitleLine1')}
        <br />
        <span style={{ color: '#FF1F8E' }}>{t('home.heroTitleLine2')}</span>
      </h1>

      <p
        style={{
          fontSize: 13,
          color: COLOR.textSecondary,
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        {t('home.heroSubtitle')}
        <br />
        {t('home.heroSubtitle2')}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onStartToday}
          style={{
            background: '#FF1F8E',
            color: '#fff',
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
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
            border: `0.5px solid ${COLOR.borderSecondary}`,
            padding: '9px 18px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('home.selectTrack')}
        </button>
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: 24,
          top: 20,
          fontSize: 52,
          opacity: 0.13,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        🎤
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
    <section style={{ marginBottom: 24 }}>
      <p style={sectionLabelStyle}>{t('home.myStatus')}</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: COLOR.bgSecondary,
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: COLOR.textPrimary,
                lineHeight: 1.1,
              }}
            >
              {stat.value}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: COLOR.textSecondary,
                }}
              >
                {stat.unit}
              </span>
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12,
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
        background: track.bg,
        border: `0.5px solid ${track.borderColor}`,
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
        opacity: hover ? 0.85 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: 22, marginBottom: 8 }}>{track.icon}</span>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: COLOR.textPrimary,
        }}
      >
        {track.title}
      </p>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 11,
          color: COLOR.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {track.desc}
      </p>
      <span
        style={{
          marginTop: 8,
          display: 'inline-block',
          background: track.badgeBg,
          color: track.badgeColor,
          fontSize: 10,
          padding: '2px 7px',
          borderRadius: 20,
        }}
      >
        {track.badge}
      </span>
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
      badge: t('home.danceBadge'),
    },
    {
      view: 'vocal',
      ...QUICK_TRACK_STYLES.vocal,
      title: t('home.vocalTitle'),
      desc: t('home.vocalDesc'),
      badge: t('home.vocalBadge'),
    },
    {
      view: 'korean',
      ...QUICK_TRACK_STYLES.korean,
      title: t('home.koreanTitle'),
      desc: t('home.koreanDesc'),
      badge: t('home.koreanBadge'),
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
