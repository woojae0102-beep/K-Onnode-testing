// @ts-nocheck
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isSongFavorite, toggleSongFavorite } from '../../services/groupStudioStorage';
import '../../styles/group-studio.css';

export function SongFavoriteStar({
  songId,
  favoriteIds = null,
  onFavoriteChange,
  className = 'group-studio-card-fav',
  size = 'card',
}) {
  const { t } = useTranslation();
  const isFav = favoriteIds ? favoriteIds.includes(songId) : isSongFavorite(songId);
  const sizeClass = size === 'inline' ? 'group-studio-inline-fav' : 'group-studio-card-fav';

  const handleFav = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!songId) return;
    toggleSongFavorite(songId);
    onFavoriteChange?.();
  }, [songId, onFavoriteChange]);

  if (!songId) return null;

  return (
    <button
      type="button"
      className={`${sizeClass} ${className} ${isFav ? 'is-active' : ''}`}
      onClick={handleFav}
      aria-label={isFav ? t('groupStudio.home.unfavorite') : t('groupStudio.home.favorite')}
    >
      {isFav ? '★' : '☆'}
    </button>
  );
}

export default SongFavoriteStar;
