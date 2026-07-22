// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSongById } from '../../data/groupStudioSongs';
import { GROUP_DATA } from '../../data/groupPracticeData';
import {
  getSongPracticeCount,
  isSongFavorite,
  addRecentSong,
  getSongVideo,
  saveSongVideo,
} from '../../services/groupStudioStorage';
import { extractYoutubeVideoId } from '../../utils/dancePracticeVideo';
import YouTubeTVPlayer from '../tv/YouTubeTVPlayer';
import SongAlbumArt from './SongAlbumArt';
import SongFavoriteStar from './SongFavoriteStar';
import '../../styles/group-studio.css';

export function SongDetailScreen({ songId, onStart, onBack }) {
  const { t } = useTranslation();
  const song = getSongById(songId);
  const group = song ? GROUP_DATA[song.groupId] : null;
  const [favTick, setFavTick] = useState(0);
  const [practiceCount, setPracticeCount] = useState(0);
  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    if (!songId) return;
    setFavTick((n) => n + 1);
    setPracticeCount(getSongPracticeCount(songId));
    addRecentSong(songId);
    setVideoId('');
    setVideoTitle('');
    setUrlInput('');
    setUrlError('');

    const saved = getSongVideo(songId);
    if (saved?.videoId && saved.videoType === 'user_youtube') {
      setVideoId(saved.videoId);
      setVideoTitle(saved.title || '');
    }
  }, [songId]);

  const handleApplyUrl = useCallback(() => {
    const id = extractYoutubeVideoId(urlInput.trim());
    if (!id) {
      setUrlError(t('groupStudio.songDetail.invalidYoutubeUrl'));
      return;
    }
    setUrlError('');
    setVideoId(id);
    setVideoTitle('');
    saveSongVideo(songId, {
      videoId: id,
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
      title: '',
      videoType: 'user_youtube',
    });
  }, [urlInput, songId, t]);

  const handleStart = useCallback(() => {
    if (videoId) {
      saveSongVideo(songId, {
        videoId,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoTitle,
        videoType: 'user_youtube',
      });
    }
    onStart();
  }, [videoId, videoTitle, songId, onStart]);

  if (!song || !group) return null;

  const youtubeUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';

  const difficultyLabel = t(`groupStudio.songDetail.difficultyLevel.${song.difficulty}`, {
    defaultValue: String(song.difficulty),
  });

  const durationMin = Math.floor(song.duration / 60);
  const durationSec = song.duration % 60;
  const favoriteIds = useMemo(() => (isSongFavorite(songId) ? [songId] : []), [songId, favTick]);

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        <button type="button" className="group-studio-back" onClick={onBack}>
          {t('groupStudio.home.back')}
        </button>

        <div className="group-studio-detail-hero">
          <div className="group-studio-detail-art-wrap">
            <SongAlbumArt song={song} size={200} showGroupLabel={false} className="group-studio-detail-art" />
          </div>
          <div className="group-studio-detail-meta">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h1>{song.title}</h1>
                <p>{group.nameKr} · {group.name}</p>
              </div>
              <SongFavoriteStar
                songId={songId}
                favoriteIds={favoriteIds}
                onFavoriteChange={() => setFavTick((n) => n + 1)}
                className="group-studio-fav-btn"
                size="inline"
              />
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
            {t('groupStudio.songDetail.duration')}
            <strong>{t('groupStudio.songDetail.durationUnit', { min: durationMin, sec: String(durationSec).padStart(2, '0') })}</strong>
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

        <section style={{ marginBottom: 24 }}>
          <h2 className="group-studio-section-title">{t('groupStudio.songDetail.dancePracticeVideo')}</h2>
          <div
            style={{
              position: 'relative',
              aspectRatio: '16/9',
              borderRadius: 14,
              overflow: 'hidden',
              background: '#0a0a14',
              border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 12,
            }}
          >
            {youtubeUrl ? (
              <YouTubeTVPlayer embedUrl={youtubeUrl} autoplay={false} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '0 16px', textAlign: 'center' }}>
                {t('groupStudio.songDetail.noDanceVideo')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
              placeholder={t('groupStudio.songDetail.youtubeUrlPlaceholder')}
              style={{
                flex: '1 1 260px',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 13,
              }}
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})`,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {t('groupStudio.songDetail.applyYoutubeUrl')}
            </button>
          </div>
          {urlError ? (
            <p style={{ fontSize: 12, color: '#FF6B6B', margin: '0 0 12px' }}>{urlError}</p>
          ) : null}
        </section>

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
          onClick={handleStart}
        >
          {t('groupStudio.songDetail.startBtn')}
        </button>
        {!videoId ? (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>
            {t('groupStudio.songDetail.startWithoutVideoHint')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default SongDetailScreen;
