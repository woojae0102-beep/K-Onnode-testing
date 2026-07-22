// @ts-nocheck
import type { PracticeSessionData } from '../types/practiceSession';
import type {
  PracticeMotionSnapshot,
  PracticeMotionSnapshotMember,
  SnapshotBuildContext,
  SyncEngineTickResult,
} from '../types/motionSnapshot';
import { getVisibleGroupMembers } from '../modes/group/runtime/getVisibleGroupMembers';

export function snapshotContextFromSession(session: PracticeSessionData): SnapshotBuildContext {
  return {
    groupId: session.groupId,
    songId: session.songId,
    userMemberId: session.userMemberId,
    videoDuration: session.sourceVideoDurationSec ?? session.duration ?? 0,
    frameCount: session.totalFrames ?? session.frames?.length ?? 0,
    fps: session.fps ?? 30,
    referenceVideo: session.referenceVideo ?? null,
  };
}

/** SyncEngine tick → 통일 Snapshot Schema */
export function assemblePracticeMotionSnapshot(
  context: SnapshotBuildContext,
  tick: SyncEngineTickResult,
): PracticeMotionSnapshot {
  const members: PracticeMotionSnapshotMember[] = tick.aiAvatars.map((ai) => ({
    memberId: ai.memberId,
    displayName: ai.displayName,
    isUser: false,
    joints: ai.joints || {},
    persona: ai.persona,
    boneRotations: ai.boneRotations,
    orientation: ai.orientation,
    worldOffset: ai.worldOffset,
    isEstimated: ai.isEstimated,
  }));

  if (tick.userMemberId) {
    members.push({
      memberId: tick.userMemberId,
      isUser: true,
      joints: tick.userJoints || {},
      worldOffset: tick.userAnchor,
    });
  }

  return {
    videoDuration: context.videoDuration,
    frameCount: context.frameCount,
    fps: context.fps,
    timeline: {
      ...tick.timeline,
      currentTime: tick.currentTime,
    },
    members,
    formation: tick.formation,
    motion: {
      aiAvatars: tick.aiAvatars,
      userMemberId: tick.userMemberId,
      userJoints: tick.userJoints,
      userAnchor: tick.userAnchor,
      frame: tick.frame,
      confidence: tick.confidence,
      bpm: tick.bpm,
      poseQuality: tick.poseQuality,
      beat: tick.beat,
      beatIndex: tick.beatIndex,
      sourceVideoTime: tick.sourceVideoTime,
    },
    referenceVideo: context.referenceVideo ?? null,
    metadata: {
      memberTracks: tick.memberTracks ?? [],
      groupId: context.groupId,
      songId: context.songId,
      userMemberId: context.userMemberId,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function isPracticeMotionSnapshotComplete(
  snapshot: PracticeMotionSnapshot | null | undefined,
): boolean {
  if (!snapshot) return false;
  if (!Number.isFinite(snapshot.videoDuration) || snapshot.videoDuration <= 0) return false;
  if (!Number.isFinite(snapshot.frameCount) || snapshot.frameCount <= 0) return false;
  if (!Number.isFinite(snapshot.fps) || snapshot.fps <= 0) return false;
  if (!snapshot.timeline) return false;
  if (!Number.isFinite(snapshot.timeline.duration) || snapshot.timeline.duration <= 0) return false;
  if (!snapshot.motion?.frame) return false;
  if (!Array.isArray(snapshot.metadata?.memberTracks)) return false;
  if (!Number.isFinite(snapshot.motion.confidence)) return false;
  const aiWithJoints = (snapshot.motion.aiAvatars || []).filter(
    (a) => Boolean(a.motionUrl) || Object.keys(a.joints || {}).length > 0,
  ).length;
  return aiWithJoints > 0;
}

/** 렌더러 호환 접근자 — userMember 제외 visible AI only */
export function snapshotAiAvatars(snapshot: PracticeMotionSnapshot | null | undefined) {
  const all = snapshot?.motion?.aiAvatars ?? [];
  const selectedMemberId = snapshot?.metadata?.userMemberId
    || snapshot?.motion?.userMemberId
    || '';
  if (!selectedMemberId) return all;

  const { visibleAiMembers } = getVisibleGroupMembers({
    members: all.map((avatar) => ({ memberId: avatar.memberId, _avatar: avatar })),
    selectedMemberId,
    mode: 'snapshot-ai',
  });
  return visibleAiMembers.map((entry) => entry._avatar);
}

export function snapshotFrame(snapshot: PracticeMotionSnapshot | null | undefined) {
  return snapshot?.motion?.frame ?? null;
}

export function snapshotUserJoints(snapshot: PracticeMotionSnapshot | null | undefined) {
  return snapshot?.motion?.userJoints ?? null;
}

export function snapshotUserAnchor(snapshot: PracticeMotionSnapshot | null | undefined) {
  return snapshot?.motion?.userAnchor ?? { x: 0.5, y: 0.5, z: 0 };
}

export function snapshotCurrentTime(snapshot: PracticeMotionSnapshot | null | undefined) {
  return snapshot?.timeline?.currentTime ?? 0;
}

export function snapshotMemberTracks(snapshot: PracticeMotionSnapshot | null | undefined) {
  return snapshot?.metadata?.memberTracks ?? [];
}

export function snapshotConfidence(snapshot: PracticeMotionSnapshot | null | undefined) {
  return snapshot?.motion?.confidence ?? 0;
}

export default assemblePracticeMotionSnapshot;
