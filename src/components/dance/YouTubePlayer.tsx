// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { clampPlaybackSpeed } from '../../utils/playbackSpeed';

let ytApiPromise = null;

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[data-yt-iframe-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.ytIframeApi = '1';
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

export function extractYouTubeVideoId(url) {
  if (!url) return '';
  const match = String(url).match(/(?:v=|youtu\.be\/|\/embed\/|shorts\/)([\w-]{11})/);
  return match?.[1] || '';
}

export default function YouTubePlayer({ embedUrl, mirror = false, playbackRate = 1, className = '' }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const videoId = extractYouTubeVideoId(embedUrl);

  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined;

    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || !hostRef.current) return;

      playerRef.current?.destroy?.();
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          mute: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event) => {
            const rate = clampPlaybackSpeed(playbackRate);
            event.target.setPlaybackRate(rate);
            event.target.playVideo();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player?.setPlaybackRate) return;
    try {
      player.setPlaybackRate(clampPlaybackSpeed(playbackRate));
    } catch {
      /* player not ready */
    }
  }, [playbackRate]);

  if (!videoId) {
    return <div className={`bg-black ${className}`} />;
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
    >
      <div ref={hostRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
