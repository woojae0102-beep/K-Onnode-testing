// @ts-nocheck
import {
  drawAccurateSkeleton,
} from './canvasSkeletonUtils';
import {
  applyTransformToJoints,
  buildSkeletonRenderTransform,
  type SkeletonRenderTransform,
} from './SkeletonRenderTransform';
import { PRACTICE_RENDER_PADDING } from '../config/practiceRenderConfig';
import type { FormationKeyframe, FormationTimeline } from '../types/danceDatabase';
import type { SkeletonMemberData } from '../types/groupPractice';
import { applySkeletonFormationPipeline } from '../services/rendering/SkeletonFormationRender';

export interface StageCanvasLogicalSize {
  width: number;
  height: number;
}

export type { SkeletonRenderTransform };

export interface StageFormationContext {
  groupId: string;
  userMemberId: string;
  timestamp?: number;
  formationTimeline?: FormationTimeline | null;
  frameFormation?: FormationKeyframe | null;
  referenceUserSlot?: { x: number; y: number; z?: number };
  frameMembers?: SkeletonMemberData[];
  scale?: number;
}

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

function drawGhostSlotWithTransform(
  ctx,
  anchorX: number,
  anchorY: number,
  color: string,
  label: string,
  transform: SkeletonRenderTransform,
) {
  const pos = transform.mapPoint(anchorX, anchorY);
  drawGhostSlot(ctx, pos, color, label);
}

/** Transform된 canvas 좌표로 스켈레톤 그리기 — normalized 직접 출력 금지 */
function drawSkeletonWithTransform(
  ctx,
  joints: Record<string, { x: number; y: number }>,
  color: string,
  memberName: string,
  transform: SkeletonRenderTransform,
  isEstimated = false,
  style = {},
) {
  const canvasJoints = applyTransformToJoints(joints, transform);
  drawAccurateSkeleton(ctx, canvasJoints, color, memberName, {
    mapPoint: (x, y) => ({ x, y }),
    canvasWidth: transform.canvasWidth,
    canvasHeight: transform.canvasHeight,
  } as SkeletonRenderTransform, isEstimated, style);
}

export interface StageFrameRenderInput {
  aiMembers: Array<{
    memberId?: string;
    joints: Record<string, { x: number; y: number }>;
    color: string;
    name: string;
    isEstimated?: boolean;
  }>;
  userJoints?: Record<string, { x: number; y: number }> | null;
  userColor?: string;
  userAnchor?: { x: number; y: number };
  ghostAnchor?: { x: number; y: number; color: string; label: string } | null;
  formation?: StageFormationContext | null;
}

function applyFormationToMembers(
  aiMembers: StageFrameRenderInput['aiMembers'],
  formation: StageFormationContext | null | undefined,
  userAnchor: { x: number; y: number } | undefined,
): StageFrameRenderInput['aiMembers'] {
  if (!formation?.groupId || !formation.userMemberId || !userAnchor) {
    return aiMembers;
  }

  const positioned = applySkeletonFormationPipeline({
    members: aiMembers
      .filter((m) => m.joints && Object.keys(m.joints).length)
      .map((m) => ({
        memberId: m.memberId || m.name,
        joints: m.joints,
        isEstimated: m.isEstimated,
      })),
    groupId: formation.groupId,
    userMemberId: formation.userMemberId,
    userAnchor: { x: userAnchor.x, y: userAnchor.y, z: 0 },
    timestamp: formation.timestamp ?? 0,
    formationTimeline: formation.formationTimeline,
    frameFormation: formation.frameFormation,
    referenceUserSlot: formation.referenceUserSlot,
    frameMembers: formation.frameMembers,
    scale: formation.scale,
  });

  const byId = new Map(positioned.map((p) => [p.memberId, p]));
  return aiMembers.map((m) => {
    const key = m.memberId || m.name;
    const placed = byId.get(key);
    if (!placed) return m;
    return { ...m, joints: placed.joints };
  });
}

/**
 * GroupDanceStage2D / SkeletonRenderer / GroupStageCanvas 공통 렌더 파이프라인.
 * logicalSize가 있으면 ResizeObserver 경로 사용, 없으면 canvas 부모 동기화 fallback.
 */
export function renderStageFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: StageFrameRenderInput,
  logicalSize?: StageCanvasLogicalSize | null,
): SkeletonRenderTransform | null {
  let logicalW = logicalSize?.width ?? 0;
  let logicalH = logicalSize?.height ?? 0;

  if (!logicalW || !logicalH) {
    const parent = canvas.parentElement;
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    logicalW = Math.max(1, Math.round(rect.width > 0 ? rect.width : parent.clientWidth));
    logicalH = Math.max(1, Math.round(rect.height > 0 ? rect.height : parent.clientHeight));
    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.round(logicalW * dpr);
    const pixelH = Math.round(logicalH * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (!logicalW || !logicalH) return null;

  drawStageBackground(ctx, logicalW, logicalH);

  const aiMembers = applyFormationToMembers(
    input.aiMembers,
    input.formation,
    input.userAnchor,
  );

  const jointSets = aiMembers.map((m) => m.joints).filter(Boolean);
  const extraPoints: Array<{ x: number; y: number }> = [];

  if (input.ghostAnchor) {
    extraPoints.push({ x: input.ghostAnchor.x, y: input.ghostAnchor.y });
  }
  if (input.userAnchor) {
    extraPoints.push({ x: input.userAnchor.x, y: input.userAnchor.y });
  }

  const showUserPose = Boolean(input.userJoints && input.userAnchor);
  if (showUserPose) {
    jointSets.push(mapLiveJointsToStageAnchor(
      input.userJoints,
      input.userAnchor.x,
      input.userAnchor.y,
    ));
  }

  const transform = buildSkeletonRenderTransform(jointSets, logicalW, logicalH, {
    extraPoints,
    paddingRatio: PRACTICE_RENDER_PADDING,
  });

  if (input.ghostAnchor) {
    drawGhostSlotWithTransform(
      ctx,
      input.ghostAnchor.x,
      input.ghostAnchor.y,
      input.ghostAnchor.color,
      input.ghostAnchor.label,
      transform,
    );
  }

  aiMembers.forEach((member) => {
    if (!member.joints || !Object.keys(member.joints).length) return;
    drawSkeletonWithTransform(
      ctx,
      member.joints,
      member.color,
      member.name,
      transform,
      member.isEstimated,
      { boneWidth: 5, jointRadius: 7, glowBlur: 14 },
    );
  });

  if (showUserPose && input.userColor && input.userAnchor) {
    const stageJoints = mapLiveJointsToStageAnchor(
      input.userJoints,
      input.userAnchor.x,
      input.userAnchor.y,
    );
    drawSkeletonWithTransform(
      ctx,
      stageJoints,
      input.userColor,
      'YOU',
      transform,
      false,
      { boneWidth: 5.5, jointRadius: 7.5, glowBlur: 16 },
    );
  }

  return transform;
}

/** 단일 AI 아바타 — 동일 Auto Fit 파이프라인 */
export function drawAIAvatar(
  ctx,
  joints,
  color,
  memberName,
  canvas,
  isEstimated = false,
  logicalSize?: StageCanvasLogicalSize | null,
) {
  let logicalW = logicalSize?.width ?? 0;
  let logicalH = logicalSize?.height ?? 0;
  if (!logicalW || !logicalH) {
    const parent = canvas?.parentElement;
    if (!parent) return;
    logicalW = Math.max(1, parent.clientWidth);
    logicalH = Math.max(1, parent.clientHeight);
  }
  if (!logicalW || !logicalH || !joints) return;

  const transform = buildSkeletonRenderTransform([joints], logicalW, logicalH, {
    paddingRatio: PRACTICE_RENDER_PADDING,
  });
  drawSkeletonWithTransform(ctx, joints, color, memberName, transform, isEstimated);
}

export default renderStageFrame;
