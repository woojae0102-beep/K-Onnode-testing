// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { STUDIO_SONGS } from '../../data/groupStudioSongs';
import { GROUP_DATA } from '../../data/groupPracticeData';
import {
  getStudioData,
  getTrendingSongIds,
} from '../../services/groupStudioStorage';
import { useGroupStudioSearch } from '../../hooks/useGroupStudioSearch';
import SongCard from './SongCard';
import SongSearchBar from './SongSearchBar';
import '../../styles/group-studio.css';

export function GroupStudioHome({ onSelectSong, onBack }) {
  const [data, setData] = useState(getStudioData);
  const { query, setQuery, results, hasQuery } = useGroupStudioSearch();

  useEffect(() => {
    const refresh = () => setData(getStudioData());
    refresh();
    window.addEventListener('onnode-group-studio-update', refresh);
    return () => window.removeEventListener('onnode-group-studio-update', refresh);
  }, []);

  const songMap = useMemo(() => Object.fromEntries(STUDIO_SONGS.map((s) => [s.id, s])), []);

  const trendingIds = useMemo(() => getTrendingSongIds(STUDIO_SONGS, 6), [data]);
  const trendingSongs = trendingIds.map((id) => songMap[id]).filter(Boolean);

  const favoriteSongs = (data.favorites || []).map((id) => songMap[id]).filter(Boolean);
  const recentSongs = (data.recent || []).map((id) => songMap[id]).filter(Boolean);

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        {onBack ? (
          <button type="button" className="group-studio-back" onClick={onBack}>
            ← 뒤로
          </button>
        ) : null}

        <header className="group-studio-header">
          <h1 className="group-studio-title">GROUP STUDIO</h1>
          <p className="group-studio-subtitle">Train Like an Idol</p>
        </header>

        <SongSearchBar value={query} onChange={setQuery} />

        {hasQuery ? (
          <section className="group-studio-section">
            <h2 className="group-studio-section-title">🔍 Search Results</h2>
            {results.length === 0 ? (
              <p className="group-studio-empty">검색 결과가 없습니다</p>
            ) : (
              <div className="group-studio-search-results">
                {results.map((song) => {
                  const group = GROUP_DATA[song.groupId];
                  return (
                    <button
                      key={song.id}
                      type="button"
                      className="group-studio-search-row"
                      onClick={() => onSelectSong(song.id)}
                    >
                      <div
                        className="group-studio-search-thumb"
                        style={{
                          background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})`,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{song.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                          {group?.nameKr}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="group-studio-section">
              <h2 className="group-studio-section-title">🔥 Trending</h2>
              <div className="group-studio-scroll">
                {trendingSongs.map((song) => (
                  <SongCard key={song.id} song={song} onClick={onSelectSong} />
                ))}
              </div>
            </section>

            <section className="group-studio-section">
              <h2 className="group-studio-section-title">⭐ Favorites</h2>
              {favoriteSongs.length === 0 ? (
                <p className="group-studio-empty">즐겨찾기한 곡이 없습니다</p>
              ) : (
                <div className="group-studio-scroll">
                  {favoriteSongs.map((song) => (
                    <SongCard key={song.id} song={song} onClick={onSelectSong} />
                  ))}
                </div>
              )}
            </section>

            <section className="group-studio-section">
              <h2 className="group-studio-section-title">🕒 Recently Practiced</h2>
              {recentSongs.length === 0 ? (
                <p className="group-studio-empty">최근 연습한 곡이 없습니다</p>
              ) : (
                <div className="group-studio-scroll">
                  {recentSongs.map((song) => (
                    <SongCard key={song.id} song={song} onClick={onSelectSong} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default GroupStudioHome;
