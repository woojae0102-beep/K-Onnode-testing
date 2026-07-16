// @ts-nocheck
import { drawAccurateSkeleton, buildRenderConfig } from '../../../utils/canvasSkeletonUtils';
import type { SkeletonDebugOverlayOptions } from '../types';
import type { TrackHistoryEntry } from '../types';
import { getSkeletonDebugTrackColor, hexToRgba } from '../skeletonDebugColors';
import { getTrackEventsAtFrame } from '../trackHistoryBuilder';
import type { PlaybackDrawSnapshot } from './skeletonPlaybackEngine';
import type { RenderInterpolatedSnapshot } from './skeletonTemporalInterpolator';

type DrawableSnapshot = RenderInterpolatedSnapshot | PlaybackDrawSnapshot;

export type CanvasLayoutCache = {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  bufferWidth: number;
  bufferHeight: number;
};

function computeBBox(joints: Record<string, { x: number; y: number }>) {
  const pts = Object.values(joints).filter((j) => Number.isFinite(j.x) && Number.isFinite(j.y));
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 0.02;
  return {
    minX: Math.max(0, Math.min(...xs) - pad),
    minY: Math.max(0, Math.min(...ys) - pad),
    maxX: Math.min(1, Math.max(...xs) + pad),
    maxY: Math.min(1, Math.max(...ys) + pad),
  };
}

function computeCenter(joints: Record<string, { x: number; y: number }>) {
  const lh = joints.left_hip;
  const rh = joints.right_hip;
  if (lh && rh) return { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  if (ls && rs) return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const nose = joints.nose;
  return nose ? { x: nose.x, y: nose.y } : null;
}

function normalizedToCanvasLocal(nx: number, ny: number, config: ReturnType<typeof buildRenderConfig>) {
  const videoAspect = config.videoWidth / config.videoHeight;
  const canvasAspect = config.canvasWidth / config.canvasHeight;
  let scaleX: number;
  let scaleY: number;
  let offsetX = 0;
  let offsetY = 0;
  if (videoAspect > canvasAspect) {
    scaleX = config.canvasWidth;
    scaleY = config.canvasWidth / videoAspect;
    offsetY = (config.canvasHeight - scaleY) / 2;
  } else {
    scaleY = config.canvasHeight;
    scaleX = config.canvasHeight * videoAspect;
    offsetX = (config.canvasWidth - scaleX) / 2;
  }
  return { x: nx * scaleX + offsetX, y: ny * scaleY + offsetY };
}

export function ensureCanvasLayout(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  cache: CanvasLayoutCache,
): CanvasLayoutCache {
  const dpr = window.devicePixelRatio || 1;
  const bufferWidth = Math.floor(cssWidth * dpr);
  const bufferHeight = Math.floor(cssHeight * dpr);
  if (
    cache.cssWidth !== cssWidth
    || cache.cssHeight !== cssHeight
    || cache.dpr !== dpr
    || cache.bufferWidth !== bufferWidth
    || cache.bufferHeight !== bufferHeight
  ) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    return { cssWidth, cssHeight, dpr, bufferWidth, bufferHeight };
  }
  return cache;
}

export function drawVideoBackgroundFit(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  videoWidth: number,
  videoHeight: number,
  cssWidth: number,
  cssHeight: number,
): void {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const vw = video.videoWidth || videoWidth || 1280;
  const vh = video.videoHeight || videoHeight || 720;
  const config = buildRenderConfig(vw, vh, cssWidth, cssHeight);
  const videoAspect = config.videoWidth / config.videoHeight;
  const canvasAspect = cssWidth / cssHeight;
  let drawW: number;
  let drawH: number;
  let offsetX: number;
  let offsetY: number;
  if (videoAspect > canvasAspect) {
    drawW = cssWidth;
    drawH = cssWidth / videoAspect;
    offsetX = 0;
    offsetY = (cssHeight - drawH) / 2;
  } else {
    drawH = cssHeight;
    drawW = cssHeight * videoAspect;
    offsetX = (cssWidth - drawW) / 2;
    offsetY = 0;
  }
  ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
}

export function drawPlaybackHud(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  opts: {
    mode: string;
    isPlaying: boolean;
    playbackTime: number;
    durationSec: number;
    renderStatus: string;
    timelineFrameCount: number;
  },
): void {
  const pad = 10;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(pad, pad, Math.min(cssWidth - pad * 2, 280), 52);
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = opts.isPlaying ? '#44FF88' : '#FFD700';
  ctx.fillText(
    opts.isPlaying ? '▶ PLAYBACK' : opts.mode === 'ANALYSIS_COMPLETE' ? '⏸ READY — ▶ Play' : opts.mode,
    pad + 8,
    pad + 16,
  );
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const dur = opts.durationSec > 0 ? opts.durationSec : 0;
  const timeLabel = dur > 0
    ? `${opts.playbackTime.toFixed(2)}s / ${dur.toFixed(1)}s`
    : `${opts.playbackTime.toFixed(2)}s`;
  ctx.fillText(timeLabel, pad + 8, pad + 32);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(
    `${opts.renderStatus} · timeline ${opts.timelineFrameCount}f`,
    pad + 8,
    pad + 46,
  );
  if (!opts.isPlaying && opts.mode === 'ANALYSIS_COMPLETE') {
    ctx.textAlign = 'center';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillText('▶ Play 버튼을 누르면 영상과 스켈레톤이 함께 재생됩니다', cssWidth / 2, cssHeight - 18);
  }
}

export function drawSkeletonRenderSnapshot(
  ctx: CanvasRenderingContext2D,
  snapshot: DrawableSnapshot,
  overlay: SkeletonDebugOverlayOptions,
  videoWidth: number,
  videoHeight: number,
  cssWidth: number,
  cssHeight: number,
  trackHistory: TrackHistoryEntry[],
  isExtracting: boolean,
  skipClear = false,
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!skipClear) ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (!snapshot.people.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(
      isExtracting ? '추출 중 — 스켈레톤 대기...' : 'No skeleton data',
      12,
      24,
    );
    return;
  }

  const config = buildRenderConfig(videoWidth || 1280, videoHeight || 720, cssWidth, cssHeight);
  const events = getTrackEventsAtFrame(trackHistory, snapshot.frameIndex);

  snapshot.people.forEach((person) => {
    const trackId = person.trackId;
    const color = overlay.trackColor ? getSkeletonDebugTrackColor(trackId) : '#FF1F8E';
    const isEstimated = Boolean(person.isEstimated);
    const isLost = events.lost.includes(trackId);
    const isRecovered = events.recovered.includes(trackId);
    const isCreated = events.created.includes(trackId);

    let strokeColor = color;
    if (overlay.lostTrack && isLost) strokeColor = '#FF4444';
    if (overlay.recoveredTrack && isRecovered) strokeColor = '#44FF88';
    if (overlay.recoveredTrack && isCreated) strokeColor = '#44AAFF';

    if (overlay.boundingBox) {
      const box = computeBBox(person.joints);
      if (box) {
        const tl = normalizedToCanvasLocal(box.minX, box.minY, config);
        const br = normalizedToCanvasLocal(box.maxX, box.maxY, config);
        ctx.strokeStyle = hexToRgba(strokeColor, 0.8);
        ctx.lineWidth = 2;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }
    }

    if (overlay.skeleton || overlay.bone) {
      const drawEstimatedLive = isEstimated && isExtracting;
      if (drawEstimatedLive) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([6, 4]);
        drawAccurateSkeleton(
          ctx,
          person.joints,
          hexToRgba(strokeColor, 0.75),
          overlay.trackId ? `T${trackId}` : '',
          config,
          true,
          { boneWidth: 2, jointRadius: 4 },
        );
        ctx.setLineDash([]);
        ctx.restore();
      } else {
        drawAccurateSkeleton(
          ctx,
          person.joints,
          strokeColor,
          overlay.trackId ? `T${trackId}` : '',
          config,
          isEstimated,
        );
      }
    }

    if (overlay.prediction && isEstimated) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([6, 4]);
      drawAccurateSkeleton(ctx, person.joints, '#AAAAAA', '', config, true, { boneWidth: 2, jointRadius: 4 });
      ctx.restore();
    }

    if (overlay.kalmanPrediction && isEstimated) {
      const center = computeCenter(person.joints);
      if (center) {
        const px = normalizedToCanvasLocal(center.x, center.y, config);
        ctx.beginPath();
        ctx.arc(px.x, px.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#88CCFF';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#88CCFF';
        ctx.font = '9px monospace';
        ctx.fillText('K', px.x + 12, px.y + 4);
      }
    }

    if (overlay.centerPoint) {
      const center = computeCenter(person.joints);
      if (center) {
        const px = normalizedToCanvasLocal(center.x, center.y, config);
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(px.x, px.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (overlay.velocity && snapshot.prevJointsByTrack.has(trackId)) {
      const prevJoints = snapshot.prevJointsByTrack.get(trackId);
      const prevCenter = computeCenter(prevJoints);
      const curCenter = computeCenter(person.joints);
      if (prevCenter && curCenter) {
        const p0 = normalizedToCanvasLocal(prevCenter.x, prevCenter.y, config);
        const p1 = normalizedToCanvasLocal(curCenter.x, curCenter.y, config);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - 8 * Math.cos(angle - 0.4), p1.y - 8 * Math.sin(angle - 0.4));
        ctx.lineTo(p1.x - 8 * Math.cos(angle + 0.4), p1.y - 8 * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();
      }
    }

    if (overlay.trackId || overlay.confidence) {
      const nose = person.joints.nose;
      if (nose) {
        const px = normalizedToCanvasLocal(nose.x, nose.y - 0.04, config);
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.fillStyle = strokeColor;
        const label = [
          overlay.trackId ? `#${trackId}` : '',
          overlay.confidence ? `${(person.confidence * 100).toFixed(0)}%` : '',
          isEstimated ? '(est)' : '',
        ].filter(Boolean).join(' ');
        ctx.fillText(label, px.x, px.y);
      }
    }

    if (overlay.jointName) {
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      Object.entries(person.joints).forEach(([name, joint]) => {
        const px = normalizedToCanvasLocal(joint.x, joint.y, config);
        ctx.fillText(name, px.x + 4, px.y - 4);
      });
    }
  });
}
