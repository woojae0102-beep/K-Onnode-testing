// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSongById } from '../../data/groupStudioSongs';
import { getGroupData } from '../../data/groupPracticeData';
import { useGroupChoreoExtract } from '../../hooks/useGroupChoreoExtract';
import { getSongVideo, saveSongVideo } from '../../services/groupStudioStorage';
import { buildDanceDatabase, saveDanceDatabase, loadDanceDatabase } from '../../services/dance/DanceDatabaseService';
import MemberAutoDetect from './MemberAutoDetect';
import { extractYoutubeVideoId } from '../../utils/dancePracticeVideo';
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
  const group = song ? getGroupData(song.groupId) : null;
  const member = group?.members.find((m) => m.id === memberId);

  const videoRef = useRef(null);
  const ytRef = useRef(null);
  const fileInputRef = useRef(null);

  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [cacheReady, setCacheReady] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [phase, setPhase] = useState('upload');
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [pendingMeta, setPendingMeta] = useState(null);

  const {
    isExtracting,
    progress,
    step,
    error,
    fromCache,
    cancel,
    loadFromCache,
    extractChoreo,
    extractAnalysis,
  } = useGroupChoreoExtract();

  useEffect(() => {
    if (!songId || !song) return undefined;
    setVideoId('');
    setVideoTitle('');
    setUrlInput('');
    setUrlError('');
    const saved = getSongVideo(songId);
    if (saved?.videoId && saved.videoType === 'user_youtube') {
      setVideoId(saved.videoId);
      setVideoTitle(saved.title || '');
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
    const result = await extractAnalysis({
      songId,
      groupId: song.groupId,
      videoId,
      file,
      videoRef,
      youtubePlayerRef: ytRef,
    });
    if (result?.analysisResult) {
      setPendingAnalysis(result.analysisResult);
      setPendingMeta({ videoId: result.videoId, fileName: file?.name });
      setPhase('confirm');
    }
  }, [song, group, extractAnalysis, songId, videoId]);

  const handleUseCache = useCallback(async () => {
    const danceDb = await loadDanceDatabase(song.groupId, songId, videoId);
    if (danceDb?.skeletonFrames?.length) {
      onComplete(danceDb.skeletonFrames, {
        videoId,
        durationSec: danceDb.durationSec || song?.duration,
        fromCache: true,
        danceDatabase: danceDb,
      });
      return;
    }
    const frames = await loadFromCache(songId, videoId);
    if (frames?.length) {
      onComplete(frames, { videoId, durationSec: frames[frames.length - 1]?.timestamp || song?.duration, fromCache: true });
    }
  }, [loadFromCache, loadDanceDatabase, songId, videoId, onComplete, song]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) runExtract(file);
  }, [runExtract]);

  const handleYoutubeExtract = useCallback(async () => {
    if (!videoId) return;
    const result = await extractAnalysis({
      songId,
      groupId: song.groupId,
      videoId,
      file: null,
      videoRef,
      youtubePlayerRef: ytRef,
    });
    if (result?.analysisResult) {
      setPendingAnalysis(result.analysisResult);
      setPendingMeta({ videoId: result.videoId });
      setPhase('confirm');
    }
  }, [videoId, extractAnalysis, songId, song, videoRef]);

  const handleApplyUrl = useCallback(() => {
    const id = extractYoutubeVideoId(urlInput.trim());
    if (!id) {
      setUrlError(t('groupStudio.choreoExtract.invalidYoutubeUrl'));
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

  if (!song || !group || !member) return null;

  if (phase === 'confirm' && pendingAnalysis) {
    return (
      <MemberAutoDetect
        groupId={song.groupId}
        myMemberId={memberId}
        analysisResult={pendingAnalysis}
        onConfirm={async (trackToMemberMap) => {
          const danceDb = buildDanceDatabase({
            groupId: song.groupId,
            songId,
            userMemberId: memberId,
            analysisResult: pendingAnalysis,
            trackToMember: trackToMemberMap,
            videoId: pendingMeta?.videoId || videoId,
          });
          await saveDanceDatabase(danceDb);
          if (videoId) {
            saveSongVideo(songId, {
              videoId,
              youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
              title: videoTitle,
              videoType: 'user_youtube',
            });
          }
          onComplete(danceDb.skeletonFrames, {
            videoId: pendingMeta?.videoId || videoId,
            durationSec: danceDb.durationSec,
            danceDatabase: danceDb,
          });
        }}
        onRetry={() => {
          setPhase('upload');
          setPendingAnalysis(null);
          setPendingMeta(null);
        }}
      />
    );
  }

  const youtubeUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '0 16px', textAlign: 'center' }}>
              {t('groupStudio.choreoExtract.noVideo')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
            placeholder={t('groupStudio.choreoExtract.youtubeUrlPlaceholder')}
            style={{
              flex: 1,
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
            {t('groupStudio.choreoExtract.applyYoutubeUrl')}
          </button>
        </div>
        {urlError ? (
          <p style={{ fontSize: 12, color: '#FF6B6B', margin: '0 0 12px' }}>{urlError}</p>
        ) : null}

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
              <>
                <button
                  type="button"
                  className="group-studio-start-btn"
                  style={{ background: `linear-gradient(135deg, ${song.albumColor}, ${song.albumColor2})` }}
                  onClick={handleYoutubeExtract}
                >
                  {t('groupStudio.choreoExtract.extractYoutube')}
                </button>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
                  {t('groupStudio.choreoExtract.extractYoutubeHint')}
                </p>
              </>
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

        <video
          ref={videoRef}
          playsInline
          muted
          crossOrigin="anonymous"
          preload="auto"
          style={{
            position: 'fixed',
            width: 320,
            height: 180,
            opacity: 0,
            pointerEvents: 'none',
            left: 0,
            top: 0,
            zIndex: -1,
          }}
        />
      </div>
    </div>
  );
}

export default ChoreoExtractScreen;
