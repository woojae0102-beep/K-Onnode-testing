// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchMockDiscover } from '../mocks/discoverMocks';

const CATEGORIES = [
  { id: 'all', labelKey: 'discoverNew.categories.all' },
  { id: 'trending', labelKey: 'discoverNew.categories.trending' },
  { id: 'dance', labelKey: 'discoverNew.categories.dance' },
  { id: 'songs', labelKey: 'discoverNew.categories.songs' },
  { id: 'challenges', labelKey: 'discoverNew.categories.challenges' },
  { id: 'korean', labelKey: 'discoverNew.categories.korean' },
];

const SECTION_LABEL_STYLE: React.CSSProperties = {
  margin: 0,
  padding: '4px 0 10px',
  fontSize: 13,
  fontWeight: 600,
  color: '#111111',
};

export default function DiscoverView({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState('all');
  const [data, setData] = useState(() => fetchMockDiscover());

  useEffect(() => {
    let cancelled = false;
    const apiBase = (typeof window !== 'undefined' && window.location?.origin) || '';
    fetch(`${apiBase}/api/discover?track=all&limit=20`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json || !json.data) return;
        setData((prev) => ({
          trending: json.data.trending?.length ? json.data.trending : prev.trending,
          dance: json.data.dance?.length ? json.data.dance : prev.dance,
          songs: json.data.songs?.length ? json.data.songs : prev.songs,
          challenges: json.data.challenges?.length ? json.data.challenges : prev.challenges,
          korean: json.data.korean?.length ? json.data.korean : prev.korean,
          lastUpdated: json.lastUpdated || prev.lastUpdated,
          source: json.source || 'api',
        }));
      })
      .catch(() => {
        // 실패 시 mock 데이터 유지 (의도된 폴백)
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    if (!data.lastUpdated) return '';
    try {
      const d = new Date(data.lastUpdated);
      const locale = i18n.language || 'ko';
      const datePart = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      return t('discoverNew.labels.updatedAt', { date: datePart });
    } catch {
      return '';
    }
  }, [data.lastUpdated, i18n.language, t]);

  const showSection = (id) => category === 'all' || category === id;

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: '#F5F5F7',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: '#F5F5F7',
          padding: '12px 16px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
        className="hide-scrollbar"
      >
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                background: active ? '#FF1F8E' : '#F5F5F5',
                color: active ? '#FFFFFF' : '#888888',
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {t(c.labelKey)}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '4px 0 32px' }}>
        {showSection('trending') ? (
          <Section
            title={t('discoverNew.sections.trending')}
            updatedLabel={lastUpdatedLabel}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.trending.map((item) => (
                <TrendingCard key={item.id} item={item} t={t} />
              ))}
            </div>
          </Section>
        ) : null}

        {showSection('dance') ? (
          <Section
            title={t('discoverNew.sections.popularDance')}
            updatedLabel={t('discoverNew.labels.updatedWeekly')}
          >
            <HorizontalScroller>
              {data.dance.map((item) => (
                <DanceCard
                  key={item.id}
                  item={item}
                  t={t}
                  onPractice={() => onNavigate?.('dance')}
                />
              ))}
            </HorizontalScroller>
          </Section>
        ) : null}

        {showSection('songs') ? (
          <Section title={t('discoverNew.sections.popularSongs')}>
            <HorizontalScroller>
              {data.songs.map((item) => (
                <SongCard key={item.id} item={item} t={t} onSing={() => onNavigate?.('vocal')} />
              ))}
            </HorizontalScroller>
          </Section>
        ) : null}

        {showSection('challenges') ? (
          <Section
            title={t('discoverNew.sections.challenges')}
            updatedLabel={t('discoverNew.labels.updatedWeekly')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.challenges.map((item) => (
                <ChallengeCard
                  key={item.id}
                  item={item}
                  t={t}
                  locale={i18n.language}
                  onJoin={() => onNavigate?.('dance')}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {showSection('korean') ? (
          <Section title={t('discoverNew.sections.korean')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.korean.map((item) => (
                <KoreanRow
                  key={item.id}
                  item={item}
                  t={t}
                  onOpen={() => onNavigate?.('korean')}
                />
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, updatedLabel, children }) {
  return (
    <section style={{ padding: '12px 16px 4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <p style={SECTION_LABEL_STYLE}>{title}</p>
        {updatedLabel ? (
          <span style={{ fontSize: 11, color: '#AAAAAA' }}>{updatedLabel}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function HorizontalScroller({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        marginRight: -16,
        paddingRight: 16,
      }}
      className="hide-scrollbar"
    >
      {children}
    </div>
  );
}

function TrendingCard({ item, t }) {
  return (
    <a
      href={item.youtubeUrl || '#'}
      target={item.youtubeUrl ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        display: 'block',
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background:
            typeof item.thumbnail === 'string' && item.thumbnail.startsWith('#')
              ? item.thumbnail
              : `center/cover no-repeat url(${item.thumbnail})`,
        }}
      />
      <div style={{ padding: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: '#111111',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#888888' }}>
          {formatViews(item.viewCount)} · ♥ {formatViews(item.likeCount)}
        </p>
      </div>
    </a>
  );
}

function DanceCard({ item, t, onPractice }) {
  const difficulty = item.difficulty || 'normal';
  return (
    <button
      type="button"
      onClick={onPractice}
      style={{
        flexShrink: 0,
        width: 160,
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          height: 90,
          borderRadius: 8,
          background: item.thumbnail || '#FFE5F1',
          marginBottom: 8,
        }}
      />
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 500,
          color: '#111111',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.title}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888888' }}>{item.artist}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span
          style={{
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 12,
            background: '#FF1F8E1A',
            color: '#FF1F8E',
            fontWeight: 500,
          }}
        >
          {t(`discoverNew.labels.difficulty.${difficulty}`)}
        </span>
        <span style={{ fontSize: 11, color: '#FF1F8E', fontWeight: 600 }}>
          {t('discoverNew.actions.practice')}
        </span>
      </div>
    </button>
  );
}

function SongCard({ item, t, onSing }) {
  return (
    <button
      type="button"
      onClick={onSing}
      style={{
        flexShrink: 0,
        width: 180,
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          background: item.albumArt || '#E5ECFF',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 500,
            color: '#111111',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888888' }}>{item.artist}</p>
        {item.bpm ? (
          <p style={{ margin: '4px 0 0', fontSize: 10, color: '#4A6BFF', fontWeight: 600 }}>
            {t('discoverNew.labels.bpm', { bpm: item.bpm })}
          </p>
        ) : null}
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4A6BFF', fontWeight: 600 }}>
          {t('discoverNew.actions.sing')}
        </p>
      </div>
    </button>
  );
}

function ChallengeCard({ item, t, locale, onJoin }) {
  const deadlineLabel = useMemo(() => {
    if (!item.deadline) return '';
    try {
      const d = new Date(item.deadline);
      const part = d.toLocaleDateString(locale || 'ko', { month: 'short', day: 'numeric' });
      return t('discoverNew.labels.deadline', { date: part });
    } catch {
      return '';
    }
  }, [item.deadline, locale, t]);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 70,
          height: 70,
          borderRadius: 10,
          background: item.thumbnail || '#FFE5F1',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#111111',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888888' }}>
          {t('discoverNew.labels.participants', { count: formatNumber(item.participants) })}
        </p>
        {deadlineLabel ? (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#FF1F8E' }}>{deadlineLabel}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onJoin}
        style={{
          flexShrink: 0,
          background: '#FF1F8E',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {t('discoverNew.actions.join')}
      </button>
    </div>
  );
}

function KoreanRow({ item, t, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 10,
        padding: '10px 12px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: '#F0FBF5',
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {item.icon || '🇰🇷'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: '#111111',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888888' }}>
          {t('discoverNew.labels.duration', { duration: item.duration })}
          {item.level ? ` · ${t('discoverNew.labels.level', { level: item.level })}` : ''}
        </p>
      </div>
      <span
        style={{
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 12,
          background: '#1DB9711A',
          color: '#1DB971',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {t('discoverNew.actions.open')}
      </span>
    </button>
  );
}

function formatNumber(value) {
  if (value == null) return '0';
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`;
  return new Intl.NumberFormat().format(value);
}

function formatViews(value) {
  if (value == null) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat().format(value);
}
