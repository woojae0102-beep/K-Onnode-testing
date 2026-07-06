// @ts-nocheck
/**
 * Skeleton Viewport Transform — normalized joint → Canvas pixel.
 * Renderer는 반드시 projectToCanvas() 결과만 사용한다.
 */

export interface RenderJoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  confidence?: number;
}

export interface SkeletonBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SkeletonRenderTransform {
  canvasWidth: number;
  canvasHeight: number;
  bbox: SkeletonBBox;
  padding: number;
  scale: number;
  centerX: number;
  centerY: number;
  offsetX: number;
  offsetY: number;
  mapPoint: (nx: number, ny: number) => { x: number; y: number };
}

const MIN_BBOX = 0.06;

function jointUsable(j: RenderJoint | undefined, minConf = 0.12): boolean {
  if (!j || !Number.isFinite(j.x) || !Number.isFinite(j.y)) return false;
  const v = j.confidence ?? j.visibility;
  if (v == null || !Number.isFinite(v)) return true;
  return v >= minConf;
}

/** Joint 좌표 정리 (NaN 제거) */
export function normalizeSkeleton(
  joints: Record<string, RenderJoint> | null | undefined,
): Record<string, RenderJoint> {
  const out: Record<string, RenderJoint> = {};
  Object.entries(joints || {}).forEach(([name, j]) => {
    if (!j) return;
    out[name] = {
      x: Number(j.x) || 0,
      y: Number(j.y) || 0,
      z: Number(j.z) || 0,
      visibility: j.visibility ?? j.confidence ?? 1,
      confidence: j.confidence ?? j.visibility ?? 1,
    };
  });
  return out;
}

/** 모든 joint 순회 → min/max bbox */
export function computeSkeletonBBoxFromSets(
  jointSets: Array<Record<string, RenderJoint>>,
  extraPoints: Array<{ x: number; y: number }> = [],
): SkeletonBBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  jointSets.forEach((joints) => {
    Object.values(normalizeSkeleton(joints)).forEach((j) => {
      if (!jointUsable(j)) return;
      minX = Math.min(minX, j.x);
      minY = Math.min(minY, j.y);
      maxX = Math.max(maxX, j.x);
      maxY = Math.max(maxY, j.y);
      count += 1;
    });
  });

  extraPoints.forEach((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    count += 1;
  });

  if (count === 0 || !Number.isFinite(minX)) return null;

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < MIN_BBOX && h < MIN_BBOX) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const half = MIN_BBOX / 2;
    return { minX: cx - half, minY: cy - half, maxX: cx + half, maxY: cy + half };
  }
  return { minX, minY, maxX, maxY };
}

export function fitSkeleton(
  bbox: SkeletonBBox,
  canvasWidth: number,
  canvasHeight: number,
  paddingRatio: number,
): { scaleX: number; scaleY: number; drawW: number; drawH: number; content: SkeletonBBox } {
  const padX = (bbox.maxX - bbox.minX) * paddingRatio;
  const padY = (bbox.maxY - bbox.minY) * paddingRatio;
  const content: SkeletonBBox = {
    minX: Math.max(0, bbox.minX - padX),
    minY: Math.max(0, bbox.minY - padY),
    maxX: Math.min(1, bbox.maxX + padX),
    maxY: Math.min(1, bbox.maxY + padY),
  };

  const cw = Math.max(1, canvasWidth);
  const ch = Math.max(1, canvasHeight);
  const contentW = Math.max(content.maxX - content.minX, 0.01);
  const contentH = Math.max(content.maxY - content.minY, 0.01);
  const aspect = contentW / contentH;
  const canvasAspect = cw / ch;

  let drawW: number;
  let drawH: number;
  if (aspect > canvasAspect) {
    drawW = cw;
    drawH = cw / aspect;
  } else {
    drawH = ch;
    drawW = ch * aspect;
  }

  return {
    scaleX: drawW / contentW,
    scaleY: drawH / contentH,
    drawW,
    drawH,
    content,
  };
}

export function centerSkeleton(bbox: SkeletonBBox): { centerX: number; centerY: number } {
  return {
    centerX: (bbox.minX + bbox.maxX) / 2,
    centerY: (bbox.minY + bbox.maxY) / 2,
  };
}

export function scaleSkeleton(
  bbox: SkeletonBBox,
  canvasWidth: number,
  canvasHeight: number,
  paddingRatio: number,
): number {
  const fit = fitSkeleton(bbox, canvasWidth, canvasHeight, paddingRatio);
  return Math.min(fit.scaleX, fit.scaleY);
}

export function projectToCanvas(
  nx: number,
  ny: number,
  transform: SkeletonRenderTransform,
): { x: number; y: number } {
  return transform.mapPoint(nx, ny);
}

/** BBox → Padding → Scale → Center → Canvas Transform (매 프레임) */
export function buildSkeletonRenderTransform(
  jointSets: Array<Record<string, RenderJoint>>,
  canvasWidth: number,
  canvasHeight: number,
  options: {
    paddingRatio?: number;
    extraPoints?: Array<{ x: number; y: number }>;
  } = {},
): SkeletonRenderTransform {
  const padding = options.paddingRatio ?? 0.12;
  const bbox = computeSkeletonBBoxFromSets(jointSets, options.extraPoints || [])
    || { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  const fit = fitSkeleton(bbox, canvasWidth, canvasHeight, padding);
  const { centerX, centerY } = centerSkeleton(fit.content);
  const offsetX = (canvasWidth - fit.drawW) / 2;
  const offsetY = (canvasHeight - fit.drawH) / 2;

  const mapPoint = (nx: number, ny: number) => ({
    x: offsetX + (nx - fit.content.minX) * fit.scaleX,
    y: offsetY + (ny - fit.content.minY) * fit.scaleY,
  });

  return {
    canvasWidth,
    canvasHeight,
    bbox: fit.content,
    padding,
    scale: Math.min(fit.scaleX, fit.scaleY),
    centerX,
    centerY,
    offsetX,
    offsetY,
    mapPoint,
  };
}

export default buildSkeletonRenderTransform;
