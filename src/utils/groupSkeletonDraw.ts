// @ts-nocheck
import { SKELETON_CONNECTIONS } from '../types/groupPractice';
import {
  buildRenderConfig,
  drawAccurateSkeleton,
  normalizedToCanvas,
} from './canvasSkeletonUtils';

export { normalizedToCanvas, drawAccurateSkeleton, buildRenderConfig };
export type { CanvasRenderConfig } from './canvasSkeletonUtils';

export function drawStageBackground(ctx, width, height) {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, height * 0.8, 0, height);
  gradient.addColorStop(0, 'rgba(255,31,142,0.05)');
  gradient.addColorStop(1, 'rgba(255,31,142,0.15)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.8, width, height * 0.2);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.7);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

export function drawGhostSlot(ctx, pos, color, label = 'YOUR SLOT') {
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 70);
  gradient.addColorStop(0, `${color}30`);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, pos.x, pos.y - 56);
  ctx.fillStyle = `${color}88`;
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillText('👻', pos.x, pos.y + 6);
  ctx.restore();
}

export function drawMySpot(ctx, pos, color) {
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = `${color}88`;
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOU', pos.x, pos.y + 4);

  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 60);
  gradient.addColorStop(0, `${color}20`);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 60, 0, Math.PI * 2);
  ctx.fill();
}

export function drawAIAvatar(ctx, joints, color, memberName, canvas, renderConfig = null, isEstimated = false) {
  const logicalW = canvas._logicalWidth ?? canvas.width;
  const logicalH = canvas._logicalHeight ?? canvas.height;

  const config =
    renderConfig ||
    buildRenderConfig(
      canvas._videoWidth || logicalW,
      canvas._videoHeight || logicalH,
      logicalW,
      logicalH,
    );

  drawAccurateSkeleton(ctx, joints, color, memberName, config, isEstimated);
}

export function drawUserSkeleton(ctx, joints, color, canvas, anchorX, anchorY) {
  const logicalW = canvas._logicalWidth ?? canvas.width;
  const logicalH = canvas._logicalHeight ?? canvas.height;
  const videoW = canvas._videoWidth || logicalW;
  const videoH = canvas._videoHeight || logicalH;
  const config = buildRenderConfig(videoW, videoH, logicalW, logicalH);

  const scaledJoints = {};
  Object.entries(joints).forEach(([name, joint]) => {
    scaledJoints[name] = {
      x: anchorX + (joint.x - 0.5) * 0.2,
      y: anchorY + (joint.y - 0.5) * 0.3,
      visibility: joint.visibility,
    };
  });

  drawAccurateSkeleton(ctx, scaledJoints, color, 'YOU', config, false);
}
