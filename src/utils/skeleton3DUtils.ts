// @ts-nocheck
import type { ChoreographyJoint } from '../types/groupChoreography';
import type { JointPoint, SkeletonMemberData, SkeletonWorldPoint } from '../types/groupPractice';

const STAGE_DEFAULT = { width: 4, height: 3, depth: 2 };

/**
 * worldLandmarks(미터) 또는 정규화 joints → 3D 아바타용 관절 (x,y,z 모두 활성).
 * worldCoordinates 우선 — Z축 깊이 반영.
 */
export function buildAvatarJointsFromMember(
  member: Pick<SkeletonMemberData, 'joints' | 'worldCoordinates'> | null | undefined,
  stageScale = STAGE_DEFAULT,
): Record<string, ChoreographyJoint> {
  if (!member) return {};

  const world = member.worldCoordinates;
  if (world && Object.keys(world).length >= 4) {
    return worldCoordinatesToAvatarJoints(world, stageScale);
  }

  return normalizedJointsToAvatarJoints(member.joints || {}, stageScale);
}

export function worldCoordinatesToAvatarJoints(
  world: Record<string, SkeletonWorldPoint>,
  stageScale = STAGE_DEFAULT,
): Record<string, ChoreographyJoint> {
  const out: Record<string, ChoreographyJoint> = {};
  Object.entries(world).forEach(([name, pt]) => {
    if (!pt || !Number.isFinite(pt.x)) return;
    out[name] = {
      x: 0.5 + pt.x * stageScale.width * 0.35,
      y: 0.5 - pt.y * stageScale.height * 0.35,
      z: (pt.z ?? 0) * stageScale.depth * 0.5,
      visibility: pt.visibility ?? pt.confidence,
    };
  });
  return out;
}

export function normalizedJointsToAvatarJoints(
  joints: Record<string, JointPoint>,
  stageScale = STAGE_DEFAULT,
): Record<string, ChoreographyJoint> {
  const hip = resolveHipMid(joints);
  const out: Record<string, ChoreographyJoint> = {};

  Object.entries(joints).forEach(([name, j]) => {
    if (!j) return;
    out[name] = {
      x: 0.5 + (j.x - (hip?.x ?? 0)) * stageScale.width * 0.5,
      y: 0.5 - (j.y - (hip?.y ?? 0)) * stageScale.height * 0.5,
      z: (j.z ?? 0) * stageScale.depth,
      visibility: j.visibility ?? j.confidence,
    };
  });
  return out;
}

function resolveHipMid(joints: Record<string, JointPoint>) {
  const l = joints.left_hip;
  const r = joints.right_hip;
  if (l && r) {
    return {
      x: (l.x + r.x) / 2,
      y: (l.y + r.y) / 2,
      z: ((l.z ?? 0) + (r.z ?? 0)) / 2,
    };
  }
  return l || r || joints.nose || null;
}
