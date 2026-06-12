// @ts-nocheck
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import YouTubeTVPlayer from './YouTubeTVPlayer';

function toEmbed(url) {
  if (!url) return '';
  const idMatch = url.match(/(?:v=|youtu\.be\/|\/embed\/|shorts\/)([\w-]{11})/);
  if (!idMatch) return '';
  const videoId = idMatch[1];
  let listId = '';
  try {
    const parsed = new URL(url);
    listId = parsed.searchParams.get('list') || '';
  } catch {
    const listMatch = url.match(/[?&]list=([\w-]+)/);
    listId = listMatch ? listMatch[1] : '';
  }
  const base = `https://www.youtube.com/embed/${videoId}`;
  return listId ? `${base}?list=${listId}` : base;
}

const LocalVideoPlayer = forwardRef(function LocalVideoPlayer({ src, className = '' }, ref) {
  const videoRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play?.(),
    pause: () => videoRef.current?.pause?.(),
    seekTo: (sec) => {
      if (videoRef.current) videoRef.current.currentTime = Math.max(0, sec);
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    getDuration: () => videoRef.current?.duration || 0,
    setPlaybackRate: (rate) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
    },
    isReady: () => Boolean(videoRef.current?.readyState >= 1),
  }));

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      className={`tv-reference-local-video ${className}`}
    />
  );
});

export default function TVReferencePanel({
  mode,
  embedUrl,
  onEmbedUrlChange,
  playerRef,
  playbackRate = 1,
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');
  const [sourceType, setSourceType] = useState('');
  const fileObjectUrlRef = useRef('');

  useEffect(() => () => {
    if (fileObjectUrlRef.current) URL.revokeObjectURL(fileObjectUrlRef.current);
  }, []);

  const handleLoad = () => {
    const embed = toEmbed(inputUrl);
    if (!embed) {
      setError('올바른 유튜브 URL을 입력해주세요.');
      return;
    }
    setError('');
    setSourceType('youtube');
    onEmbedUrlChange?.(embed, { source: 'youtube' });
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('video/')) {
      setError('영상 파일만 업로드할 수 있습니다.');
      return;
    }
    if (fileObjectUrlRef.current) URL.revokeObjectURL(fileObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    fileObjectUrlRef.current = objectUrl;
    setError('');
    setInputUrl('');
    setSourceType('upload');
    onEmbedUrlChange?.(objectUrl, { source: 'upload', title: file.name });
  };

  const handleReset = () => {
    if (fileObjectUrlRef.current) {
      URL.revokeObjectURL(fileObjectUrlRef.current);
      fileObjectUrlRef.current = '';
    }
    setInputUrl('');
    setError('');
    setSourceType('');
    onEmbedUrlChange?.('', { source: '' });
  };

  const label = mode === 'vocal' ? '연습 곡 / MR 영상' : '연습 안무 영상';
  const isLocalVideo = sourceType === 'upload' || embedUrl?.startsWith('blob:') || embedUrl?.startsWith('data:');

  return (
    <div className="tv-simple-panel tv-reference-panel">
      <div className="tv-panel-label">{label}</div>
      <div className="tv-reference-body">
        {!embedUrl ? (
          <div className="tv-reference-setup">
            <p className="tv-reference-setup-title">유튜브 URL을 넣고 연습 영상을 불러오세요</p>
            <div className="tv-reference-input-row">
              <input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
                placeholder="https://www.youtube.com/watch?v=..."
                className="tv-reference-input"
              />
              <button type="button" className="tv-reference-load-btn" onClick={handleLoad}>
                불러오기
              </button>
            </div>
            <label className="tv-reference-upload-btn">
              영상 파일 업로드
              <input type="file" accept="video/*" onChange={handleUpload} />
            </label>
            {error ? <p className="tv-reference-error">{error}</p> : null}
          </div>
        ) : isLocalVideo ? (
          <>
            <LocalVideoPlayer ref={playerRef} src={embedUrl} className="tv-reference-player" />
            <button type="button" className="tv-reference-change-btn" onClick={handleReset}>
              영상 변경
            </button>
          </>
        ) : (
          <>
            <YouTubeTVPlayer
              ref={playerRef}
              embedUrl={embedUrl}
              playbackRate={playbackRate}
              autoplay={false}
              className="tv-reference-player"
            />
            <button type="button" className="tv-reference-change-btn" onClick={handleReset}>
              영상 변경
            </button>
          </>
        )}
      </div>
    </div>
  );
}
