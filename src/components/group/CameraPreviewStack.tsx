// @ts-nocheck
import React from 'react';
import type { CameraFitMode } from '../../utils/cameraOverlayUtils';

/**
 * Camera Layer Stack
 * Video → Skeleton Overlay → (Feedback는 부모 UI Layer)
 * 연습 모드: object-fit contain + letterbox
 */
export default function CameraPreviewStack({
  videoRef,
  skeletonCanvasRef,
  isTracking = false,
  cameraError = null,
  showPlaceholder = false,
  placeholderText = '카메라 연결 중...',
  fitMode = 'contain',
  className = '',
}) {
  const fitClass = fitMode === 'cover'
    ? 'group-studio-camera-stack--cover'
    : 'group-studio-camera-stack--contain';

  return (
    <div className={`group-studio-camera-stack ${fitClass} ${className}`.trim()}>
      <video
        ref={videoRef}
        className="group-studio-camera-video"
        autoPlay
        playsInline
        muted
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
    </div>
  );
}
