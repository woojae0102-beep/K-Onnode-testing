// @ts-nocheck
/**
 * Stage FitContain — 프레임마다 전체 멤버 Bounding Box → Auto Scale/Center → Canvas 좌표.
 * Skeleton Extraction / Timeline과 독립된 Rendering Layer 전용.
 */

export interface NormalizedBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface StageFitContainView {
  canvasWidth: number;
  canvasHeight: number;
  /** normalized (0~1) → canvas pixel */
  mapPoint: (nx: number, ny: number) => { x: number; y: number };
  bbox: NormalizedBBox;
  scale: number;
  offsetX: number;
  offsetY: number;
}

type JointLike = { x?: number; y?: number; visibility?: number; confidence?: number };

const DEFAULT_PADDING = 0.08;
const MIN_BBOX_SIZE = 0.06;

function jointUsable(joint: JointLike | undefined, minConf: number): boolean {
  if (!joint || !Number.isFinite(joint.x) || !Number.isFinite(joint.y)) return false;
  const v = joint.confidence ?? joint.visibility;
  if (v == null || !Number.isFinite(v)) return true;
  return v >= minConf;
}

/** 여러 멤버 joints + 추가 anchor 포인트로 normalized bbox 계산 */
export function computeMembersBoundingBox(
  jointSets: Array<Record<string, JointLike>>,
  extraPoints: Array<{ x: number; y: number }> = [],
  minConfidence = 0.15,
): NormalizedBBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  jointSets.forEach((joints) => {
    Object.values(joints || {}).forEach((joint) => {
      if (!jointUsable(joint, minConfidence)) return;
      minX = Math.min(minX, joint.x);
      minY = Math.min(minY, joint.y);
      maxX = Math.max(maxX, joint.x);
      maxY = Math.max(maxY, joint.y);
      count += 1;
    });
  });

  extraPoints.forEach((pt) => {
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
    count += 1;
  });

  if (count === 0 || !Number.isFinite(minX)) return null;

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < MIN_BBOX_SIZE && h < MIN_BBOX_SIZE) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const half = MIN_BBOX_SIZE / 2;
    return { minX: cx - half, minY: cy - half, maxX: cx + half, maxY: cy + half };
  }

  return { minX, minY, maxX, maxY };
}

function padBBox(bbox: NormalizedBBox, paddingRatio: number): NormalizedBBox {
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const padX = w * paddingRatio;
  const padY = h * paddingRatio;
  return {
    minX: Math.max(0, bbox.minX - padX),
    minY: Math.max(0, bbox.minY - padY),
    maxX: Math.min(1, bbox.maxX + padX),
    maxY: Math.min(1, bbox.maxY + padY),
  };
}

const FULL_FRAME_BBOX: NormalizedBBox = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

/**
 * Bounding Box를 Canvas에 FitContain (letterbox) — Auto Zoom / Pan / Center.
 */
export function computeFitContainView(
  bbox: NormalizedBBox | null,
  canvasWidth: number,
  canvasHeight: number,
  paddingRatio = DEFAULT_PADDING,
): StageFitContainView {
  const cw = Math.max(1, canvasWidth);
  const ch = Math.max(1, canvasHeight);

  const content = padBBox(bbox || FULL_FRAME_BBOX, paddingRatio);
  const contentW = Math.max(content.maxX - content.minX, 0.01);
  const contentH = Math.max(content.maxY - content.minY, 0.01);
  const contentAspect = contentW / contentH;
  const canvasAspect = cw / ch;

  let drawW: number;
  let drawH: number;
  if (contentAspect > canvasAspect) {
    drawW = cw;
    drawH = cw / contentAspect;
  } else {
    drawH = ch;
    drawW = ch * contentAspect;
  }

  const offsetX = (cw - drawW) / 2;
  const offsetY = (ch - drawH) / 2;
  const scaleX = drawW / contentW;
  const scaleY = drawH / contentH;

  const mapPoint = (nx: number, ny: number) => ({
    x: offsetX + (nx - content.minX) * scaleX,
    y: offsetY + (ny - content.minY) * scaleY,
  });

  return {
    canvasWidth: cw,
    canvasHeight: ch,
    mapPoint,
    bbox: content,
    scale: Math.min(scaleX, scaleY),
    offsetX,
    offsetY,
  };
}

/** 프레임 렌더용 — joint sets 수집 후 view 한 번에 생성 */
export function buildStageFitContainView(
  jointSets: Array<Record<string, JointLike>>,
  canvasWidth: number,
  canvasHeight: number,
  options: {
    paddingRatio?: number;
    extraPoints?: Array<{ x: number; y: number }>;
    minConfidence?: number;
  } = {},
): StageFitContainView {
  const bbox = computeMembersBoundingBox(
    jointSets,
    options.extraPoints || [],
    options.minConfidence ?? 0.15,
  );
  return computeFitContainView(bbox, canvasWidth, canvasHeight, options.paddingRatio);
}

/** 라이브 포즈를 formation anchor 기준 stage normalized 좌표로 변환 */
export function mapLiveJointsToStageAnchor(
  joints: Record<string, JointLike>,
  anchorX: number,
  anchorY: number,
  spreadX = 0.22,
  spreadY = 0.32,
): Record<string, JointLike> {
  const out: Record<string, JointLike> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    if (!joint) return;
    out[name] = {
      ...joint,
      x: anchorX + (joint.x - 0.5) * spreadX,
      y: anchorY + (joint.y - 0.5) * spreadY,
    };
  });
  return out;
}

export default buildStageFitContainView;
