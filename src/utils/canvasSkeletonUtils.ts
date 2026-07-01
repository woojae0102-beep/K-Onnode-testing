// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';
import { SKELETON_CONNECTIONS } from '../types/groupPractice';

/** MediaPipe 0~1 정규화 좌표 → Canvas 픽셀 (letterbox/pillarbox 보정) */
export interface CanvasRenderConfig {
  videoWidth: number;
  videoHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

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
  // 추출된 스켈레톤은 visibility 필드가 없을 수 있음 → 그리기 허용
  if (v == null || !Number.isFinite(v)) return 1;
  return v;
}

/** 원본 영상 비율을 유지한 스켈레톤 그리기 */
export function drawAccurateSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: Record<string, JointLike>,
  color: string,
  memberName: string,
  config: CanvasRenderConfig,
  isEstimated = false,
) {
  ctx.save();

  if (isEstimated) {
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.5;
  } else {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  SKELETON_CONNECTIONS.forEach(([startName, endName]) => {
    const startJoint = joints[startName];
    const endJoint = joints[endName];
    if (!startJoint || !endJoint) return;
    if (jointConfidence(startJoint) < 0.2 || jointConfidence(endJoint) < 0.2) return;

    const startPx = normalizedToCanvas(startJoint.x, startJoint.y, config);
    const endPx = normalizedToCanvas(endJoint.x, endJoint.y, config);

    ctx.beginPath();
    ctx.moveTo(startPx.x, startPx.y);
    ctx.lineTo(endPx.x, endPx.y);
    ctx.stroke();
  });

  Object.values(joints).forEach((joint) => {
    if (!joint || jointConfidence(joint) < 0.2) return;
    const px = normalizedToCanvas(joint.x, joint.y, config);

    ctx.beginPath();
    ctx.arc(px.x, px.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur = 12;
    ctx.fill();
  });

  const nose = joints.nose;
  if (nose && jointConfidence(nose) > 0.2) {
    const nosePx = normalizedToCanvas(nose.x, nose.y, config);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(memberName, nosePx.x, nosePx.y - 16);
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
