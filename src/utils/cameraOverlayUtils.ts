// @ts-nocheck
/**
 * Camera panel — video object-fit:cover 기준 Skeleton Overlay 좌표 변환.
 * Video → Skeleton Overlay → Feedback (canvas는 video 위 레이어)
 */

import type { StageFitContainView } from './stageFitContain';

type JointLike = { x: number; y: number; visibility?: number; confidence?: number };

/** object-fit: cover — MediaPipe 0~1 좌표 → display canvas pixel */
export function buildCameraCoverView(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
): StageFitContainView {
  const vw = Math.max(1, videoWidth);
  const vh = Math.max(1, videoHeight);
  const dw = Math.max(1, displayWidth);
  const dh = Math.max(1, displayHeight);

  const videoAspect = vw / vh;
  const displayAspect = dw / dh;

  let visibleW = 1;
  let visibleH = 1;
  let cropX = 0;
  let cropY = 0;

  if (videoAspect > displayAspect) {
    visibleW = displayAspect / videoAspect;
    cropX = (1 - visibleW) / 2;
  } else {
    visibleH = videoAspect / displayAspect;
    cropY = (1 - visibleH) / 2;
  }

  const mapPoint = (nx: number, ny: number) => ({
    x: ((nx - cropX) / visibleW) * dw,
    y: ((ny - cropY) / visibleH) * dh,
  });

  return {
    canvasWidth: dw,
    canvasHeight: dh,
    mapPoint,
    bbox: { minX: cropX, minY: cropY, maxX: cropX + visibleW, maxY: cropY + visibleH },
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

export interface CameraHealthStatus {
  getUserMediaOk: boolean;
  srcObjectSet: boolean;
  videoPlaying: boolean;
  videoWidth: number;
  videoHeight: number;
  error: string | null;
}

export async function verifyCameraPipeline(
  video: HTMLVideoElement | null | undefined,
): Promise<CameraHealthStatus> {
  const base: CameraHealthStatus = {
    getUserMediaOk: false,
    srcObjectSet: false,
    videoPlaying: false,
    videoWidth: 0,
    videoHeight: 0,
    error: null,
  };

  if (!video) {
    base.error = 'video element missing';
    return base;
  }

  const stream = video.srcObject as MediaStream | null;
  base.srcObjectSet = Boolean(stream && stream.getVideoTracks().length > 0);
  base.getUserMediaOk = base.srcObjectSet;

  if (!base.srcObjectSet) {
    base.error = 'video.srcObject not set';
    return base;
  }

  try {
    if (video.paused) {
      await video.play();
    }
    base.videoPlaying = !video.paused && !video.ended;
  } catch (err: any) {
    base.error = `video.play() failed: ${err?.message || err}`;
    return base;
  }

  base.videoWidth = video.videoWidth;
  base.videoHeight = video.videoHeight;

  if (base.videoWidth <= 0 || base.videoHeight <= 0) {
    if (!base.videoPlaying) {
      base.error = 'video dimensions not ready';
    }
  }

  return base;
}

export function drawCameraSkeletonOverlay(
  ctx: CanvasRenderingContext2D,
  joints: Record<string, JointLike>,
  view: StageFitContainView,
  connections: Array<[string, string]>,
  options: {
    boneWidth?: number;
    jointRadius?: number;
    glowBlur?: number;
    colorForJoint?: (name: string) => string;
    defaultColor?: string;
  } = {},
) {
  const boneWidth = options.boneWidth ?? 5;
  const jointRadius = options.jointRadius ?? 7;
  const glowBlur = options.glowBlur ?? 14;
  const defaultColor = options.defaultColor ?? '#00FF88';
  const colorFor = options.colorForJoint || (() => defaultColor);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  connections.forEach(([startName, endName]) => {
    const start = joints[startName];
    const end = joints[endName];
    if (!start || !end) return;

    const color = colorFor(startName);
    const startPx = view.mapPoint(start.x, start.y);
    const endPx = view.mapPoint(end.x, end.y);

    ctx.shadowColor = color;
    ctx.shadowBlur = glowBlur;
    ctx.strokeStyle = color;
    ctx.lineWidth = boneWidth;
    ctx.beginPath();
    ctx.moveTo(startPx.x, startPx.y);
    ctx.lineTo(endPx.x, endPx.y);
    ctx.stroke();
  });

  Object.entries(joints).forEach(([name, joint]) => {
    if (!joint) return;
    const color = colorFor(name);
    const px = view.mapPoint(joint.x, joint.y);

    ctx.shadowColor = color;
    ctx.shadowBlur = glowBlur * 1.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px.x, px.y, jointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = glowBlur * 0.6;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(px.x, px.y, jointRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

export default buildCameraCoverView;
