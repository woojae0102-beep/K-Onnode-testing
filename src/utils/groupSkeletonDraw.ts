// @ts-nocheck
import {
  buildRenderConfig,
  drawAccurateSkeleton,
  normalizedToCanvas,
} from './canvasSkeletonUtils';
import {
  buildSkeletonRenderTransform,
  type SkeletonRenderTransform,
} from './SkeletonRenderTransform';

export { normalizedToCanvas, drawAccurateSkeleton, buildRenderConfig };
export type { CanvasRenderConfig } from './canvasSkeletonUtils';
export type { SkeletonRenderTransform as StageFitContainView } from './SkeletonRenderTransform';

function mapLiveJointsToStageAnchor(
  joints: Record<string, { x: number; y: number }>,
  anchorX: number,
  anchorY: number,
  spreadX = 0.22,
  spreadY = 0.32,
) {
  const out: Record<string, { x: number; y: number }> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    if (!joint) return;
    out[name] = {
      x: anchorX + (joint.x - 0.5) * spreadX,
      y: anchorY + (joint.y - 0.5) * spreadY,
    };
  });
  return out;
}

export function drawStageBackground(ctx, width, height) {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, height * 0.82, 0, height);
  gradient.addColorStop(0, 'rgba(255,31,142,0.04)');
  gradient.addColorStop(1, 'rgba(124,58,237,0.18)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);

  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.72);
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

export function drawGhostSlotNormalized(ctx, anchorX, anchorY, color, label, view) {
  const pos = view.mapPoint(anchorX, anchorY);
  drawGhostSlot(ctx, pos, color, label);
}

export function drawAIAvatar(
  ctx,
  joints,
  color,
  memberName,
  canvas,
  view: SkeletonRenderTransform | null = null,
  isEstimated = false,
) {
  const logicalW = canvas._logicalWidth ?? canvas.width;
  const logicalH = canvas._logicalHeight ?? canvas.height;

  const renderView =
    view ||
    buildRenderConfig(
      canvas._videoWidth || logicalW,
      canvas._videoHeight || logicalH,
      logicalW,
      logicalH,
    );

  drawAccurateSkeleton(ctx, joints, color, memberName, renderView, isEstimated, {
    boneWidth: 5,
    jointRadius: 7,
    glowBlur: 14,
  });
}

export function drawUserSkeleton(ctx, joints, color, canvas, anchorX, anchorY, view = null) {
  const logicalW = canvas._logicalWidth ?? canvas.width;
  const logicalH = canvas._logicalHeight ?? canvas.height;

  const stageJoints = mapLiveJointsToStageAnchor(joints, anchorX, anchorY);
  const renderView =
    view ||
    buildRenderConfig(
      canvas._videoWidth || logicalW,
      canvas._videoHeight || logicalH,
      logicalW,
      logicalH,
    );

  drawAccurateSkeleton(ctx, stageJoints, color, 'YOU', renderView, false, {
    boneWidth: 5.5,
    jointRadius: 7.5,
    glowBlur: 16,
  });
}

export interface StageFrameRenderInput {
  aiMembers: Array<{
    joints: Record<string, { x: number; y: number }>;
    color: string;
    name: string;
    isEstimated?: boolean;
  }>;
  userJoints?: Record<string, { x: number; y: number }> | null;
  userColor?: string;
  userAnchor?: { x: number; y: number };
  ghostAnchor?: { x: number; y: number; color: string; label: string } | null;
}

/** Stage 렌더: BBox → Padding → Auto Scale/Center → FitContain → Canvas Render */
export function renderStageFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: StageFrameRenderInput,
) {
  const logicalW = canvas._logicalWidth ?? canvas.width;
  const logicalH = canvas._logicalHeight ?? canvas.height;
  if (!logicalW || !logicalH) return null;

  drawStageBackground(ctx, logicalW, logicalH);

  const jointSets = input.aiMembers.map((m) => m.joints).filter(Boolean);
  const extraPoints: Array<{ x: number; y: number }> = [];

  if (input.ghostAnchor) {
    extraPoints.push({ x: input.ghostAnchor.x, y: input.ghostAnchor.y });
  }
  if (input.userAnchor) {
    extraPoints.push({ x: input.userAnchor.x, y: input.userAnchor.y });
  }
  if (input.userJoints && input.userAnchor) {
    jointSets.push(mapLiveJointsToStageAnchor(
      input.userJoints,
      input.userAnchor.x,
      input.userAnchor.y,
    ));
  }

  const view = buildSkeletonRenderTransform(jointSets, logicalW, logicalH, {
    extraPoints,
    paddingRatio: 0.12,
  });

  if (input.ghostAnchor) {
    drawGhostSlotNormalized(
      ctx,
      input.ghostAnchor.x,
      input.ghostAnchor.y,
      input.ghostAnchor.color,
      input.ghostAnchor.label,
      view,
    );
  }

  input.aiMembers.forEach((member) => {
    if (!member.joints || !Object.keys(member.joints).length) return;
    drawAIAvatar(ctx, member.joints, member.color, member.name, canvas, view, member.isEstimated);
  });

  if (input.userJoints && input.userColor && input.userAnchor) {
    drawUserSkeleton(
      ctx,
      input.userJoints,
      input.userColor,
      canvas,
      input.userAnchor.x,
      input.userAnchor.y,
      view,
    );
  }

  return view;
}
