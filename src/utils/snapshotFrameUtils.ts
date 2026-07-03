// @ts-nocheck
import type { SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';

function cloneMember(member: SkeletonMemberData): SkeletonMemberData {
  return {
    ...member,
    joints: { ...member.joints },
    worldCoordinates: member.worldCoordinates ? { ...member.worldCoordinates } : undefined,
    boundingBox: member.boundingBox ? { ...member.boundingBox } : undefined,
  };
}

/** 스냅샷용 프레임 딥 클론 — 렌더 루프 mutation 방지 */
export function cloneSkeletonFrameForSnapshot(
  frame: SkeletonFrameData | null | undefined,
): SkeletonFrameData | null {
  if (!frame) return null;
  return {
    ...frame,
    members: (frame.members || []).map(cloneMember),
    memberTracks: frame.memberTracks?.map((t) => ({ ...t })),
    formation: frame.formation
      ? {
          ...frame.formation,
          slots: frame.formation.slots?.map((s) => ({ ...s })),
        }
      : undefined,
    boundingBox: frame.boundingBox ? { ...frame.boundingBox } : undefined,
    worldCoordinates: frame.worldCoordinates ? { ...frame.worldCoordinates } : undefined,
  };
}

export default cloneSkeletonFrameForSnapshot;
