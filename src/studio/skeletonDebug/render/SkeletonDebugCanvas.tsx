// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import type { SkeletonTimelineStore } from './skeletonTimelineStore';
import type { SkeletonDebugOverlayOptions } from '../types';
import type { TrackHistoryEntry } from '../types';
import {
  buildPlaybackSnapshot,
  type SkeletonPlaybackMode,
} from './skeletonPlaybackEngine';
import {
  drawPlaybackHud,
  drawSkeletonRenderSnapshot,
  drawVideoBackgroundFit,
  ensureCanvasLayout,
} from './skeletonCanvasDraw';

export type SkeletonDebugCanvasProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timelineStore: SkeletonTimelineStore;
  overlayRef: React.RefObject<SkeletonDebugOverlayOptions>;
  trackHistory: TrackHistoryEntry[];
  playbackMode: SkeletonPlaybackMode;
  isPlaying?: boolean;
  showVideoBackground?: boolean;
  durationSec?: number;
  fallbackVideoTimeRef?: React.RefObject<number>;
  videoFps?: number;
  onRenderFrameIndex?: (frameIndex: number, playbackTime: number) => void;
  className?: string;
};

/**
 * PHASE 2 Playback — 저장된 SkeletonFrame[] + previewVideo.currentTime 만 사용.
 * ANALYZING 중 skeleton 렌더 비활성.
 */
export function SkeletonDebugCanvas({
  videoRef,
  timelineStore,
  overlayRef,
  trackHistory,
  playbackMode,
  isPlaying = false,
  showVideoBackground = false,
  durationSec = 0,
  fallbackVideoTimeRef,
  videoFps = 0,
  onRenderFrameIndex,
  className,
}: SkeletonDebugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastDrawPerfRef = useRef(performance.now());
  const layoutCacheRef = useRef({ cssWidth: 0, cssHeight: 0, dpr: 1, bufferWidth: 0, bufferHeight: 0 });
  const lastUiNotifyRef = useRef(0);
  const overlayRefStable = overlayRef;
  const onNotifyRef = useRef(onRenderFrameIndex);
  onNotifyRef.current = onRenderFrameIndex;
  const trackHistoryRef = useRef(trackHistory);
  const playbackModeRef = useRef(playbackMode);
  const isPlayingRef = useRef(isPlaying);
  const showVideoRef = useRef(showVideoBackground);
  const durationRef = useRef(durationSec);
  trackHistoryRef.current = trackHistory;
  playbackModeRef.current = playbackMode;
  isPlayingRef.current = isPlaying;
  showVideoRef.current = showVideoBackground;
  durationRef.current = durationSec;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    let running = true;
    let rafId: number | null = null;
    let rvfcActive = false;

    const paint = (now: number, mediaTime?: number) => {
      if (!running) return;

      const previewVideo = videoRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const frameStart = performance.now();
      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      layoutCacheRef.current = ensureCanvasLayout(canvas, rect.width, rect.height, layoutCacheRef.current);

      const mode = playbackModeRef.current;
      const playbackTime = Number.isFinite(mediaTime)
        ? mediaTime
        : (previewVideo?.currentTime ?? fallbackVideoTimeRef?.current ?? 0);
      const videoTime = playbackTime;

      const overlay = overlayRefStable.current;
      const timeline = timelineStore.getTimeline();
      const snapshot = buildPlaybackSnapshot(timeline, playbackTime, overlay, mode);

      const { cssWidth, cssHeight } = layoutCacheRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mode === 'ANALYZING' || snapshot.renderStatus === 'ANALYZING_DISABLED') {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('분석 중 — Skeleton Playback은 분석 완료 후 활성화', cssWidth / 2, cssHeight / 2 - 8);
        ctx.fillStyle = 'rgba(255,31,142,0.75)';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText('PHASE 1: ANALYSIS (MediaPipe / Worker)', cssWidth / 2, cssHeight / 2 + 14);
      } else if (snapshot.renderStatus === 'NO_DATA') {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Skeleton Timeline 없음', cssWidth / 2, cssHeight / 2);
      } else {
        const vw = timelineStore.videoWidth;
        const vh = timelineStore.videoHeight;
        if (showVideoRef.current && previewVideo) {
          drawVideoBackgroundFit(ctx, previewVideo, vw, vh, cssWidth, cssHeight);
        }
        drawSkeletonRenderSnapshot(
          ctx,
          snapshot,
          overlay,
          vw,
          vh,
          cssWidth,
          cssHeight,
          trackHistoryRef.current,
          false,
          showVideoRef.current && Boolean(previewVideo),
        );
        drawPlaybackHud(ctx, cssWidth, cssHeight, {
          mode,
          isPlaying: isPlayingRef.current,
          playbackTime,
          durationSec: durationRef.current,
          renderStatus: snapshot.renderStatus,
          timelineFrameCount: timeline?.frames.length ?? 0,
        });
      }

      timelineStore.recordPlaybackTick({
        frameTimeMs: performance.now() - frameStart,
        playbackTime,
        videoTime,
        videoFps,
        playbackMode: mode,
        renderStatus: snapshot.renderStatus,
        previousFrameTime: snapshot.state.previousFrameTime,
        nextFrameTime: snapshot.state.nextFrameTime,
        interpolationAlpha: snapshot.state.interpolationAlpha,
        frameGapSec: snapshot.state.frameGapSec,
        skeletonDataFps: snapshot.state.skeletonDataFps,
        playbackSource: snapshot.state.playbackSource,
      });

      lastDrawPerfRef.current = frameStart;

      if (onNotifyRef.current && now - lastUiNotifyRef.current > 100) {
        lastUiNotifyRef.current = now;
        onNotifyRef.current(snapshot.frameIndex, playbackTime);
      }
    };

    const schedule = () => {
      if (!running) return;
      const previewVideo = videoRef.current;
      const shouldUseRvfc = Boolean(
        previewVideo
        && isPlayingRef.current
        && playbackModeRef.current !== 'ANALYZING'
        && !previewVideo.paused
        && typeof previewVideo.requestVideoFrameCallback === 'function',
      );

      if (shouldUseRvfc && previewVideo) {
        rvfcActive = true;
        previewVideo.requestVideoFrameCallback((now, metadata) => {
          rvfcActive = false;
          paint(now, metadata.mediaTime);
          schedule();
        });
        return;
      }

      rvfcActive = false;
      rafId = requestAnimationFrame((now) => {
        paint(now);
        schedule();
      });
    };

    schedule();

    return () => {
      running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      rvfcActive = false;
    };
  }, [videoRef, timelineStore, overlayRefStable, fallbackVideoTimeRef, videoFps, playbackMode, isPlaying, showVideoBackground, durationSec]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      layoutCacheRef.current = { cssWidth: 0, cssHeight: 0, dpr: 1, bufferWidth: 0, bufferHeight: 0 };
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#0a0a12',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

export default SkeletonDebugCanvas;
