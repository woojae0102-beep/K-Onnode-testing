// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSongById } from '../../data/groupStudioSongs';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useGroupChoreoExtract } from '../../hooks/useGroupChoreoExtract';
import { getSongVideo, saveSongVideo } from '../../services/groupStudioStorage';
import { fetchVideoMetadata } from '../../services/groupStudioApi';
import YouTubeTVPlayer from '../tv/YouTubeTVPlayer';
import '../../styles/group-studio.css';

export function ChoreoExtractScreen({
  songId,
  memberId,
  onComplete,
  onBack,
}) {
  const { t } = useTranslation();
  const song = getSongById(songId);
  const group = song ? GROUP_DATA[song.groupId] : null;
  const member = group?.members.find((m) => m.id === memberId);

  const videoRef = useRef(null);
  const ytRef = useRef(null);
  const fileInputRef = useRef(null);

  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [cacheReady, setCacheReady] = useState(false);

  const {
    isExtracting,
    progress,
    step,
    error,
    fromCache,
    cancel,
    loadFromCache,
    extractChoreo,
  } = useGroupChoreoExtract();

  useEffect(() => {
    if (!songId) return;
    const saved = getSongVideo(songId);
    if (saved?.videoId) {
      setVideoId(saved.videoId);
      setVideoTitle(saved.title || '');
    } else if (song?.youtubeUrl) {
      const match = song.youtubeUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
      if (match) setVideoId(match[1]);
    }
  }, [songId, song]);

  useEffect(() => {
    if (!videoId || !songId) {
      setCacheReady(false);
      return;
    }
    loadFromCache(songId, videoId).then((frames) => {
      setCacheReady(!!frames?.length);
    });
  }, [videoId, songId, loadFromCache]);

  const runExtract = useCallback(async (file) => {
    if (!song || !group) return;
    const frames = await extractChoreo({
      songId,
      groupId: song.groupId,
      videoId,
      focusMemberId: memberId,
      file,
      videoRef,
    });
    if (frames?.length) {
      if (videoId) {
        saveSongVideo(songId, {
          videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          title: videoTitle,
        });
      }
      onComplete(frames, { videoId, durationSec: frames[frames.length - 1]?.timestamp || song.duration });
    }
  }, [song, group, extractChoreo, songId, videoId, memberId, videoTitle, onComplete]);

  const handleUseCache = useCallback(async () => {
    const frames = await loadFromCache(songId, videoId);
    if (frames?.length) {
      onComplete(frames, { videoId, durationSec: frames[frames.length - 1]?.timestamp || song?.duration, fromCache: true });
    }
  }, [loadFromCache, songId, videoId, onComplete, song]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) runExtract(file);
  }, [runExtract]);

  const handleYoutubeExtract = useCallback(() => {
    if (!videoId) return;
    runExtract(null);
  }, [videoId, runExtract]);

  useEffect(() => {
    if (!videoId || videoTitle) return;
    fetchVideoMetadata(videoId)
      .then((meta) => setVideoTitle(meta.title || ''))
      .catch(() => {});
  }, [videoId, videoTitle]);

  if (!song || !group || !member) return null;

  const youtubeUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : song.youtubeUrl;

  return (
    <div className="group-studio">
      <div className="group-studio-ambient" />
      <div className="group-studio-inner">
        <button type="button" className="group-studio-back" onClick={onBack}>
          {t('groupStudio.home.back')}
        </button>

        <header className="group-studio-header" style={{ marginBottom: 20 }}>
          <h1 className="group-studio-title" style={{ fontSize: 22 }}>
            {t('groupStudio.choreoExtract.title')}
          </h1>
          <p className="group-studio-subtitle">
            {t('groupStudio.choreoExtract.subtitle', { song: song.title, member: member.nameKr })}
          </p>
        </header>

        <div
          style={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#0a0a14',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 20,
          }}
        >
          {youtubeUrl ? (
            <YouTubeTVPlayer ref={ytRef} embedUrl={youtubeUrl} autoplay={false} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {t('groupStudio.choreoExtract.noVideo')}
            </div>
          )}
        </div>

        {videoTitle ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
            {videoTitle}
          </p>
        ) : null}

        {isExtracting ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${song.albumColor}, ${song.albumColor2})`, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{step}</p>
            <button type="button" onClick={cancel} style={{ marginTop: 12, background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>
              {t('groupStudio.choreoExtract.cancel')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {cacheReady ? (
              <button
                type="button"
                className="group-studio-start-btn"
                style={{ background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})` }}
                onClick={handleUseCache}
              >
                {t('groupStudio.choreoExtract.useCache')}
              </button>
            ) : null}

            {videoId ? (
              <button
                type="button"
                className="group-studio-start-btn"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                onClick={handleYoutubeExtract}
              >
                {t('groupStudio.choreoExtract.extractYoutube')}
              </button>
            ) : null}

            <button
              type="button"
              className="group-studio-start-btn"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('groupStudio.choreoExtract.uploadFile')}
            </button>
            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
        )}

        {error ? (
          <p style={{ fontSize: 13, color: '#FF6B6B', lineHeight: 1.6 }}>{error}</p>
        ) : null}

        {fromCache ? (
          <p style={{ fontSize: 12, color: '#00FF88' }}>{t('groupStudio.choreoExtract.cacheLoaded')}</p>
        ) : null}

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, marginTop: 16 }}>
          {t('groupStudio.choreoExtract.privacyNote')}
        </p>

        <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default ChoreoExtractScreen;
