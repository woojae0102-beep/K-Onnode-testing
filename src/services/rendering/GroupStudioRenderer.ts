// @ts-nocheck
/**
 * Group Studio Renderer — referenceFrames[currentFrame] 전용 Stage Renderer.
 *
 * - frame.members.forEach — member.joints 개별 사용 (members[0] 공유 금지)
 * - focusMemberId(사용자) Stage 제외 — Webcam 전용
 * - demo / idle / fallback pose 금지
 */
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { drawAccurateSkeleton } from '../../utils/canvasSkeletonUtils';
import {
  type SkeletonRenderTransform,
} from '../../utils/SkeletonRenderTransform';
import { logGroupStudioRenderFrame } from '../../utils/groupStudioRenderReport';
import type { FormationHole, FormationTimeline } from '../../types/danceDatabase';
import {
  applyJointOffset,
  computeMemberHipCenter,
  resolveMemberDefaultFormation,
  resolveTimelinePosition,
  type StageAnchor,
} from './SkeletonFormationRender';

export interface GroupStudioRendererOptions {
  groupId?: string;
  memberColorMap?: Record<string, { color: string; name: string }>;
  focusMemberId?: string;
  userMemberId?: string;
  frameIndex?: number;
  currentTimeSec?: number;
  logicalSize?: { width: number; height: number } | null;
  formationTimeline?: FormationTimeline | null;
  formationHole?: FormationHole | null;
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

/** Stage AI members — focusMemberId(사용자) 제외 */
export function filterVisibleStageMembers(
  members: SkeletonMemberData[] | null | undefined,
  focusMemberId?: string,
  userMemberId?: string,
): SkeletonMemberData[] {
  if (!members?.length) return [];
  const focusId = focusMemberId != null && focusMemberId !== ''
    ? String(focusMemberId)
    : '';
  const userId = userMemberId != null && userMemberId !== ''
    ? String(userMemberId)
    : focusId;

  return members.filter((member) => {
    if (!member.joints || !Object.keys(member.joints).length) return false;
    const memberIds = [
      member.id,
      member.memberId,
      member.estimatedMemberId,
      member.trackId,
      member.personIndex,
    ]
      .filter((id) => id != null && id !== '')
      .map((id) => String(id));
    const label = member.label != null ? String(member.label).trim().toUpperCase() : '';
    const name = member.name != null ? String(member.name).trim().toUpperCase() : '';

    if (focusId && memberIds.includes(focusId)) return false;
    if (userId && memberIds.includes(userId)) return false;
    if (member.isUser || member.isSelf || member.isYou) return false;
    if (member.isEstimated === false && (focusId || userId) && !memberIds.length) return false;
    if (label === 'YOU' || name === 'YOU') return false;
    return true;
  });
}

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

/** shared reference 격리 — member 단위 deep clone */
export function cloneMemberForRender(member: SkeletonMemberData): SkeletonMemberData {
  return {
    ...member,
    joints: cloneMemberJointsForRender(member.joints),
  };
}

export function isolateMembersForRender(members: SkeletonMemberData[]): SkeletonMemberData[] {
  const cloned = members.map(cloneMemberForRender);

  for (let i = 0; i < cloned.length; i += 1) {
    for (let j = i + 1; j < cloned.length; j += 1) {
      if (cloned[i].joints === cloned[j].joints) {
        cloned[j] = cloneMemberForRender(cloned[j]);
      }
    }
  }

  return cloned;
}

export function assertDistinctMemberJoints(members: SkeletonMemberData[]): void {
  if (members.length < 2) return;

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (a.joints && b.joints && a.joints === b.joints) {
        console.error(
          '[GroupStudioRenderer] members share joints object — deep clone applied',
          {
            memberA: a.estimatedMemberId ?? a.trackId,
            memberB: b.estimatedMemberId ?? b.trackId,
          },
        );
      }
    }
  }
}

function resolveMemberId(member: SkeletonMemberData): string {
  return String(member.memberId ?? member.id ?? member.estimatedMemberId ?? member.trackId ?? '');
}

function isUserStageMember(member: SkeletonMemberData, options: GroupStudioRendererOptions): boolean {
  const memberId = resolveMemberId(member);
  const focusId = options.focusMemberId != null ? String(options.focusMemberId) : '';
  const userId = options.userMemberId != null ? String(options.userMemberId) : focusId;
  const label = String(member.label ?? '').trim().toUpperCase();
  const name = String(member.name ?? '').trim().toUpperCase();
  return Boolean(
    (focusId && memberId === focusId)
      || (userId && memberId === userId)
      || member.isUser
      || member.isSelf
      || member.isYou
      || label === 'YOU'
      || name === 'YOU',
  );
}

function resolveFrameFormationSlot(
  frame: SkeletonFrameData,
  memberId: string,
): StageAnchor | null {
  const slot = frame.formation?.slots?.find((s) => String(s.memberId) === String(memberId));
  if (!slot) return null;
  return { x: slot.x, y: slot.y, z: slot.z ?? 0 };
}

function resolveRenderAnchor(
  member: SkeletonMemberData,
  frame: SkeletonFrameData,
  options: GroupStudioRendererOptions,
): StageAnchor | null {
  if (member.stageAnchor) {
    return {
      x: member.stageAnchor.x,
      y: member.stageAnchor.y,
      z: member.stageAnchor.z ?? 0,
    };
  }

  const memberId = resolveMemberId(member);
  if (!memberId) return null;

  const groupId = options.groupId;
  if (groupId && GROUP_DATA[groupId]) {
    const fallback = resolveMemberDefaultFormation(groupId, memberId);
    return resolveTimelinePosition(
      options.formationTimeline,
      frame.formation ?? null,
      options.currentTimeSec ?? frame.timestamp ?? 0,
      memberId,
      fallback,
    );
  }

  return resolveFrameFormationSlot(frame, memberId);
}

function offsetMemberJointsToFormation(
  member: SkeletonMemberData,
  joints: Record<string, JointPoint>,
  frame: SkeletonFrameData,
  options: GroupStudioRendererOptions,
): Record<string, JointPoint> {
  const targetAnchor = resolveRenderAnchor(member, frame, options);
  const hipCenter = computeMemberHipCenter(joints);
  if (!targetAnchor || !hipCenter) return joints;
  return applyJointOffset(joints, hipCenter, targetAnchor);
}

function buildVideoFitRenderTransform(
  frame: SkeletonFrameData,
  canvasWidth: number,
  canvasHeight: number,
): SkeletonRenderTransform {
  const videoWidth = Number(frame.videoWidth) > 0 ? Number(frame.videoWidth) : canvasWidth;
  const videoHeight = Number(frame.videoHeight) > 0 ? Number(frame.videoHeight) : canvasHeight;
  const scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const offsetX = (canvasWidth - videoWidth * scale) / 2;
  const offsetY = (canvasHeight - videoHeight * scale) / 2;

  return {
    canvasWidth,
    canvasHeight,
    viewport: { x: offsetX, y: offsetY, width: videoWidth * scale, height: videoHeight * scale },
    rawBBox: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    bbox: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    padding: 0,
    scale,
    centerX: 0.5,
    centerY: 0.5,
    offsetX,
    offsetY,
    drawWidth: videoWidth * scale,
    drawHeight: videoHeight * scale,
    mapPoint: (nx: number, ny: number) => ({
      x: nx * videoWidth * scale + offsetX,
      y: ny * videoHeight * scale + offsetY,
    }),
  };
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

  if (import.meta.env?.DEV) {
    // 겹침 디버깅용 — 서로 다른 멤버의 첫 관절이 같은 픽셀 좌표로 나오면
    // transform.mapPoint 또는 그 이전 단계(좌표 분리)가 잘못된 것이다.
    const firstKey = Object.keys(canvasJoints)[0];
    if (firstKey) {
      console.log(`[Draw] ${label} ${firstKey}:`, canvasJoints[firstKey].x, canvasJoints[firstKey].y);
    }
  }

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
 * referenceFrames[currentFrame] — AI members only.
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

  const visibleMembers = isolateMembersForRender(
    filterVisibleStageMembers(frame.members, options.focusMemberId, options.userMemberId),
  );
  if (!visibleMembers.length) return null;

  assertDistinctMemberJoints(visibleMembers);

  const renderMembers = visibleMembers.map((member) => ({
    ...member,
    joints: offsetMemberJointsToFormation(member, member.joints, frame, options),
  }));

  const isolatedJoints = renderMembers.map((member) => member.joints);

  const transform = buildVideoFitRenderTransform(frame, logicalW, logicalH);

  if (import.meta.env?.DEV) {
    // 겹침 디버깅용 — mapped hip 좌표가 멤버별로 최소 50px 이상 차이나야 정상이다.
    isolatedJoints.forEach((joints, i) => {
      const hip = joints?.left_hip || joints?.right_hip;
      if (hip) {
        const mapped = transform.mapPoint(hip.x, hip.y);
        console.log(`[Transform] member ${i} mapped hip:`, mapped);
      }
    });
  }

  renderMembers.forEach((member, index) => {
    if (isUserStageMember(member, options)) return;

    const memberId = resolveMemberId(member);
    const meta = options.memberColorMap?.[memberId];
    const joints = isolatedJoints[index];
    const label = meta?.name || memberId || 'AI';

    if (import.meta.env?.DEV) {
      // 겹침 디버깅용 — 멤버 좌표가 실제로 다른지 확인
      const hipX = joints?.left_hip?.x ?? joints?.right_hip?.x ?? 0;
      const hipY = joints?.left_hip?.y ?? joints?.right_hip?.y ?? 0;
      console.log(`[Renderer] member ${memberId} hip:`, { hipX, hipY });
    }

    if (
      String(label).toUpperCase() === 'YOU'
      || (options.focusMemberId && String(memberId) === String(options.focusMemberId))
      || (options.userMemberId && String(memberId) === String(options.userMemberId))
    ) return;

    drawMemberSkeleton(
      ctx,
      member,
      joints,
      transform,
      meta?.color || '#FF1F8E',
      label,
    );
  });

  logGroupStudioRenderFrame({
    frame,
    frameIndex: options.frameIndex ?? -1,
    currentTimeSec: options.currentTimeSec ?? frame.timestamp ?? 0,
    focusMemberId: options.focusMemberId,
    transform,
    visibleMemberCount: visibleMembers.length,
  });

  return transform;
}

export default renderGroupStudioFrame;
