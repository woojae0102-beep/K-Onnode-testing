// @ts-nocheck
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { clampPlaybackSpeed } from '../../utils/playbackSpeed';
import { extractYouTubeVideoId } from '../dance/YouTubePlayer';

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

const YouTubeTVPlayer = forwardRef(function YouTubeTVPlayer(
  { embedUrl, playbackRate = 1, autoplay = false, className = '' },
  ref,
) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const videoId = extractYouTubeVideoId(embedUrl);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo?.(),
    pause: () => playerRef.current?.pauseVideo?.(),
    seekTo: (sec) => playerRef.current?.seekTo?.(Math.max(0, sec), true),
    getCurrentTime: () => playerRef.current?.getCurrentTime?.() || 0,
    getDuration: () => playerRef.current?.getDuration?.() || 0,
    setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate?.(clampPlaybackSpeed(rate)),
    isReady: () => readyRef.current,
  }));

  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined;
    let cancelled = false;
    readyRef.current = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || !hostRef.current) return;
      playerRef.current?.destroy?.();
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          playsinline: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            event.target.setPlaybackRate(clampPlaybackSpeed(playbackRate));
            if (autoplay) event.target.playVideo();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, autoplay]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player?.setPlaybackRate) return;
    try {
      player.setPlaybackRate(clampPlaybackSpeed(playbackRate));
    } catch {
      /* not ready */
    }
  }, [playbackRate]);

  if (!videoId) {
    return <div className={`absolute inset-0 w-full h-full bg-black ${className}`} />;
  }

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden bg-black ${className}`}>
      <div ref={hostRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

export default YouTubeTVPlayer;
