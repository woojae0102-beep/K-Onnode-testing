// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STUDIO_SONGS } from '../../data/groupStudioSongs';
import { getStudioData } from '../../services/groupStudioStorage';
import { fetchWeeklyTrending } from '../../services/groupStudioTrending';
import { prefetchAllSongCovers } from '../../services/songCoverResolver';
import { useGroupStudioSearch } from '../../hooks/useGroupStudioSearch';
import SongCard, { TrendingSongCard, SongSearchRow } from './SongCard';
import HorizontalSongScroll from './HorizontalSongScroll';
import SongSearchBar from './SongSearchBar';
import '../../styles/group-studio.css';

export function GroupStudioHome({ onSelectSong, onBack }) {
  const { t } = useTranslation();
  const [data, setData] = useState(getStudioData);
  const [weeklyTrending, setWeeklyTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingWeek, setTrendingWeek] = useState('');
  const { query, setQuery, results, youtubeResults, youtubeLoading, hasQuery } = useGroupStudioSearch();

  const refreshData = useCallback(() => setData(getStudioData()), []);

  useEffect(() => {
    refreshData();
    prefetchAllSongCovers(STUDIO_SONGS);
    window.addEventListener('onnode-group-studio-update', refreshData);
    return () => window.removeEventListener('onnode-group-studio-update', refreshData);
  }, [refreshData]);

  useEffect(() => {
    let cancelled = false;
    setTrendingLoading(true);
    fetchWeeklyTrending(10)
      .then((res) => {
        if (cancelled) return;
        setWeeklyTrending(res.items || []);
        setTrendingWeek(res.weekKey || '');
      })
      .finally(() => {
        if (!cancelled) setTrendingLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const songMap = useMemo(() => Object.fromEntries(STUDIO_SONGS.map((s) => [s.id, s])), []);
  const favoriteIds = data.favorites || [];

  const favoriteSongs = favoriteIds.map((id) => songMap[id]).filter(Boolean);
  const recentSongs = (data.recent || []).map((id) => songMap[id]).filter(Boolean);

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        {onBack ? (
          <button type="button" className="group-studio-back" onClick={onBack}>
            {t('groupStudio.home.back')}
          </button>
        ) : null}

        <header className="group-studio-header">
          <h1 className="group-studio-title">{t('groupStudio.home.title')}</h1>
          <p className="group-studio-subtitle">{t('groupStudio.home.subtitle')}</p>
        </header>

        <SongSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('groupStudio.home.searchPlaceholder')}
        />

        {hasQuery ? (
          <section className="group-studio-section">
            <h2 className="group-studio-section-title">{t('groupStudio.home.searchResults')}</h2>
            {results.length === 0 && youtubeResults.length === 0 && !youtubeLoading ? (
              <p className="group-studio-empty">{t('groupStudio.home.noSearchResults')}</p>
            ) : (
              <div className="group-studio-search-results">
                {results.map((song) => (
                  <SongSearchRow
                    key={song.id}
                    song={song}
                    onClick={onSelectSong}
                    favoriteIds={favoriteIds}
                    onFavoriteChange={refreshData}
                  />
                ))}
                {youtubeLoading ? (
                  <p className="group-studio-empty">{t('groupStudio.home.youtubeLoading')}</p>
                ) : null}
                {youtubeResults.length > 0 ? (
                  <>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '12px 0 6px', letterSpacing: '0.05em' }}>
                      {t('groupStudio.home.youtubeResults')}
                    </p>
                    {youtubeResults.map((item) => (
                      <a
                        key={item.videoId}
                        href={item.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group-studio-search-row"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" style={{ width: 56, height: 32, objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <div className="group-studio-search-thumb" style={{ width: 56, height: 32 }} />
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{item.channel}</div>
                        </div>
                      </a>
                    ))}
                  </>
                ) : null}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="group-studio-section">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 className="group-studio-section-title" style={{ margin: 0 }}>
                  {t('groupStudio.home.trending')}
                </h2>
                {trendingWeek ? (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {t('groupStudio.home.trendingWeek', { week: trendingWeek })}
                  </span>
                ) : null}
              </div>
              {trendingLoading ? (
                <p className="group-studio-empty">{t('groupStudio.home.trendingLoading')}</p>
              ) : (
                <HorizontalSongScroll>
                  {weeklyTrending.map((item) => (
                    <TrendingSongCard
                      key={`${item.rank}-${item.songId || item.title}`}
                      item={item}
                      onClick={onSelectSong}
                      favoriteIds={favoriteIds}
                      onFavoriteChange={refreshData}
                    />
                  ))}
                </HorizontalSongScroll>
              )}
            </section>

            <section className="group-studio-section">
              <h2 className="group-studio-section-title">{t('groupStudio.home.favorites')}</h2>
              {favoriteSongs.length === 0 ? (
                <p className="group-studio-empty">{t('groupStudio.home.noFavorites')}</p>
              ) : (
                <HorizontalSongScroll>
                  {favoriteSongs.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      onClick={onSelectSong}
                      favoriteIds={favoriteIds}
                      onFavoriteChange={refreshData}
                    />
                  ))}
                </HorizontalSongScroll>
              )}
            </section>

            <section className="group-studio-section">
              <h2 className="group-studio-section-title">{t('groupStudio.home.recent')}</h2>
              {recentSongs.length === 0 ? (
                <p className="group-studio-empty">{t('groupStudio.home.noRecent')}</p>
              ) : (
                <HorizontalSongScroll>
                  {recentSongs.map((song) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      onClick={onSelectSong}
                      favoriteIds={favoriteIds}
                      onFavoriteChange={refreshData}
                    />
                  ))}
                </HorizontalSongScroll>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default GroupStudioHome;
