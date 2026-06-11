// @ts-nocheck
import React, { useCallback } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { isSongFavorite, toggleSongFavorite } from '../../services/groupStudioStorage';
import SongAlbumArt from './SongAlbumArt';
import '../../styles/group-studio.css';

export function SongCard({
  song,
  onClick,
  compact = false,
  rank = null,
  showFavorite = true,
  favoriteIds = null,
  onFavoriteChange,
}) {
  const group = GROUP_DATA[song.groupId];
  const size = compact ? 120 : 140;
  const isFav = favoriteIds ? favoriteIds.includes(song.id) : isSongFavorite(song.id);

  const handleFav = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSongFavorite(song.id);
    onFavoriteChange?.();
  }, [song.id, onFavoriteChange]);

  return (
    <button type="button" className="group-studio-song-card" onClick={() => onClick(song.id)}>
      <div className="group-studio-song-art-wrap" style={{ position: 'relative', width: size }}>
        {rank ? (
          <span className="group-studio-rank-badge">{rank}</span>
        ) : null}
        <SongAlbumArt song={song} size={size} showGroupLabel={!!group?.nameKr} />
        {showFavorite ? (
          <button
            type="button"
            className={`group-studio-card-fav ${isFav ? 'is-active' : ''}`}
            onClick={handleFav}
            aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {isFav ? '★' : '☆'}
          </button>
        ) : null}
      </div>
      <p className="group-studio-song-title">{song.title}</p>
      <p className="group-studio-song-artist">{group?.nameKr}</p>
    </button>
  );
}

export function TrendingSongCard({ item, onClick, showFavorite = true, favoriteIds, onFavoriteChange }) {
  if (item.song) {
    return (
      <SongCard
        song={item.song}
        onClick={onClick}
        rank={item.rank}
        showFavorite={showFavorite}
        favoriteIds={favoriteIds}
        onFavoriteChange={onFavoriteChange}
      />
    );
  }

  const size = 140;
  return (
    <button
      type="button"
      className="group-studio-song-card"
      onClick={() => item.songId && onClick(item.songId)}
      disabled={!item.songId}
      style={{ opacity: item.songId ? 1 : 0.7 }}
    >
      <div className="group-studio-song-art-wrap" style={{ position: 'relative', width: size }}>
        <span className="group-studio-rank-badge">{item.rank}</span>
        <div
          className="group-studio-song-art"
          style={{
            width: size,
            height: size,
            background: '#0a0a14',
            overflow: 'hidden',
          }}
        >
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span>K-POP</span>
          )}
        </div>
      </div>
      <p className="group-studio-song-title">{item.title}</p>
      <p className="group-studio-song-artist">{item.artist}</p>
    </button>
  );
}

export default SongCard;
