// @ts-nocheck
import React, { useCallback, useMemo } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import { ensurePracticeSong } from '../../utils/ensurePracticeSong';
import SongAlbumArt from './SongAlbumArt';
import SongFavoriteStar from './SongFavoriteStar';
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

  const handleOpen = useCallback(() => {
    onClick(song.id);
  }, [onClick, song.id]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(song.id);
    }
  }, [onClick, song.id]);

  return (
    <div
      className="group-studio-song-card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="group-studio-song-art-wrap" style={{ position: 'relative', width: size }}>
        {rank ? <span className="group-studio-rank-badge">{rank}</span> : null}
        <SongAlbumArt song={song} size={size} showGroupLabel={!!group?.nameKr} />
        {showFavorite ? (
          <SongFavoriteStar
            songId={song.id}
            favoriteIds={favoriteIds}
            onFavoriteChange={onFavoriteChange}
          />
        ) : null}
      </div>
      <p className="group-studio-song-title">{song.title}</p>
      <p className="group-studio-song-artist">{group?.nameKr}</p>
    </div>
  );
}

export function TrendingSongCard({ item, onClick, showFavorite = true, favoriteIds, onFavoriteChange }) {
  const song = useMemo(() => {
    if (item.song?.id) return item.song;
    if (item.songId) return getSongById(item.songId);
    const id = ensurePracticeSong(item);
    return id ? getSongById(id) : null;
  }, [item]);

  if (!song) return null;

  return (
    <SongCard
      song={song}
      onClick={onClick}
      rank={item.rank}
      showFavorite={showFavorite}
      favoriteIds={favoriteIds}
      onFavoriteChange={onFavoriteChange}
    />
  );
}

export function SongSearchRow({ song, onClick, favoriteIds, onFavoriteChange }) {
  const group = GROUP_DATA[song.groupId];

  return (
    <div
      className="group-studio-search-row"
      role="button"
      tabIndex={0}
      onClick={() => onClick(song.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(song.id);
        }
      }}
    >
      <SongAlbumArt song={song} size={48} className="group-studio-search-thumb" showGroupLabel={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{song.title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{group?.nameKr}</div>
      </div>
      <SongFavoriteStar
        songId={song.id}
        favoriteIds={favoriteIds}
        onFavoriteChange={onFavoriteChange}
        size="inline"
      />
    </div>
  );
}

export function YoutubeSearchRow({ item, onClick, favoriteIds, onFavoriteChange }) {
  const song = useMemo(() => {
    const id = ensurePracticeSong({
      title: item.title,
      artist: item.channel,
      channel: item.channel,
      thumbnail: item.thumbnail,
      youtubeUrl: item.youtubeUrl,
      videoId: item.videoId,
    });
    return id ? getSongById(id) : null;
  }, [item]);

  if (!song) return null;

  return (
    <SongSearchRow
      song={song}
      onClick={onClick}
      favoriteIds={favoriteIds}
      onFavoriteChange={onFavoriteChange}
    />
  );
}

export default SongCard;
