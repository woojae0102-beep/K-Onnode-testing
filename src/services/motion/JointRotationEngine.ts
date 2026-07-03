// @ts-nocheck
/**
 * Joint Rotation Engine — 좌표 → 본별 Quaternion (GLB 리타겟 필수 입력).
 */
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import {
  computeBoneRotationsFromJoints,
  slerpQuaternion,
  type BoneQuaternion,
} from '../../utils/quaternionInterpolation';

export type { BoneQuaternion };

export function computeMemberBoneRotations(member: SkeletonMemberData): Record<string, BoneQuaternion> {
  if (!member?.joints) return {};
  const world = member.worldCoordinates as Record<string, import('../../types/groupPractice').JointPoint> | undefined;
  return computeBoneRotationsFromJoints(member.joints, world);
}

export function applyBoneRotationsToMember(member: SkeletonMemberData): SkeletonMemberData {
  const boneRotations = computeMemberBoneRotations(member);
  if (!Object.keys(boneRotations).length) return member;
  return { ...member, boneRotations };
}

export function interpolateBoneRotations(
  a: Record<string, BoneQuaternion>,
  b: Record<string, BoneQuaternion>,
  ratio: number,
): Record<string, BoneQuaternion> {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, BoneQuaternion> = {};
  names.forEach((name) => {
    const qa = a[name];
    const qb = b[name];
    if (qa && qb) out[name] = slerpQuaternion(qa, qb, ratio);
    else if (qb) out[name] = qb;
    else if (qa) out[name] = qa;
  });
  return out;
}

export function applyJointRotationsToFrames(frames: SkeletonFrameData[]): SkeletonFrameData[] {
  return frames.map((frame) => ({
    ...frame,
    members: (frame.members || []).map(applyBoneRotationsToMember),
  }));
}

export default computeMemberBoneRotations;
