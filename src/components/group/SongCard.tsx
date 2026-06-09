// @ts-nocheck
import React from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';

export function SongCard({ song, onClick, compact = false }) {
  const group = GROUP_DATA[song.groupId];
  const size = compact ? 120 : 140;

  return (
    <button type="button" className="group-studio-song-card" onClick={() => onClick(song.id)}>
      <div
        className="group-studio-song-art"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})`,
        }}
      >
        <span>{group?.nameKr}</span>
      </div>
      <p className="group-studio-song-title">{song.title}</p>
      <p className="group-studio-song-artist">{group?.nameKr}</p>
    </button>
  );
}

export default SongCard;
