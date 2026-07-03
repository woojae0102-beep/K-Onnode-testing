// @ts-nocheck
/**
 * @deprecated 직접 사용 금지 — GroupMotionReconstructionEngine 사용.
 *
 * 레거시 import 호환용 얇은 파사드.
 * Skeleton 복사(expandSingleDancerToGroup) 제거됨.
 */
import type { SkeletonFrameData } from '../types/groupPractice';
import {
  GroupMotionReconstructionEngine,
  getDefaultGroupMotionEngine,
} from '../services/motion/GroupMotionReconstructionEngine';
import { MemberTrackingEngine } from '../services/motion/MemberTrackingEngine';
import type { GroupMotionReconstructionOptions } from '../types/groupMotionEngine';

export {
  GroupMotionReconstructionEngine,
  getDefaultGroupMotionEngine,
  MemberTrackingEngine,
};

export type {
  GroupMotionEngineDebugState,
  GroupMotionEngineMetadata,
  GroupMotionReconstructionOptions,
  GroupMotionReconstructionResult,
} from '../types/groupMotionEngine';

/** @deprecated MemberTrackingEngine.seedMembers 사용 */
export function assignMembersSpatial(
  members: import('../types/groupPractice').SkeletonMemberData[],
  _groupId: string,
) {
  const engine = new MemberTrackingEngine(members.length || 9);
  return engine.seedMembers(members);
}

/** @deprecated MemberTrackingEngine.trackMembers 사용 */
export function assignMembersTracked(
  currentMembers: import('../types/groupPractice').SkeletonMemberData[],
  previousMembers: import('../types/groupPractice').SkeletonMemberData[],
  _groupId: string,
  options: import('../services/motion/MemberTrackingEngine').MemberTrackingOptions = {},
) {
  const engine = new MemberTrackingEngine(options.maxTracks || 9);
  return engine.trackMembers(currentMembers, previousMembers, options).members;
}

export interface PostProcessFrameOptions extends GroupMotionReconstructionOptions {
  trackPool?: import('../services/motion/TrackPool').TrackPool;
}

/**
 * 프레임 후처리 — Group Motion Reconstruction Engine 위임.
 * expandSingleDancerToGroup / Skeleton 복사 경로 제거.
 */
export function postProcessFrame(
  frame: SkeletonFrameData,
  groupId: string,
  previousFrame: SkeletonFrameData | null,
  focusMemberId: string | null,
  detectedCount: number,
  options: PostProcessFrameOptions = {},
) {
  const engine = getDefaultGroupMotionEngine();
  if (previousFrame) {
    (engine as any).previousFrame = previousFrame;
  }

  const allMemberIds = options.allMemberIds?.length
    ? options.allMemberIds
    : focusMemberId
      ? [focusMemberId]
      : [];

  return engine.reconstructFrame(frame, {
    groupId,
    songId: options.songId,
    userMemberId: focusMemberId || options.userMemberId || '',
    allMemberIds,
    bpm: options.bpm,
    sampleFps: options.sampleFps,
    motionDatabase: options.motionDatabase,
    formationTimeline: options.formationTimeline,
  }, detectedCount);
}

/** 전체 시퀀스 재구성 */
export function reconstructMotionSequence(
  frames: SkeletonFrameData[],
  options: GroupMotionReconstructionOptions,
) {
  const engine = new GroupMotionReconstructionEngine();
  return engine.reconstructFrameSequence(frames, options);
}

export default postProcessFrame;
