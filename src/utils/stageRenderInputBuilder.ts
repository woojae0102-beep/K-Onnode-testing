// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';
import type { FormationTimeline } from '../types/danceDatabase';
import type { SkeletonFrameData } from '../types/groupPractice';
import type { StageFormationContext, StageFrameRenderInput } from './groupSkeletonDraw';

export interface BuildStageRenderInputOptions {
  frame: SkeletonFrameData | null | undefined;
  groupId: string;
  myMemberId: string;
  timeSec: number;
  formationTimeline?: FormationTimeline | null;
  formationHole?: {
    anchor?: { x: number; y: number; z?: number };
    color?: string;
    label?: string;
  } | null;
  userJoints?: Record<string, { x: number; y: number }> | null;
  userColor?: string;
  userAnchor?: { x: number; y: number } | null;
  showUserPose?: boolean;
  showGhost?: boolean;
  ghostLabel?: string;
  snapshotAiMembers?: Array<{
    memberId: string;
    joints: Record<string, { x: number; y: number }>;
    isEstimated?: boolean;
  }>;
}

/**
 * Practice / TV 공통 — SkeletonFrame → StageFrameRenderInput 변환.
 */
export function buildStageRenderInput({
  frame,
  groupId,
  myMemberId,
  timeSec,
  formationTimeline = null,
  formationHole = null,
  userJoints = null,
  userColor = '#FF1F8E',
  userAnchor = null,
  showUserPose = false,
  showGhost = false,
  ghostLabel = 'YOU',
  snapshotAiMembers = [],
}: BuildStageRenderInputOptions): StageFrameRenderInput {
  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === myMemberId);
  const holeNormX = formationHole?.anchor?.x ?? myMember?.defaultX ?? 0.5;
  const holeNormY = formationHole?.anchor?.y ?? myMember?.defaultY ?? 0.5;

  const aiMembers: StageFrameRenderInput['aiMembers'] = [];

  frame?.members?.forEach((memberData) => {
    if (!memberData.estimatedMemberId || memberData.estimatedMemberId === myMemberId) return;
    const member = group?.members.find((m) => m.id === memberData.estimatedMemberId);
    if (!member || !memberData.joints || !Object.keys(memberData.joints).length) return;
    aiMembers.push({
      memberId: memberData.estimatedMemberId,
      joints: memberData.joints,
      color: member.color,
      name: member.nameKr,
      isEstimated: memberData.isEstimated,
    });
  });

  if (!aiMembers.length && snapshotAiMembers.length) {
    snapshotAiMembers.forEach((avatar) => {
      const member = group?.members.find((m) => m.id === avatar.memberId);
      if (!member || !avatar.joints || !Object.keys(avatar.joints).length) return;
      aiMembers.push({
        memberId: avatar.memberId,
        joints: avatar.joints,
        color: member.color,
        name: member.nameKr,
        isEstimated: avatar.isEstimated,
      });
    });
  }

  const anchorX = userAnchor?.x ?? holeNormX;
  const anchorY = userAnchor?.y ?? holeNormY;

  const formation: StageFormationContext | null = groupId && myMemberId
    ? {
        groupId,
        userMemberId: myMemberId,
        timestamp: timeSec,
        formationTimeline,
        frameFormation: frame?.formation ?? null,
        referenceUserSlot: {
          x: formationHole?.anchor?.x ?? myMember?.defaultX ?? 0.5,
          y: formationHole?.anchor?.y ?? myMember?.defaultY ?? 0.5,
          z: 0,
        },
        frameMembers: frame?.members,
      }
    : null;

  return {
    aiMembers,
    userJoints: showUserPose ? userJoints : null,
    userColor: userColor || myMember?.color || '#FF1F8E',
    userAnchor: { x: anchorX, y: anchorY },
    formation,
    ghostAnchor: showGhost
      ? {
          x: holeNormX,
          y: holeNormY,
          color: formationHole?.color || myMember?.color || '#FF1F8E',
          label: ghostLabel || formationHole?.label || 'YOU',
        }
      : null,
  };
}

export default buildStageRenderInput;
