// @ts-nocheck
/**
 * Group Studio Renderer — referenceFrames[currentFrame] 전용.
 *
 * currentFrame = Math.floor(currentTime * fps)
 * elapsedTime / animationTime / demoAnimation / timestamp 보간 금지.
 */
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { PRACTICE_RENDER_PADDING } from '../../config/practiceRenderConfig';
import { drawAccurateSkeleton } from '../../utils/canvasSkeletonUtils';
import {
  buildSkeletonRenderTransform,
  type SkeletonRenderTransform,
} from '../../utils/SkeletonRenderTransform';

export interface GroupStudioRendererOptions {
  memberColorMap?: Record<string, { color: string; name: string }>;
  /** 연습자가 선택한 멤버 — Stage에서 제외 */
  focusMemberId?: string;
  /** referenceFrames[frameIndex] — 디버그 로그용 */
  frameIndex?: number;
  currentTimeSec?: number;
  logicalSize?: { width: number; height: number } | null;
}

function drawStageBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

/** Stage visible members — focusMemberId 제외, joints 있는 멤버만 */
export function filterVisibleStageMembers(
  members: SkeletonMemberData[] | null | undefined,
  focusMemberId?: string,
): SkeletonMemberData[] {
  if (!members?.length) return [];

  return members.filter((member) => {
    if (!member.joints || !Object.keys(member.joints).length) return false;
    const memberId = member.estimatedMemberId;
    if (focusMemberId && memberId === focusMemberId) return false;
    return true;
  });
}

/** 렌더용 joints 얕은 복사 — 공유 참조·변형 격리 */
export function cloneMemberJointsForRender(
  joints: Record<string, JointPoint> | null | undefined,
): Record<string, JointPoint> {
  if (!joints) return {};
  const out: Record<string, JointPoint> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    if (!joint) return;
    out[name] = { ...joint };
  });
  return out;
}

/** DEV — 멤버 간 joints 객체 공유 감지 */
export function assertDistinctMemberJoints(members: SkeletonMemberData[]): void {
  if (!import.meta.env?.DEV || members.length < 2) return;

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (a.joints && b.joints && a.joints === b.joints) {
        console.error(
          '[GroupStudioRenderer] members share the same joints object — render bug',
          {
            memberA: a.estimatedMemberId ?? a.trackId,
            memberB: b.estimatedMemberId ?? b.trackId,
          },
        );
      }
    }
  }
}

function syncCanvasLogicalSize(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  logicalSize?: { width: number; height: number } | null,
): { width: number; height: number } | null {
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
  return { width: logicalW, height: logicalH };
}

function drawMemberSkeleton(
  ctx: CanvasRenderingContext2D,
  member: SkeletonMemberData,
  joints: Record<string, JointPoint>,
  transform: SkeletonRenderTransform,
  color: string,
  label: string,
) {
  const canvasJoints: Record<string, JointPoint> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    const px = transform.mapPoint(joint.x, joint.y);
    canvasJoints[name] = { ...joint, x: px.x, y: px.y };
  });

  drawAccurateSkeleton(ctx, canvasJoints, color, label, {
    mapPoint: (x, y) => ({ x, y }),
    canvasWidth: transform.canvasWidth,
    canvasHeight: transform.canvasHeight,
  } as SkeletonRenderTransform, member.isEstimated, {
    boneWidth: 5,
    jointRadius: 7,
    glowBlur: 14,
  });
}

/**
 * referenceFrames[currentFrame] — visibleMembers만 렌더.
 * User Skeleton / YOU / live pose 금지.
 */
export function renderGroupStudioFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frame: SkeletonFrameData | null | undefined,
  options: GroupStudioRendererOptions = {},
): SkeletonRenderTransform | null {
  if (!frame?.members?.length) return null;

  const size = syncCanvasLogicalSize(ctx, canvas, options.logicalSize);
  if (!size) return null;

  const { width: logicalW, height: logicalH } = size;
  drawStageBackground(ctx, logicalW, logicalH);

  const visibleMembers = filterVisibleStageMembers(frame.members, options.focusMemberId);
  if (!visibleMembers.length) return null;

  assertDistinctMemberJoints(visibleMembers);

  const isolatedJoints = visibleMembers.map((member) => cloneMemberJointsForRender(member.joints));

  const transform = buildSkeletonRenderTransform(isolatedJoints, logicalW, logicalH, {
    paddingRatio: PRACTICE_RENDER_PADDING,
  });

  visibleMembers.forEach((member, index) => {
    const memberId = member.estimatedMemberId || String(member.trackId ?? '');
    const meta = options.memberColorMap?.[memberId];
    const joints = isolatedJoints[index];

    drawMemberSkeleton(
      ctx,
      member,
      joints,
      transform,
      meta?.color || '#FF1F8E',
      meta?.name || memberId || 'AI',
    );
  });

  return transform;
}

export default renderGroupStudioFrame;
