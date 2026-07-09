// @ts-nocheck
import React, { forwardRef, useEffect } from 'react';
import type { CameraFitMode } from '../../utils/cameraOverlayUtils';

export interface CameraPreviewStackProps {
  /** getUserMedia 스트림이 연결되는 비디오 (항상 1번 레이어) */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
  /** 스켈레톤 오버레이 전용 — 비디오 프레임을 그리지 않음 */
  skeletonCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isTracking?: boolean;
  cameraError?: string | null;
  showPlaceholder?: boolean;
  placeholderText?: string;
  fitMode?: CameraFitMode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Camera Layer Stack — Canvas 단독 출력 금지.
 *
 * Video (autoplay · playsInline · muted)
 *   ↓
 * Skeleton Overlay Canvas (투명, pointer-events: none)
 *   ↓
 * Feedback / Placeholder (children, z-index 3+)
 */
const CameraPreviewStack = forwardRef<HTMLDivElement, CameraPreviewStackProps>(
  function CameraPreviewStack({
    videoRef,
    stream,
    skeletonCanvasRef,
    isTracking = false,
    cameraError = null,
    showPlaceholder = false,
    placeholderText = '카메라 연결 중...',
    fitMode = 'contain',
    className = '',
    children = null,
  }, ref) {
    const fitClass = fitMode === 'cover'
      ? 'group-studio-camera-stack--cover'
      : 'group-studio-camera-stack--contain';

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return undefined;

      if (stream && video.srcObject !== stream) {
        video.srcObject = stream;
      } else if (stream === null && video.srcObject) {
        video.srcObject = null;
      }

      if (stream) {
        const playPromise = video.play?.();
        if (playPromise?.catch) playPromise.catch(() => {});
      }

      return () => {
        if (video.srcObject === stream) {
          video.srcObject = null;
        }
      };
    }, [videoRef, stream]);

    useEffect(() => {
      const canvas = skeletonCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, [skeletonCanvasRef, stream, isTracking]);

    return (
      <div
        ref={ref}
        className={`group-studio-camera-stack ${fitClass} ${className}`.trim()}
        data-camera-layer-stack="video-overlay"
      >
        <video
          ref={videoRef}
          className="group-studio-camera-video"
          autoPlay
          playsInline
          muted
          aria-label="Camera preview"
        />
        <canvas
          ref={skeletonCanvasRef}
          className="group-studio-camera-skeleton-overlay"
          aria-hidden
        />
        {showPlaceholder && !isTracking ? (
          <div className="group-studio-camera-placeholder">{placeholderText}</div>
        ) : null}
        {cameraError ? (
          <div className="group-studio-camera-error">{cameraError}</div>
        ) : null}
        {children}
      </div>
    );
  },
);

export default CameraPreviewStack;
