// @ts-nocheck
import type { GroupDanceRenderSnapshot } from '../types/groupChoreography';
import type { SkeletonFrameData } from '../types/groupPractice';
import { findFrameAtTime, findFrameIndexAtTime } from './skeletonTimelineUtils';

export interface StageAiDebugInfo {
  aiAvatarCount: number;
  frameNumber: number;
  totalFrames: number;
  currentTime: number;
  memberCount: number;
  jointCount: number;
  userJointCount: number;
  perAvatarJoints: Array<{ memberId: string; displayName: string; jointCount: number }>;
  emptyJointMemberIds: string[];
}

export function buildStageAiDebugInfo(
  snapshot: GroupDanceRenderSnapshot | null,
  skeletonFrames: SkeletonFrameData[] = [],
  currentTimeSec?: number,
): StageAiDebugInfo {
  const aiList = snapshot?.aiAvatars || [];
  const time = currentTimeSec ?? snapshot?.currentTime ?? snapshot?.timestamp ?? 0;
  const frameNumber = snapshot?.timeline?.frameIndex ?? findFrameIndexAtTime(skeletonFrames, time);
  const frame = snapshot?.frame ?? findFrameAtTime(skeletonFrames, time);
  const perAvatarJoints = aiList.map((avatar) => ({
    memberId: avatar.memberId,
    displayName: avatar.displayName || avatar.memberId,
    jointCount: Object.keys(avatar.joints || {}).length,
  }));
  const jointCount = perAvatarJoints.reduce((sum, row) => sum + row.jointCount, 0);
  const userJointCount = snapshot?.userJoints ? Object.keys(snapshot.userJoints).length : 0;

  return {
    aiAvatarCount: aiList.length,
    frameNumber,
    totalFrames: snapshot?.timeline?.totalFrames ?? skeletonFrames.length,
    currentTime: time,
    memberCount: frame?.members?.length ?? 0,
    jointCount,
    userJointCount,
    perAvatarJoints,
    emptyJointMemberIds: perAvatarJoints.filter((row) => row.jointCount === 0).map((row) => row.memberId),
  };
}

let lastAiDebugKey = '';

export function logAiStageDebug(
  snapshot: GroupDanceRenderSnapshot | null,
  skeletonFrames: SkeletonFrameData[] = [],
  context = 'GroupDanceStage3D',
  currentTimeSec?: number,
) {
  const info = buildStageAiDebugInfo(snapshot, skeletonFrames, currentTimeSec);
  const key = [
    context,
    info.aiAvatarCount,
    info.frameNumber,
    info.currentTime.toFixed(2),
    info.memberCount,
    info.jointCount,
    info.emptyJointMemberIds.join(','),
  ].join('|');

  if (key === lastAiDebugKey) return;
  lastAiDebugKey = key;

  console.debug(`[StageAI] ${context}`, {
    'AI Avatar Count': info.aiAvatarCount,
    'Frame Number': info.frameNumber,
    'Current Time': `${info.currentTime.toFixed(2)}s`,
    'Member Count': info.memberCount,
    'Joint Count': info.jointCount,
    userJointCount: info.userJointCount,
    totalFrames: info.totalFrames,
    perAvatarJoints: info.perAvatarJoints,
    emptyJointMemberIds: info.emptyJointMemberIds,
  });

  if (info.emptyJointMemberIds.length > 0) {
    console.warn(
      `[StageAI] ${context} — joints 비어 있음 (avatarAssets 문제 아님):`,
      info.emptyJointMemberIds,
    );
  }
}

export function resetStageAiDebugLog() {
  lastAiDebugKey = '';
}
