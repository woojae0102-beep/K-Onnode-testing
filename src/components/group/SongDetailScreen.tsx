// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSongById } from '../../data/groupStudioSongs';
import { GROUP_DATA } from '../../data/groupPracticeData';
import {
  getSongPracticeCount,
  isSongFavorite,
  toggleSongFavorite,
  addRecentSong,
} from '../../services/groupStudioStorage';
import '../../styles/group-studio.css';

export function SongDetailScreen({ songId, onStart, onBack }) {
  const { t } = useTranslation();
  const song = getSongById(songId);
  const group = song ? GROUP_DATA[song.groupId] : null;
  const [fav, setFav] = useState(false);
  const [practiceCount, setPracticeCount] = useState(0);

  useEffect(() => {
    if (!songId) return;
    setFav(isSongFavorite(songId));
    setPracticeCount(getSongPracticeCount(songId));
    addRecentSong(songId);
  }, [songId]);

  if (!song || !group) return null;

  const handleFav = () => {
    toggleSongFavorite(songId);
    setFav(isSongFavorite(songId));
  };

  const difficultyLabel = t(`groupStudio.songDetail.difficultyLevel.${song.difficulty}`, {
    defaultValue: String(song.difficulty),
  });

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        <button type="button" className="group-studio-back" onClick={onBack}>
          {t('groupStudio.home.back')}
        </button>

        <div className="group-studio-detail-hero">
          <div
            className="group-studio-detail-art"
            style={{
              background: `linear-gradient(145deg, ${song.albumColor}, ${song.albumColor2})`,
            }}
          />
          <div className="group-studio-detail-meta">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1>{song.title}</h1>
                <p>{group.nameKr} · {group.name}</p>
              </div>
              <button type="button" className="group-studio-fav-btn" onClick={handleFav}>
                {fav ? '★' : '☆'}
              </button>
            </div>
          </div>
        </div>

        <div className="group-studio-stats">
          <div className="group-studio-stat">
            {t('groupStudio.songDetail.bpm')}<strong>{song.bpm}</strong>
          </div>
          <div className="group-studio-stat">
            {t('groupStudio.songDetail.difficulty')}<strong>{difficultyLabel}</strong>
          </div>
          <div className="group-studio-stat">
            {t('groupStudio.songDetail.practiceCount')}
            <strong>{t('groupStudio.songDetail.practiceCountUnit', { count: practiceCount })}</strong>
          </div>
          <div className="group-studio-stat">
            {t('groupStudio.songDetail.members')}
            <strong>{t('groupStudio.songDetail.membersUnit', { count: group.memberCount })}</strong>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 28 }}>
          {t('groupStudio.songDetail.description', { count: group.memberCount - 1 })}
        </p>

        <button
          type="button"
          className="group-studio-start-btn"
          style={{
            background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})`,
            boxShadow: `0 0 32px ${song.albumColor}50`,
          }}
          onClick={onStart}
        >
          {t('groupStudio.songDetail.startBtn')}
        </button>
      </div>
    </div>
  );
}

export default SongDetailScreen;
