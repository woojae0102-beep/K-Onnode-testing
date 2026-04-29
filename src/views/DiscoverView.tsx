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
];

const SECTION_LABEL_STYLE: React.CSSProperties = {
  margin: 0,
  padding: '4px 0 10px',
  fontSize: 14,
  fontWeight: 700,
  color: '#111111',
};

export default function DiscoverView({ onNavigate, initialCategory = 'all', hideCategoryTabs = false }) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);
  const [data, setData] = useState(() => fetchMockDiscover());
  const [source, setSource] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const apiBase = (typeof window !== 'undefined' && window.location?.origin) || '';
    setSource('loading');
    setErrorMessage('');
    fetch(`${apiBase}/api/discover?track=all&limit=20`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}${text ? ` — ${text.slice(0, 120)}` : ''}`);
        }
        return res.json();
      })
      .then((json) => {
        if (cancelled || !json || !json.data) return;
        setData({
          trending: json.data.trending || [],
          dance: json.data.dance || [],
          songs: json.data.songs || [],
          challenges: json.data.challenges || [],
          lastUpdated: json.lastUpdated || null,
          source: json.source || 'api',
        });
        setSource(json.source || 'api');
      })
      .catch((err) => {
        if (cancelled) return;
        setSource('error');
        setErrorMessage(String(err?.message || err));
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
      {!hideCategoryTabs && (
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
      )}

      {source === 'no-key' ? (
        <Banner tone="warn">
          ⚠️ <code>.env</code>의 <code>YOUTUBE_API_KEY</code>가 비어 있습니다. 키를 설정하면 매주 월요일에 실시간 트렌드가 자동으로 갱신됩니다.
        </Banner>
      ) : source === 'error' ? (
        <Banner tone="warn">
          ⚠️ YouTube 데이터를 불러오지 못했습니다.{errorMessage ? ` (${errorMessage})` : ''}
        </Banner>
      ) : source === 'loading' ? (
        <Banner tone="info">⏳ 이번 주 가장 핫한 트렌드를 YouTube에서 가져오는 중입니다…</Banner>
      ) : null}

      <div style={{ padding: '4px 0 32px' }}>
        {showSection('trending') ? (
          <Section
            title={`🔥 ${t('discoverNew.sections.trending')} TOP 20`}
            updatedLabel={lastUpdatedLabel}
          >
            <RankedList
              items={data.trending}
              renderItem={(item) => <TrendingCard item={item} />}
            />
          </Section>
        ) : null}

        {showSection('dance') ? (
          <Section
            title={`💃 ${t('discoverNew.sections.popularDance')} TOP 20`}
            updatedLabel={t('discoverNew.labels.updatedWeekly')}
          >
            <RankedList
              items={data.dance}
              renderItem={(item) => (
                <DanceCard
                  item={item}
                  t={t}
                  onPractice={() => onNavigate?.('dance')}
                />
              )}
            />
          </Section>
        ) : null}

        {showSection('songs') ? (
          <Section
            title={`🎵 ${t('discoverNew.sections.popularSongs')} TOP 20`}
            updatedLabel={t('discoverNew.labels.updatedWeekly')}
          >
            <RankedList
              items={data.songs}
              renderItem={(item) => (
                <SongCard item={item} t={t} onSing={() => onNavigate?.('vocal')} />
              )}
            />
          </Section>
        ) : null}

        {showSection('challenges') ? (
          <Section
            title={`🏆 ${t('discoverNew.sections.challenges')} TOP 20`}
            updatedLabel={t('discoverNew.labels.updatedWeekly')}
          >
            <RankedList
              items={data.challenges}
              renderItem={(item) => (
                <ChallengeCard
                  item={item}
                  t={t}
                  locale={i18n.language}
                  onJoin={() => onNavigate?.('dance')}
                />
              )}
            />
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, updatedLabel, children }) {
  return (
    <section style={{ padding: '16px 16px 4px' }}>
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

function Banner({ tone, children }) {
  const palette = tone === 'info'
    ? { bg: '#E8F4FF', border: '#B6DCFF', color: '#1F5F9B' }
    : { bg: '#FFF8E5', border: '#FFE0A3', color: '#8A6D00' };
  return (
    <div
      style={{
        margin: '4px 16px 8px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 11,
        color: palette.color,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function RankedList({ items, renderItem }) {
  if (!items || items.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: '#999',
          fontSize: 12,
          background: '#FFFFFF',
          borderRadius: 12,
          border: '0.5px solid #E5E5E5',
        }}
      >
        데이터를 불러오는 중...
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.slice(0, 20).map((item, idx) => (
        <RankedRow key={item.id || idx} rank={item.rank ?? idx + 1}>
          {renderItem(item)}
        </RankedRow>
      ))}
    </div>
  );
}

function RankedRow({ rank, children }) {
  const isTopThree = rank <= 3;
  const rankColors = {
    1: '#FFD700',
    2: '#C0C0C0',
    3: '#CD7F32',
  };
  const rankBg = rankColors[rank] || '#F5F5F7';
  const rankText = isTopThree ? '#1A1A1A' : '#888888';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <div
        style={{
          flexShrink: 0,
          width: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: rankBg,
          color: rankText,
          fontSize: isTopThree ? 16 : 14,
          fontWeight: isTopThree ? 800 : 700,
          borderRadius: 10,
          border: isTopThree ? `1.5px solid ${rankBg}` : '0.5px solid #E5E5E5',
          boxShadow: isTopThree ? `0 2px 8px ${rankBg}55` : 'none',
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function TrendingCard({ item }) {
  return (
    <a
      href={item.youtubeUrl || '#'}
      target={item.youtubeUrl ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        display: 'flex',
        gap: 10,
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 10,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Thumbnail
        src={item.thumbnail}
        videoId={item.videoId || item.id}
        artist={item.artist || item.channel}
        title={item.title}
        width={96}
        height={56}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#111111',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {item.title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888888' }}>
          {item.channel || item.artist}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888888' }}>
          👁 {formatViews(item.viewCount)} · ♥ {formatViews(item.likeCount)}
        </p>
      </div>
    </a>
  );
}

function DanceCard({ item, t, onPractice }) {
  const difficulty = item.difficulty || 'normal';
  return (
    <a
      href={item.youtubeUrl || '#'}
      target={item.youtubeUrl ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        display: 'flex',
        gap: 10,
        width: '100%',
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        textAlign: 'left',
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Thumbnail
        src={item.thumbnail}
        videoId={item.videoId || item.id}
        artist={item.artist || item.channel}
        title={item.title}
        width={70}
        height={70}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: '#111111',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {item.title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888888' }}>{item.artist || item.channel}</p>
        {item.viewCount ? (
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#999' }}>
            👁 {formatViews(item.viewCount)}
          </p>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span
          style={{
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 12,
            background: '#FF1F8E1A',
            color: '#FF1F8E',
            fontWeight: 600,
          }}
        >
          {t(`discoverNew.labels.difficulty.${difficulty}`)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPractice?.();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 11,
            color: '#FF1F8E',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t('discoverNew.actions.practice')} →
        </button>
      </div>
    </a>
  );
}

function SongCard({ item, t, onSing }) {
  return (
    <a
      href={item.youtubeUrl || '#'}
      target={item.youtubeUrl ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        display: 'flex',
        gap: 10,
        width: '100%',
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        textAlign: 'left',
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Thumbnail
        src={item.albumArt || item.thumbnail}
        videoId={item.videoId || item.id}
        artist={item.artist || item.channel}
        title={item.title}
        width={56}
        height={56}
        palette="blue"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: '#111111',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {item.title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888888' }}>
          {item.artist || item.channel}
        </p>
        {item.viewCount ? (
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#999' }}>
            👁 {formatViews(item.viewCount)}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSing?.();
        }}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: 11,
          color: '#4A6BFF',
          fontWeight: 700,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {t('discoverNew.actions.sing')} →
      </button>
    </a>
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
    <a
      href={item.youtubeUrl || '#'}
      target={item.youtubeUrl ? '_blank' : undefined}
      rel="noreferrer"
      style={{
        background: '#FFFFFF',
        border: '0.5px solid #E5E5E5',
        borderRadius: 12,
        padding: 10,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        textDecoration: 'none',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      <Thumbnail
        src={item.thumbnail}
        videoId={item.videoId || item.id}
        artist={item.name || item.title}
        title={item.title}
        width={60}
        height={60}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: '#111111',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
          }}
        >
          {item.name || item.title}
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onJoin?.();
        }}
        style={{
          flexShrink: 0,
          background: '#FF1F8E',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {t('discoverNew.actions.join')}
      </button>
    </a>
  );
}

const PINK_GRADIENTS = [
  'linear-gradient(135deg, #FF6B9D 0%, #FF1F8E 100%)',
  'linear-gradient(135deg, #FFB7CC 0%, #FF6B9D 100%)',
  'linear-gradient(135deg, #FF8AB6 0%, #C71585 100%)',
  'linear-gradient(135deg, #FFD1E6 0%, #FF8AB6 100%)',
  'linear-gradient(135deg, #FF1F8E 0%, #6C5CE7 100%)',
];
const BLUE_GRADIENTS = [
  'linear-gradient(135deg, #4A6BFF 0%, #6C5CE7 100%)',
  'linear-gradient(135deg, #6BA1FF 0%, #4A6BFF 100%)',
  'linear-gradient(135deg, #A29BFE 0%, #4A6BFF 100%)',
  'linear-gradient(135deg, #74B9FF 0%, #6C5CE7 100%)',
  'linear-gradient(135deg, #00BCD4 0%, #4A6BFF 100%)',
];

function getInitials(text) {
  if (!text) return '?';
  const t = String(text).trim();
  // Take first 1–2 letters/syllables (works for both Hangul and Latin)
  return t.slice(0, 2).toUpperCase();
}

function pickGradient(seed, palette) {
  const list = palette === 'blue' ? BLUE_GRADIENTS : PINK_GRADIENTS;
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

function Thumbnail({ src, videoId, artist, title, width = 56, height = 56, palette = 'pink' }) {
  const [errored, setErrored] = useState(false);
  const [chainIdx, setChainIdx] = useState(0);
  const initials = getInitials(artist);
  const gradient = pickGradient(videoId || artist || title, palette);

  const sources = useMemo(() => {
    const list: string[] = [];
    if (typeof src === 'string' && /^https?:\/\//i.test(src)) list.push(src);
    if (videoId) {
      list.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
      list.push(`https://i.ytimg.com/vi/${videoId}/sddefault.jpg`);
      list.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
      list.push(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
    }
    return Array.from(new Set(list));
  }, [src, videoId]);

  const currentSrc = sources[chainIdx];

  const cleanTitle = useMemo(() => {
    if (!title) return '';
    return String(title)
      .replace(/\([^)]*MV[^)]*\)/gi, '')
      .replace(/\bM\/?V\b/gi, '')
      .replace(/Official.*$/i, '')
      .replace(/Dance Practice.*$/i, '')
      .replace(/Performance.*$/i, '')
      .replace(/^[^-–]*[-–]\s*/, '')
      .replace(/["'`]/g, '')
      .trim();
  }, [title]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // YouTube returns a 120x90 gray placeholder for missing/private videos with HTTP 200.
    // hqdefault returns 480x360, but for missing videos it's 480x360 of black-bars+gray too.
    // The most reliable signature is the small 120x90 default placeholder.
    if (img.naturalWidth <= 120 && img.naturalHeight <= 90) {
      if (chainIdx < sources.length - 1) {
        setChainIdx(chainIdx + 1);
      } else {
        setErrored(true);
      }
    }
  };

  const handleError = () => {
    if (chainIdx < sources.length - 1) {
      setChainIdx(chainIdx + 1);
    } else {
      setErrored(true);
    }
  };

  const showImage = !errored && currentSrc;
  const minSide = Math.min(width, height);

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        background: gradient,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {showImage ? (
        <img
          src={currentSrc}
          alt={artist || title || 'thumbnail'}
          loading="lazy"
          onError={handleError}
          onLoad={handleLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: minSide >= 70 ? 8 : 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#FFFFFF',
            textShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}
        >
          <span
            style={{
              fontSize: Math.max(13, Math.round(minSide / 3)),
              fontWeight: 900,
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}
          >
            {initials}
          </span>
          {cleanTitle && minSide >= 56 ? (
            <span
              style={{
                fontSize: Math.max(9, Math.round(minSide / 8)),
                fontWeight: 600,
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                opacity: 0.95,
              }}
            >
              {cleanTitle}
            </span>
          ) : null}
        </div>
      )}
    </div>
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
