// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';
import { SKELETON_CONNECTIONS } from '../types/groupPractice';
import type { StageFitContainView } from './stageFitContain';

/** MediaPipe 0~1 정규화 좌표 → Canvas 픽셀 (letterbox/pillarbox 보정) */
export interface CanvasRenderConfig {
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SkeletonDrawStyle {
  boneWidth?: number;
  jointRadius?: number;
  glowBlur?: number;
  labelFont?: string;
}

const DEFAULT_STYLE: Required<SkeletonDrawStyle> = {
  boneWidth: 4.5,
  jointRadius: 6.5,
  glowBlur: 12,
  labelFont: 'bold 12px Inter, sans-serif',
};

export function normalizedToCanvas(
  nx: number,
  ny: number,
  config: CanvasRenderConfig,
): { x: number; y: number } {
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

  return {
    x: nx * scaleX + offsetX,
    y: ny * scaleY + offsetY,
  };
}

type JointLike = { x: number; y: number; confidence?: number; visibility?: number };

function jointConfidence(joint: JointLike | undefined): number {
  if (!joint) return 0;
  const v = joint.confidence ?? joint.visibility;
  if (v == null || !Number.isFinite(v)) return 1;
  return v;
}

function mapJoint(
  joint: JointLike,
  view: StageFitContainView | CanvasRenderConfig,
): { x: number; y: number } {
  if ('mapPoint' in view && typeof view.mapPoint === 'function') {
    return view.mapPoint(joint.x, joint.y);
  }
  return normalizedToCanvas(joint.x, joint.y, view as CanvasRenderConfig);
}

/** FitContain view 또는 legacy config로 스켈레톤 그리기 (Glow · AntiAlias · 두꺼운 Bone) */
export function drawAccurateSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: Record<string, JointLike>,
  color: string,
  memberName: string,
  view: StageFitContainView | CanvasRenderConfig,
  isEstimated = false,
  style: SkeletonDrawStyle = {},
) {
  const s = { ...DEFAULT_STYLE, ...style };
  const boneWidth = s.boneWidth + (isEstimated ? -1 : 0);
  const jointRadius = s.jointRadius + (isEstimated ? -1.5 : 0);

  ctx.save();

  if (isEstimated) {
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.55;
  } else {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  SKELETON_CONNECTIONS.forEach(([startName, endName]) => {
    const startJoint = joints[startName];
    const endJoint = joints[endName];
    if (!startJoint || !endJoint) return;
    if (jointConfidence(startJoint) < 0.2 || jointConfidence(endJoint) < 0.2) return;

    const startPx = mapJoint(startJoint, view);
    const endPx = mapJoint(endJoint, view);

    ctx.shadowColor = color;
    ctx.shadowBlur = s.glowBlur;
    ctx.strokeStyle = color;
    ctx.lineWidth = boneWidth;
    ctx.beginPath();
    ctx.moveTo(startPx.x, startPx.y);
    ctx.lineTo(endPx.x, endPx.y);
    ctx.stroke();
  });

  Object.values(joints).forEach((joint) => {
    if (!joint || jointConfidence(joint) < 0.2) return;
    const px = mapJoint(joint, view);

    ctx.shadowColor = color;
    ctx.shadowBlur = s.glowBlur * 1.15;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px.x, px.y, jointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = s.glowBlur * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(px.x, px.y, jointRadius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  });

  const nose = joints.nose;
  if (nose && jointConfidence(nose) > 0.2) {
    const nosePx = mapJoint(nose, view);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = s.labelFont;
    ctx.textAlign = 'center';
    ctx.fillText(memberName, nosePx.x, nosePx.y - 18);
  }

  ctx.restore();
}

/** 컨테이너 안에서 원본 비율을 유지하는 렌더 크기 계산 */
export function computeAspectFitSize(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
): { width: number; height: number } {
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  if (videoAspect > containerAspect) {
    return { width: containerWidth, height: containerWidth / videoAspect };
  }
  return { width: containerHeight * videoAspect, height: containerHeight };
}

export function buildRenderConfig(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): CanvasRenderConfig {
  return { videoWidth, videoHeight, canvasWidth, canvasHeight };
}

export default normalizedToCanvas;
