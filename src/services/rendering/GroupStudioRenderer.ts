// @ts-nocheck
/**
 * Group Studio Renderer — referenceFrames[currentFrame] 전용.
 *
 * - member.joints 그대로 렌더 (defaultX/defaultY 오프셋 금지)
 * - members[0] pose 공유 금지 — 멤버별 joints 참조 분리 검증
 * - formation / demo / fallback / samplePose 금지
 */
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { PRACTICE_RENDER_PADDING } from '../../config/practiceRenderConfig';
import {
  drawAccurateSkeleton,
} from '../../utils/canvasSkeletonUtils';
import {
  buildSkeletonRenderTransform,
  type SkeletonRenderTransform,
} from '../../utils/SkeletonRenderTransform';
import { PRACTICE_RENDER_PADDING } from '../../config/practiceRenderConfig';

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

export interface GroupStudioRendererOptions {
  memberColorMap?: Record<string, { color: string; name: string }>;
  excludeMemberId?: string;
  logicalSize?: { width: number; height: number } | null;
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
 * referenceFrames[currentFrame] 렌더.
 * 각 member는 member.joints만 사용 — defaultX/defaultY 가산 없음.
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

  const membersToDraw = frame.members.filter((member) => {
    if (!member.joints || !Object.keys(member.joints).length) return false;
    if (options.excludeMemberId && member.estimatedMemberId === options.excludeMemberId) {
      return false;
    }
    return true;
  });

  if (!membersToDraw.length) return null;

  assertDistinctMemberJoints(membersToDraw);

  const isolatedJoints = membersToDraw.map((member) => cloneMemberJointsForRender(member.joints));

  const transform = buildSkeletonRenderTransform(isolatedJoints, logicalW, logicalH, {
    paddingRatio: PRACTICE_RENDER_PADDING,
  });

  membersToDraw.forEach((member, index) => {
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
