// @ts-nocheck
/**
 * Snapshot Builder — 연습 런타임 스테이지 스냅샷 생성.
 * GroupDanceSyncEngine 래퍼. Motion Pipeline 이후 Practice 단계에서 호출.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import { AvatarGroupManager } from '../group/AvatarGroupManager';
import { GroupDanceSyncEngine } from '../group/GroupDanceSyncEngine';
import { skeletonFramesToChoreographyDataset } from '../group/ChoreographyDatasetLoader';
import type { GroupDanceRenderSnapshot } from '../../types/groupChoreography';
import type { PracticeSessionData } from '../../types/practiceSession';
import { isGroupDanceSnapshotComplete } from '../../utils/snapshotDebugLog';

export interface BuildMotionSnapshotInput {
  session: PracticeSessionData;
  elapsedSec?: number;
  userJoints?: Record<string, { x: number; y: number; z?: number }> | null;
}

export interface BuildMotionSnapshotResult {
  snapshot: GroupDanceRenderSnapshot;
  complete: boolean;
}

/** PracticeSessionData → GroupDanceRenderSnapshot (메타데이터 포함) */
export function buildMotionSnapshot({
  session,
  elapsedSec = 0,
  userJoints = null,
}: BuildMotionSnapshotInput): BuildMotionSnapshotResult {
  const group = GROUP_DATA[session.groupId];
  if (!group) throw new Error('그룹 데이터를 찾을 수 없습니다.');

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

  const engine = new GroupDanceSyncEngine(dataset, manager, {
    sourceFrames: session.frames,
    timeline: session.motionMetadata?.timeline ?? {
      duration: session.duration,
      fps: session.fps,
      totalFrames: session.totalFrames,
    },
  });

  const snapshot = engine.tick({
    elapsedSec,
    userJoints,
    userFallbackAnchor,
  });

  return {
    snapshot,
    complete: isGroupDanceSnapshotComplete(snapshot),
  };
}

export default buildMotionSnapshot;
