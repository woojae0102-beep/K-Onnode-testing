// @ts-nocheck
import React, { useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';

export function SongAlbumArt({ song, size = 140, className = '', showGroupLabel = true }) {
  const group = song?.groupId ? GROUP_DATA[song.groupId] : null;
  const [imgError, setImgError] = useState(false);
  const cover = song?.albumCover;
  const useImage = cover && !imgError;

  return (
    <div
      className={`group-studio-song-art ${className}`}
      style={{
        width: size,
        height: size,
        background: useImage
          ? '#0a0a14'
          : `linear-gradient(135deg, ${song?.albumColor || '#333'}, ${song?.albumColor2 || '#555'})`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {useImage ? (
        <img
          src={cover}
          alt={song?.title || ''}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : null}
      {showGroupLabel && !useImage ? <span>{group?.nameKr || ''}</span> : null}
    </div>
  );
}

export default SongAlbumArt;
