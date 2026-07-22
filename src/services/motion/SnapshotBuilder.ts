// @ts-nocheck
/**
 * Snapshot Builder — Practice Motion Snapshot 통일 스키마 생성.
 * src 필드 사용 금지. referenceVideo는 referenceVideo 객체 내부만.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import { AvatarGroupManager } from '../group/AvatarGroupManager';
import { SkeletonGroupDanceSyncEngine } from '../group/SkeletonGroupDanceSyncEngine';
import { skeletonFramesToChoreographyDataset } from '../group/ChoreographyDatasetLoader';
import type { PracticeMotionSnapshot } from '../../types/motionSnapshot';
import type { PracticeSessionData } from '../../types/practiceSession';
import {
  assemblePracticeMotionSnapshot,
  isPracticeMotionSnapshotComplete,
  snapshotContextFromSession,
} from '../../utils/motionSnapshotUtils';
import { logUndefinedFields } from '../../utils/practiceValidationDebug';

export interface BuildMotionSnapshotInput {
  session: PracticeSessionData;
  elapsedSec?: number;
  userJoints?: Record<string, { x: number; y: number; z?: number }> | null;
}

export interface BuildMotionSnapshotResult {
  snapshot: PracticeMotionSnapshot;
  complete: boolean;
}

/** PracticeSessionData → PracticeMotionSnapshot */
export function buildMotionSnapshot({
  session,
  elapsedSec = 0,
  userJoints = null,
}: BuildMotionSnapshotInput): BuildMotionSnapshotResult {
  const group = GROUP_DATA[session.groupId];
  logUndefinedFields('buildMotionSnapshot.session', session as any, [
    'groupId',
    'songId',
    'userMemberId',
    'frames',
    'duration',
    'fps',
    'referenceVideo',
  ]);

  if (!group) {
    logUndefinedFields('buildMotionSnapshot.group', { groupId: session.groupId }, ['group']);
    throw new Error('그룹 데이터를 찾을 수 없습니다.');
  }

  const myMember = group.members.find((m) => m.id === session.userMemberId);
  const userFallbackAnchor = {
    x: myMember?.defaultX ?? 0.5,
    y: myMember?.defaultY ?? 0.5,
    z: 0,
  };

  const dataset = skeletonFramesToChoreographyDataset({
    groupId: session.groupId,
    songId: session.songId,
    formation: session.formationTimeline?.defaultFormation || group.defaultFormation || 'diamond',
    memberMeta: group.members.map((m) => ({
      memberId: m.id,
      displayName: m.name,
      displayNameKr: m.nameKr,
      persona: {
        styleId: 'member',
        energy: 0.8,
        sharpness: 0.75,
        groove: 0.7,
        accentColor: m.color,
      },
      formationAnchor: { x: m.defaultX, y: m.defaultY, z: 0 },
    })),
    frames: session.frames,
    durationSec: session.duration,
    sampleFps: session.fps,
  });

  const manager = new AvatarGroupManager({
    dataset,
    groupMembers: group.members,
    userMemberId: session.userMemberId,
  });

  const engine = new SkeletonGroupDanceSyncEngine(dataset, manager, {
    sourceFrames: session.frames,
    timeline: session.motionMetadata?.timeline ?? {
      duration: session.duration,
      fps: session.fps,
      totalFrames: session.totalFrames,
    },
  });

  const tickResult = engine.tick({
    elapsedSec,
    userJoints,
    userFallbackAnchor,
  });

  const context = snapshotContextFromSession(session);
  const snapshot = assemblePracticeMotionSnapshot(context, tickResult);

  return {
    snapshot,
    complete: isPracticeMotionSnapshotComplete(snapshot),
  };
}

export default buildMotionSnapshot;
