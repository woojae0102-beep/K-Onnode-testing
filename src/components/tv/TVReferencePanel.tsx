// @ts-nocheck
import React, { useState } from 'react';
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

export default function TVReferencePanel({
  mode,
  embedUrl,
  onEmbedUrlChange,
  playerRef,
  playbackRate = 1,
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');

  const handleLoad = () => {
    const embed = toEmbed(inputUrl);
    if (!embed) {
      setError('올바른 유튜브 URL을 입력해주세요.');
      return;
    }
    setError('');
    onEmbedUrlChange?.(embed);
  };

  const label = mode === 'vocal' ? '연습 곡 / MR 영상' : '연습 안무 영상';

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
            {error ? <p className="tv-reference-error">{error}</p> : null}
          </div>
        ) : (
          <YouTubeTVPlayer
            ref={playerRef}
            embedUrl={embedUrl}
            playbackRate={playbackRate}
            autoplay={false}
            className="tv-reference-player"
          />
        )}
      </div>
    </div>
  );
}
