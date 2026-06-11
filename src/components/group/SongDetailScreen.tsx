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
import { searchYoutubeDance } from '../../services/groupStudioApi';
import { resolveSongDanceVideo } from '../../services/resolveSongDanceVideo';
import { buildDancePracticeQuery, isDancePracticeTitle, pickBestDancePracticeVideo } from '../../utils/dancePracticeVideo';
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
  const [candidates, setCandidates] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  useEffect(() => {
    if (!songId) return;
    setFavTick((t) => t + 1);
    setPracticeCount(getSongPracticeCount(songId));
    addRecentSong(songId);
  }, [songId]);

  useEffect(() => {
    if (!song) return undefined;
    let cancelled = false;
    setLoadingVideos(true);

    const loadVideos = async () => {
      try {
        const query = buildDancePracticeQuery(song);
        const [resolved, searchItems] = await Promise.all([
          resolveSongDanceVideo(song),
          searchYoutubeDance(query, 10).catch(() => []),
        ]);
        if (cancelled) return;

        const practiceItems = searchItems.filter((it) => isDancePracticeTitle(it.title));
        setCandidates(practiceItems);

        const best = resolved || pickBestDancePracticeVideo(practiceItems);
        if (best?.videoId) {
          setVideoId(best.videoId);
          setVideoTitle(best.title || '');
        }
      } finally {
        if (!cancelled) setLoadingVideos(false);
      }
    };

    loadVideos();
    return () => { cancelled = true; };
  }, [song?.id, song?.title, song?.groupId]);

  const handleSelectVideo = useCallback((item) => {
    if (!isDancePracticeTitle(item.title)) return;
    setVideoId(item.videoId);
    setVideoTitle(item.title || '');
    saveSongVideo(songId, {
      videoId: item.videoId,
      youtubeUrl: item.youtubeUrl,
      title: item.title,
      durationSec: item.durationSec,
      videoType: 'dance_practice',
    });
  }, [songId]);

  const handleStart = useCallback(async () => {
    if (song) {
      const resolved = await resolveSongDanceVideo(song);
      if (resolved?.videoId) {
        setVideoId(resolved.videoId);
        setVideoTitle(resolved.title || '');
      }
    }
    const latest = getSongVideo(songId);
    if (latest?.videoId) {
      onStart();
    }
  }, [song, songId, onStart]);

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
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 12px' }}>
            {t('groupStudio.songDetail.dancePracticeHint')}
          </p>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {loadingVideos ? t('groupStudio.songDetail.loadingDanceVideos') : t('groupStudio.songDetail.noDanceVideo')}
              </div>
            )}
          </div>

          {candidates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {candidates.map((item) => (
                <button
                  key={item.videoId}
                  type="button"
                  className="group-studio-search-row"
                  onClick={() => handleSelectVideo(item)}
                  style={{
                    border: videoId === item.videoId ? `1px solid ${song.albumColor}` : undefined,
                    background: videoId === item.videoId ? `${song.albumColor}22` : undefined,
                  }}
                >
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <div className="group-studio-search-thumb" style={{ width: 72, height: 40 }} />
                  )}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {item.channel} · {Math.floor((item.durationSec || 0) / 60)}:{String((item.durationSec || 0) % 60).padStart(2, '0')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
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
          disabled={loadingVideos && !videoId}
        >
          {t('groupStudio.songDetail.startBtn')}
        </button>
      </div>
    </div>
  );
}

export default SongDetailScreen;
