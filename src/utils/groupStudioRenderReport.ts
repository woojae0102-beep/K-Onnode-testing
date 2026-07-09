// @ts-nocheck
import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';
import type { SkeletonRenderTransform } from './SkeletonRenderTransform';
import { computeSkeletonBBoxFromSets } from './SkeletonRenderTransform';

let lastLoggedFrameIndex = -1;
let lastRenderAt = 0;
let renderFpsEstimate = 0;

function memberBBox(joints: Record<string, JointPoint> | null | undefined) {
  if (!joints) return { minX: null, maxX: null, minY: null, maxY: null };
  const bbox = computeSkeletonBBoxFromSets([joints]);
  if (!bbox) return { minX: null, maxX: null, minY: null, maxY: null };
  return {
    minX: bbox.minX,
    maxX: bbox.maxX,
    minY: bbox.minY,
    maxY: bbox.maxY,
  };
}

function warnSharedJoints(members: SkeletonMemberData[]) {
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (a.joints && b.joints && a.joints === b.joints) {
        console.error('[GroupStudioRender] shared joints reference detected', {
          memberA: a.estimatedMemberId ?? a.trackId,
          memberB: b.estimatedMemberId ?? b.trackId,
        });
      }
    }
  }
}

export interface GroupStudioRenderLogInput {
  frame: SkeletonFrameData | null | undefined;
  frameIndex: number;
  currentTimeSec: number;
  focusMemberId?: string;
  transform?: SkeletonRenderTransform | null;
  visibleMemberCount?: number;
  force?: boolean;
}

/** Practice/Stage 렌더 직전 종합 로그 */
export function logGroupStudioRenderFrame({
  frame,
  frameIndex,
  currentTimeSec,
  focusMemberId = '',
  transform = null,
  visibleMemberCount = 0,
  force = false,
}: GroupStudioRenderLogInput): void {
  const now = performance.now();
  if (lastRenderAt > 0) {
    const dt = now - lastRenderAt;
    if (dt > 0) renderFpsEstimate = 1000 / dt;
  }
  lastRenderAt = now;

  if (!frame?.members?.length) {
    console.warn('[GroupStudioRender] ReferenceFrame missing — skip draw', {
      Frame: frameIndex,
      Timestamp: null,
      CurrentFrame: frameIndex,
      CurrentTime: currentTimeSec,
      ReferenceFrame: null,
    });
    return;
  }

  if (!force && frameIndex === lastLoggedFrameIndex) return;
  lastLoggedFrameIndex = frameIndex;

  const visibleMembers = frame.members.filter((m) => {
    if (!m.joints || !Object.keys(m.joints).length) return false;
    if (focusMemberId && m.estimatedMemberId === focusMemberId) return false;
    return true;
  });

  warnSharedJoints(frame.members);

  console.table({
    Frame: frameIndex,
    Timestamp: frame.timestamp,
    CurrentFrame: frameIndex,
    CurrentTime: currentTimeSec,
    ReferenceFrame: frame.timestamp,
    'AI Member Count': visibleMemberCount || visibleMembers.length,
    'Track IDs': visibleMembers.map((m) => m.trackId ?? null),
    'Camera Zoom': transform?.scale ?? null,
    'Stage Offset X': transform?.offsetX ?? null,
    'Stage Offset Y': transform?.offsetY ?? null,
    'Render FPS': Math.round(renderFpsEstimate),
  });

  const memberRows = visibleMembers.map((m) => {
    const bbox = memberBBox(m.joints);
    const hip = m.joints?.left_hip && m.joints?.right_hip
      ? {
          x: (m.joints.left_hip.x + m.joints.right_hip.x) / 2,
          y: (m.joints.left_hip.y + m.joints.right_hip.y) / 2,
        }
      : m.joints?.left_hip || m.joints?.right_hip || null;

    return {
      memberId: m.estimatedMemberId ?? null,
      trackId: m.trackId ?? null,
      'nose.x': m.joints?.nose?.x ?? null,
      'nose.y': m.joints?.nose?.y ?? null,
      'hip.x': hip?.x ?? null,
      'hip.y': hip?.y ?? null,
      minX: bbox.minX,
      maxX: bbox.maxX,
      minY: bbox.minY,
      maxY: bbox.maxY,
      isEstimated: Boolean(m.isEstimated),
    };
  });
  console.table(memberRows);

  if (transform) {
    console.table({
      'Stage BBox minX': transform.rawBBox?.minX ?? transform.bbox?.minX,
      'Stage BBox maxX': transform.rawBBox?.maxX ?? transform.bbox?.maxX,
      'Stage BBox minY': transform.rawBBox?.minY ?? transform.bbox?.minY,
      'Stage BBox maxY': transform.rawBBox?.maxY ?? transform.bbox?.maxY,
      'Camera Zoom': transform.scale,
      'Stage Offset X': transform.offsetX,
      'Stage Offset Y': transform.offsetY,
    });
  }
}

export function logGroupStudioPracticeTick({
  currentTimeSec,
  frameIndex,
  referenceTimestamp,
  clockTimestamp,
}: {
  currentTimeSec: number;
  frameIndex: number;
  referenceTimestamp: number | null;
  clockTimestamp: number;
}) {
  console.log('[GroupStudioPractice]', {
    currentTime: currentTimeSec,
    currentFrame: frameIndex,
    timestamp: clockTimestamp,
    referenceFrameTimestamp: referenceTimestamp,
  });
}

export function resetGroupStudioRenderDebug(): void {
  lastLoggedFrameIndex = -1;
  lastRenderAt = 0;
  renderFpsEstimate = 0;
}

export default logGroupStudioRenderFrame;
