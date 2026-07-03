// @ts-nocheck
/**
 * Formation · Hip Anchor · Shoulder Direction · Quaternion 기반 멤버 Motion Retargeting.
 * 단순 defaultX/defaultY 평행이동 금지 — 1인 소스도 포메이션 슬롯별 회전·앵커 배치.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { FormationTimeline, FormationKeyframe } from '../../types/danceDatabase';
import type {
  SkeletonFrameData,
  SkeletonMemberData,
  SkeletonWorldPoint,
  JointPoint,
} from '../../types/groupPractice';
import type { DanceDatabase } from '../../types/danceDatabase';
import {
  SKELETON_BONE_SEGMENTS,
  boneDirection,
  boneLength,
  slerpDirection,
} from '../../utils/quaternionInterpolation';
import { resolveMembersFromStoredMotionDatabase } from './MotionDatabaseEngine';

const HIP_KEYS = ['left_hip', 'right_hip'] as const;
const SHOULDER_KEYS = ['left_shoulder', 'right_shoulder'] as const;
const AUDIENCE_Y = 0.12;

export interface FormationSlotAnchor {
  x: number;
  y: number;
  z: number;
  /** 라디안 — 어깨 라인이 향하는 방향 */
  facingAngle: number;
}

export interface FormationRetargetContext {
  groupId: string;
  focusMemberId: string;
  formationScale?: number;
  formationTimeline?: FormationTimeline | null;
  formationKeyframes?: FormationKeyframe[];
  timestamp?: number;
}

function hipCenter(joints: Record<string, JointPoint>): { x: number; y: number; z: number } | null {
  const hips = HIP_KEYS.map((k) => joints[k]).filter(Boolean) as JointPoint[];
  if (!hips.length) {
    const nose = joints.nose;
    return nose ? { x: nose.x, y: nose.y, z: nose.z ?? 0 } : null;
  }
  const sum = hips.reduce(
    (acc, j) => ({ x: acc.x + j.x, y: acc.y + j.y, z: acc.z + (j.z ?? 0) }),
    { x: 0, y: 0, z: 0 },
  );
  return { x: sum.x / hips.length, y: sum.y / hips.length, z: sum.z / hips.length };
}

function shoulderBearing(joints: Record<string, JointPoint>): number {
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  if (!ls || !rs) return 0;
  return Math.atan2(rs.y - ls.y, rs.x - ls.x);
}

function groupCentroid(members: Array<{ defaultX: number; defaultY: number }>) {
  if (!members.length) return { x: 0.5, y: 0.5 };
  const sum = members.reduce((acc, m) => ({ x: acc.x + m.defaultX, y: acc.y + m.defaultY }), { x: 0, y: 0 });
  return { x: sum.x / members.length, y: sum.y / members.length };
}

/** 포메이션 슬롯 → Hip Anchor + 관객 방향 facing */
export function resolveFormationSlotAnchor(
  member: { defaultX: number; defaultY: number },
  groupMembers: Array<{ defaultX: number; defaultY: number }>,
): FormationSlotAnchor {
  const centroid = groupCentroid(groupMembers);
  const outwardX = member.defaultX - centroid.x;
  const outwardY = member.defaultY - centroid.y;
  const toAudienceX = member.defaultX - 0.5;
  const toAudienceY = AUDIENCE_Y - member.defaultY;
  const facingAngle = Math.abs(toAudienceX) + Math.abs(toAudienceY) > 1e-4
    ? Math.atan2(toAudienceY, toAudienceX)
    : Math.atan2(outwardY, outwardX) + Math.PI / 2;

  const depth = Math.hypot(outwardX, outwardY) * 0.08;
  return {
    x: member.defaultX,
    y: member.defaultY,
    z: depth,
    facingAngle,
  };
}

function rotatePoint2D(p: { x: number; y: number; z?: number }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
    z: p.z ?? 0,
  };
}

function transformLandmarkPoints(
  points: SkeletonWorldPoint[] | undefined,
  hip: { x: number; y: number; z: number },
  rotation: number,
  targetHip: FormationSlotAnchor,
): SkeletonWorldPoint[] | undefined {
  if (!points?.length) return undefined;
  return points.map((p) => {
    const local = { x: p.x - hip.x, y: p.y - hip.y, z: (p.z ?? 0) - hip.z };
    const rotated = rotatePoint2D(local, rotation);
    return {
      ...p,
      x: targetHip.x + rotated.x,
      y: targetHip.y + rotated.y,
      z: targetHip.z + rotated.z,
    };
  });
}

function transformHandFace(
  hand: SkeletonMemberData['leftHand'],
  hip: { x: number; y: number; z: number },
  rotation: number,
  targetHip: FormationSlotAnchor,
) {
  if (!hand?.landmarks?.length) return hand;
  return {
    ...hand,
    landmarks: transformLandmarkPoints(hand.landmarks, hip, rotation, targetHip) || hand.landmarks,
    worldLandmarks: hand.worldLandmarks
      ? transformLandmarkPoints(hand.worldLandmarks, hip, rotation, targetHip)
      : undefined,
  };
}

/**
 * Hip-local → Shoulder bearing 보정 → Formation facing 회전 → Hip Anchor 배치.
 * 뼈 방향은 quaternion SLERP로 재구성해 단순 XY 이동과 구분.
 */
export function retargetMemberSkeletonToFormation(
  source: SkeletonMemberData,
  focusSlot: FormationSlotAnchor,
  targetSlot: FormationSlotAnchor,
  sourceBearing: number,
  formationScale = 1,
): SkeletonMemberData {
  const joints = source.joints || {};
  const hip = hipCenter(joints);
  if (!hip) return { ...source, isEstimated: true };

  const rotation = targetSlot.facingAngle - sourceBearing;
  const spread = formationScale;

  const hipLocal: Record<string, JointPoint> = {};
  Object.entries(joints).forEach(([name, j]) => {
    if (!j) return;
    hipLocal[name] = {
      ...j,
      x: (j.x - hip.x) * spread,
      y: (j.y - hip.y) * spread,
      z: ((j.z ?? 0) - hip.z) * spread,
    };
  });

  const rotatedLocal: Record<string, JointPoint> = {};
  Object.entries(hipLocal).forEach(([name, j]) => {
    const r = rotatePoint2D(j, rotation);
    rotatedLocal[name] = {
      ...j,
      x: r.x,
      y: r.y,
      z: r.z,
    };
  });

  SKELETON_BONE_SEGMENTS.forEach(([parent, child]) => {
    const dirSrc = boneDirection(rotatedLocal, parent, child);
    const dirFocus = boneDirection(hipLocal, parent, child);
    const len = boneLength(rotatedLocal, parent, child) ?? boneLength(hipLocal, parent, child);
    const parentJoint = rotatedLocal[parent];
    if (!dirSrc || !dirFocus || !parentJoint || len == null) return;
    const dir = slerpDirection(dirFocus, dirSrc, 0.35);
    rotatedLocal[child] = {
      ...(rotatedLocal[child] || {}),
      x: parentJoint.x + dir.x * len,
      y: parentJoint.y + dir.y * len,
      z: (parentJoint.z ?? 0) + dir.z * len,
      visibility: rotatedLocal[child]?.visibility ?? parentJoint.visibility,
      confidence: (rotatedLocal[child]?.confidence ?? 0.7) * 0.85,
    };
  });

  const world = source.worldCoordinates || {};
  const worldHip = hipCenter(world as Record<string, JointPoint>) || hip;
  const retargetedJoints: Record<string, JointPoint> = {};
  Object.entries(rotatedLocal).forEach(([name, j]) => {
    retargetedJoints[name] = {
      ...j,
      x: targetSlot.x + j.x,
      y: targetSlot.y + j.y,
      z: targetSlot.z + (j.z ?? 0),
    };
  });

  const retargetedWorld: Record<string, SkeletonWorldPoint> = {};
  Object.entries(world).forEach(([name, pt]) => {
    const local = {
      x: (pt.x - worldHip.x) * spread,
      y: (pt.y - worldHip.y) * spread,
      z: ((pt.z ?? 0) - worldHip.z) * spread,
    };
    const r = rotatePoint2D(local, rotation);
    retargetedWorld[name] = {
      ...pt,
      x: targetSlot.x + r.x,
      y: targetSlot.y + r.y,
      z: targetSlot.z + r.z,
    };
  });

  return {
    ...source,
    joints: retargetedJoints,
    worldCoordinates: Object.keys(retargetedWorld).length ? retargetedWorld : source.worldCoordinates,
    leftHand: transformHandFace(source.leftHand, hip, rotation, targetSlot),
    rightHand: transformHandFace(source.rightHand, hip, rotation, targetSlot),
    face: source.face?.landmarks
      ? {
          ...source.face,
          landmarks: transformLandmarkPoints(source.face.landmarks, hip, rotation, targetSlot) || source.face.landmarks,
        }
      : source.face,
    isEstimated: true,
    confidence: (source.confidence ?? 0.8) * 0.72,
  };
}

/**
 * 1인 감지 → Formation Retargeting으로 전 멤버 Motion 생성.
 * expandSingleDancerToGroup() 대체 — XY 평행이동 사용 안 함.
 */
export function expandSingleDancerViaFormationRetargeting(
  members: SkeletonMemberData[],
  groupId: string,
  focusMemberId: string,
  ctx: Partial<FormationRetargetContext> = {},
): SkeletonMemberData[] {
  const group = GROUP_DATA[groupId];
  if (!group || !members?.length) return members;

  const source = members.find((m) => !m.isEstimated) || members[0];
  if (!source?.joints || !Object.keys(source.joints).length) return members;

  const sourceBearing = shoulderBearing(source.joints);
  const focusMember = group.members.find((m) => m.id === focusMemberId) || group.members[0];
  const focusSlot = resolveFormationSlotAnchor(focusMember, group.members);
  const scale = ctx.formationScale ?? 1;

  return group.members.map((member, trackId) => {
    if (member.id === focusMemberId) {
      return {
        ...source,
        trackId,
        personIndex: trackId,
        estimatedMemberId: member.id,
        isEstimated: false,
        confidence: source.confidence ?? 1,
      };
    }

    const targetSlot = resolveFormationSlotAnchor(member, group.members);
    const retargeted = retargetMemberSkeletonToFormation(
      source,
      focusSlot,
      targetSlot,
      sourceBearing,
      scale,
    );

    return {
      ...retargeted,
      trackId,
      personIndex: trackId,
      estimatedMemberId: member.id,
    };
  });
}

/** Motion Database에서 해당 시점의 실제 멤버 Motion 조회 */
export function resolveMembersFromMotionDatabase(
  frame: SkeletonFrameData,
  motionDatabase: DanceDatabase,
  groupId: string,
  userMemberId: string,
): SkeletonMemberData[] {
  const group = GROUP_DATA[groupId];
  if (!group) return frame.members || [];

  const groupMemberIds = group.members.map((m) => m.id);
  return resolveMembersFromStoredMotionDatabase(
    frame,
    motionDatabase.skeletonFrames,
    groupMemberIds,
    userMemberId,
  );
}

/** 프레임별 누락 AI 멤버를 Formation Retargeting으로 합성 */
export function synthesizeFormationMembersForFrame(
  frame: SkeletonFrameData,
  {
    groupId,
    focusMemberId,
    allMemberIds,
    formationTimeline,
    formationKeyframes,
  }: FormationRetargetContext & { allMemberIds: string[] },
): SkeletonFrameData {
  const group = GROUP_DATA[groupId];
  if (!group) return frame;

  const present = new Set((frame.members || []).map((m) => m.estimatedMemberId).filter(Boolean));
  const missing = allMemberIds.filter((id) => id && id !== focusMemberId && !present.has(id));
  if (!missing.length) return frame;

  const source =
    frame.members?.find((m) => m.estimatedMemberId === focusMemberId && !m.isEstimated)
    || frame.members?.find((m) => !m.isEstimated)
    || frame.members?.[0];

  if (!source) return frame;

  const motionAnchorId = source.estimatedMemberId || focusMemberId;

  let expanded = expandSingleDancerViaFormationRetargeting(
    [source],
    groupId,
    motionAnchorId,
    { formationTimeline, formationKeyframes, timestamp: frame.timestamp },
  );

  const keyframes = formationTimeline?.keyframes || formationKeyframes || [];
  if (keyframes.length) {
    const slotKeyframe = keyframes.reduce((nearest, k) =>
      Math.abs(k.timestamp - frame.timestamp) < Math.abs(nearest.timestamp - frame.timestamp)
        ? k
        : nearest,
    );
    if (slotKeyframe?.slots?.length) {
      expanded = expanded.map((m) => {
        const slot = slotKeyframe.slots.find((s) => s.memberId === m.estimatedMemberId);
        if (!slot || m.estimatedMemberId === focusMemberId) return m;
        const targetSlot: FormationSlotAnchor = {
          x: slot.x,
          y: slot.y,
          z: slot.z ?? 0,
          facingAngle: resolveFormationSlotAnchor(
            { defaultX: slot.x, defaultY: slot.y },
            group.members,
          ).facingAngle,
        };
        const focusSlot = resolveFormationSlotAnchor(
          group.members.find((gm) => gm.id === focusMemberId) || group.members[0],
          group.members,
        );
        return {
          ...retargetMemberSkeletonToFormation(
            source,
            focusSlot,
            targetSlot,
            shoulderBearing(source.joints || {}),
          ),
          trackId: m.trackId,
          personIndex: m.personIndex,
          estimatedMemberId: m.estimatedMemberId,
        };
      });
    }
  }

  const byId = new Map(expanded.map((m) => [m.estimatedMemberId, m]));
  const merged = allMemberIds
    .filter((id) => id)
    .map((id) => {
      const existing = frame.members?.find((m) => m.estimatedMemberId === id);
      if (existing && !existing.isEstimated) return existing;
      return byId.get(id) || existing;
    })
    .filter(Boolean) as SkeletonMemberData[];

  return {
    ...frame,
    members: merged,
    memberTracks: merged.map((m) => ({
      trackId: Number(m.trackId ?? 0),
      memberId: m.estimatedMemberId,
      confidence: m.confidence ?? 0.7,
    })),
  };
}

export function synthesizeFormationMembersForFrames(
  frames: SkeletonFrameData[],
  options: FormationRetargetContext & { allMemberIds: string[] },
): SkeletonFrameData[] {
  if (!frames?.length) return frames;
  return frames.map((frame) => synthesizeFormationMembersForFrame(frame, options));
}

export default expandSingleDancerViaFormationRetargeting;
