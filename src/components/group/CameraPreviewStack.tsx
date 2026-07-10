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

      if (stream) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        const playPromise = video.play?.();
        if (playPromise?.catch) playPromise.catch(() => {});
      } else if (stream === null) {
        // stream이 명시적으로 null일 때만 해제 — undefined(아직 미전달)면 기존 스트림 유지
        video.srcObject = null;
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
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={videoRef}
          className="group-studio-camera-video"
          autoPlay
          playsInline
          muted
          aria-label="Camera preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: fitMode === 'cover' ? 'cover' : 'contain',
            display: 'block',
            backgroundColor: '#000',
            // Safari에서 검은 화면으로 굳는 문제 방지 (mirror 유지 위해 scaleX(-1)와 함께 적용)
            WebkitTransform: 'scaleX(-1) translateZ(0)',
            transform: 'scaleX(-1) translateZ(0)',
          }}
        />
        <canvas
          ref={skeletonCanvasRef}
          className="group-studio-camera-skeleton-overlay"
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            backgroundColor: 'transparent',
          }}
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
