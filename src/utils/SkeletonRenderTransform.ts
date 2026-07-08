// @ts-nocheck
/**
 * Skeleton Viewport Transform
 * 1. Joint 수집 → 2. min/max → 3. BBox → 4. padding
 * → 5. Canvas 중앙 80% viewport auto-fit → 6. transform → 7. draw
 *
 * MediaPipe normalized 좌표를 Canvas에 직접 그리지 않는다.
 */

import { PRACTICE_RENDER_PADDING, SKELETON_VIEWPORT_RATIO, FULL_BODY_BBOX_JOINTS } from '../config/practiceRenderConfig';

export interface RenderJoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  confidence?: number;
}

export interface SkeletonBBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SkeletonRenderTransform {
  canvasWidth: number;
  canvasHeight: number;
  /** Canvas 중앙 뷰포트 (기본 80%) */
  viewport: { x: number; y: number; width: number; height: number };
  /** padding 적용 전 raw bbox */
  rawBBox: SkeletonBBox;
  /** padding 적용 후 content bbox */
  bbox: SkeletonBBox;
  padding: number;
  scale: number;
  centerX: number;
  centerY: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
  mapPoint: (nx: number, ny: number) => { x: number; y: number };
}

const MIN_BBOX = 0.04;

function jointUsable(j: RenderJoint | undefined, minConf = 0.1): boolean {
  if (!j || !Number.isFinite(j.x) || !Number.isFinite(j.y)) return false;
  const v = j.confidence ?? j.visibility;
  if (v == null || !Number.isFinite(v)) return true;
  return v >= minConf;
}

/** Step 1 — Joint 정리 */
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

/** Step 2·3 — 모든 Joint minX/maxX/minY/maxY → Bounding Box */
export function computeSkeletonBBoxFromSets(
  jointSets: Array<Record<string, RenderJoint>>,
  extraPoints: Array<{ x: number; y: number }> = [],
): SkeletonBBox | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;

  jointSets.forEach((joints) => {
    const normalized = normalizeSkeleton(joints);
    const names = Object.keys(normalized);
    const preferred = names.filter((n) => (FULL_BODY_BBOX_JOINTS as readonly string[]).includes(n));
    const scanNames = preferred.length >= 3 ? preferred : names;

    scanNames.forEach((name) => {
      const j = normalized[name];
      if (!jointUsable(j)) return;
      minX = Math.min(minX, j.x);
      maxX = Math.max(maxX, j.x);
      minY = Math.min(minY, j.y);
      maxY = Math.max(maxY, j.y);
      count += 1;
    });
  });

  extraPoints.forEach((p) => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
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
    return { minX: cx - half, maxX: cx + half, minY: cy - half, maxY: cy + half };
  }
  return { minX, maxX, minY, maxY };
}

/** Step 4 — BBox 주변 padding (auto-fit 전) */
export function padBoundingBox(bbox: SkeletonBBox, paddingRatio: number): SkeletonBBox {
  const w = Math.max(bbox.maxX - bbox.minX, MIN_BBOX);
  const h = Math.max(bbox.maxY - bbox.minY, MIN_BBOX);
  const padX = w * paddingRatio;
  const padY = h * paddingRatio;
  return {
    minX: bbox.minX - padX,
    maxX: bbox.maxX + padX,
    minY: bbox.minY - padY,
    maxY: bbox.maxY + padY,
  };
}

/** Canvas 중앙 viewport — 기본 80% 영역 */
export function computeCenterViewport(
  canvasWidth: number,
  canvasHeight: number,
  viewportRatio = SKELETON_VIEWPORT_RATIO,
): { x: number; y: number; width: number; height: number } {
  const cw = Math.max(1, canvasWidth);
  const ch = Math.max(1, canvasHeight);
  const vw = cw * viewportRatio;
  const vh = ch * viewportRatio;
  return {
    x: (cw - vw) / 2,
    y: (ch - vh) / 2,
    width: vw,
    height: vh,
  };
}

/** Step 5·6 — 중앙 viewport 내 Auto FitContain (고정 scale 없음) */
export function fitSkeleton(
  bbox: SkeletonBBox,
  canvasWidth: number,
  canvasHeight: number,
  paddingRatio: number,
  viewportRatio = SKELETON_VIEWPORT_RATIO,
): {
  scale: number;
  scaleX: number;
  scaleY: number;
  drawW: number;
  drawH: number;
  content: SkeletonBBox;
  offsetX: number;
  offsetY: number;
  viewport: { x: number; y: number; width: number; height: number };
} {
  const content = padBoundingBox(bbox, paddingRatio);
  const viewport = computeCenterViewport(canvasWidth, canvasHeight, viewportRatio);
  const contentW = Math.max(content.maxX - content.minX, 0.01);
  const contentH = Math.max(content.maxY - content.minY, 0.01);

  const scaleX = viewport.width / contentW;
  const scaleY = viewport.height / contentH;
  const scale = Math.min(scaleX, scaleY);

  const drawW = contentW * scale;
  const drawH = contentH * scale;
  const offsetX = viewport.x + (viewport.width - drawW) / 2;
  const offsetY = viewport.y + (viewport.height - drawH) / 2;

  return { scale, scaleX, scaleY, drawW, drawH, content, offsetX, offsetY, viewport };
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
  return fitSkeleton(bbox, canvasWidth, canvasHeight, paddingRatio).scale;
}

/** Step 7 — Joint에 transform 적용 */
export function applyTransformToJoints(
  joints: Record<string, RenderJoint>,
  transform: SkeletonRenderTransform,
): Record<string, RenderJoint> {
  const out: Record<string, RenderJoint> = {};
  Object.entries(normalizeSkeleton(joints)).forEach(([name, j]) => {
    const px = transform.mapPoint(j.x, j.y);
    out[name] = { ...j, x: px.x, y: px.y };
  });
  return out;
}

/** Step 8 helper — normalized → canvas pixel */
export function projectToCanvas(
  nx: number,
  ny: number,
  transform: SkeletonRenderTransform,
): { x: number; y: number } {
  return transform.mapPoint(nx, ny);
}

/** 매 프레임 전체 파이프라인 */
export function buildSkeletonRenderTransform(
  jointSets: Array<Record<string, RenderJoint>>,
  canvasWidth: number,
  canvasHeight: number,
  options: {
    paddingRatio?: number;
    viewportRatio?: number;
    extraPoints?: Array<{ x: number; y: number }>;
  } = {},
): SkeletonRenderTransform {
  const padding = options.paddingRatio ?? PRACTICE_RENDER_PADDING;
  const viewportRatio = options.viewportRatio ?? SKELETON_VIEWPORT_RATIO;
  const rawBBox = computeSkeletonBBoxFromSets(jointSets, options.extraPoints || [])
    || { minX: 0.2, maxX: 0.8, minY: 0.1, maxY: 0.9 };

  const fit = fitSkeleton(rawBBox, canvasWidth, canvasHeight, padding, viewportRatio);
  const { centerX, centerY } = centerSkeleton(fit.content);

  const mapPoint = (nx: number, ny: number) => ({
    x: fit.offsetX + (nx - fit.content.minX) * fit.scale,
    y: fit.offsetY + (ny - fit.content.minY) * fit.scale,
  });

  return {
    canvasWidth,
    canvasHeight,
    viewport: fit.viewport,
    rawBBox,
    bbox: fit.content,
    padding,
    scale: fit.scale,
    centerX,
    centerY,
    offsetX: fit.offsetX,
    offsetY: fit.offsetY,
    drawWidth: fit.drawW,
    drawHeight: fit.drawH,
    mapPoint,
  };
}

export default buildSkeletonRenderTransform;
