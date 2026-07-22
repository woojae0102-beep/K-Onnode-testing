// @ts-nocheck
/**
 * @deprecated Legacy skeleton-based sync — Group Runtime에서 사용 금지.
 * Dev tools / SnapshotBuilder 전용.
 */
import { findFrameAtTime, findFrameIndexAtTime } from '../../utils/skeletonTimelineUtils';
import { cloneSkeletonFrameForSnapshot } from '../../utils/snapshotFrameUtils';
import type { PracticeTimeline } from '../../utils/practiceTimelineUtils';
import { timeSecToFrameIndex } from '../../utils/practiceTimelineUtils';
import type { SkeletonFrameData } from '../../types/groupPractice';
import type {
  AIAvatarInstance,
  ChoreographyDataset,
  ChoreographyJoint,
} from '../../types/groupChoreography';
import type { SyncEngineTickResult } from '../../types/motionSnapshot';
import { AvatarGroupManager } from './AvatarGroupManager';
import {
  applyFormationPositioning,
  computeLiveUserAnchor,
  computeRoot,
  FORMATION_SPREAD_SCALE,
} from './FormationPositioning';
import { buildAvatarJointsFromMember } from '../../utils/skeleton3DUtils';

export interface SkeletonGroupDanceSyncInput {
  dataset: ChoreographyDataset;
  avatarManager: AvatarGroupManager;
  elapsedSec: number;
  userJoints: Record<string, ChoreographyJoint> | null;
  userFallbackAnchor: { x: number; y: number; z: number };
}

export interface SkeletonGroupDanceSyncEngineOptions {
  sourceFrames?: SkeletonFrameData[];
  timeline?: PracticeTimeline | null;
}

export class SkeletonGroupDanceSyncEngine {
  private dataset: ChoreographyDataset;
  private manager: AvatarGroupManager;
  private sourceFrames: SkeletonFrameData[];
  private timeline: PracticeTimeline | null;
  private lastSnapshot: SyncEngineTickResult | null = null;

  constructor(
    dataset: ChoreographyDataset,
    manager: AvatarGroupManager,
    options: SkeletonGroupDanceSyncEngineOptions = {},
  ) {
    this.dataset = dataset;
    this.manager = manager;
    this.sourceFrames = options.sourceFrames ?? [];
    this.timeline = options.timeline ?? null;
  }

  updateDataset(dataset: ChoreographyDataset, options: SkeletonGroupDanceSyncEngineOptions = {}) {
    this.dataset = dataset;
    if (options.sourceFrames) this.sourceFrames = options.sourceFrames;
    if (options.timeline !== undefined) this.timeline = options.timeline;
  }

  tick({
    elapsedSec,
    userJoints,
    userFallbackAnchor,
    sourceFrameOverride = null,
  }: Omit<SkeletonGroupDanceSyncInput, 'dataset' | 'avatarManager'> & {
    sourceFrameOverride?: SkeletonFrameData | null;
  }): SyncEngineTickResult {
    const state = this.manager.getState();
    const sourceFrameRaw = sourceFrameOverride
      ?? (this.sourceFrames.length ? findFrameAtTime(this.sourceFrames, elapsedSec) : null);
    const frame = sourceFrameOverride
      ? sourceFrameOverride
      : findFrameAtTime(this.dataset.frames as any[], elapsedSec);
    const sourceFrame = cloneSkeletonFrameForSnapshot(sourceFrameRaw);

    let frameIndexOverride;
    if (sourceFrameOverride && this.sourceFrames.length) {
      const idx = this.sourceFrames.indexOf(sourceFrameRaw);
      if (idx >= 0) frameIndexOverride = idx;
    }

    const timelineMeta = this.resolveTimeline(elapsedSec, sourceFrameRaw, frameIndexOverride);
    const userAnchor = computeLiveUserAnchor(userJoints, userFallbackAnchor);
    const personaById = new Map(state.aiAvatars.map((a) => [a.memberId, a]));
    const aiMemberIds = this.manager.getAiMemberIds();
    const sourceByMember = new Map(
      (sourceFrameRaw?.members || []).map((m) => [m.estimatedMemberId, m]),
    );

    const toAvatarJoints = (memberId: string, fallbackJoints: Record<string, ChoreographyJoint>) => {
      const sourceMember = sourceByMember.get(memberId);
      const built = buildAvatarJointsFromMember(
        sourceMember
          ? { joints: sourceMember.joints, worldCoordinates: sourceMember.worldCoordinates }
          : { joints: fallbackJoints },
      );
      return Object.keys(built).length ? built : fallbackJoints;
    };

    let aiAvatars: AIAvatarInstance[];

    if (this.dataset.meta.preserveVideoFormation && frame?.members?.length) {
      const byId = new Map(frame.members.map((m) => [m.memberId, m]));
      aiAvatars = aiMemberIds.map((memberId) => {
        const memberFrame = byId.get(memberId);
        const sourceMember = sourceByMember.get(memberId);
        const meta = personaById.get(memberId);
        const root = memberFrame ? computeRoot(memberFrame.joints) : userAnchor;
        return {
          memberId,
          displayName: meta?.displayName || memberId,
          persona:
            meta?.persona || {
              styleId: 'balanced',
              energy: 0.7,
              sharpness: 0.7,
              groove: 0.6,
              accentColor: '#FF1F8E',
            },
          joints: toAvatarJoints(memberId, memberFrame?.joints || {}),
          boneRotations: sourceMember?.boneRotations,
          orientation: sourceMember?.orientation,
          worldOffset: root,
          isEstimated: memberFrame?.isEstimated ?? !memberFrame,
        };
      });
    } else {
      const positioned = applyFormationPositioning({
        frame,
        userMemberId: state.userMemberId,
        userAnchor,
        referenceUserSlot: userFallbackAnchor,
        aiMemberIds,
        scale: FORMATION_SPREAD_SCALE,
      });

      aiAvatars = positioned.map((p) => {
        const meta = personaById.get(p.memberId);
        return {
          memberId: p.memberId,
          displayName: meta?.displayName || p.memberId,
          persona:
            meta?.persona || {
              styleId: 'balanced',
              energy: 0.7,
              sharpness: 0.7,
              groove: 0.6,
              accentColor: '#FF1F8E',
            },
          joints: toAvatarJoints(p.memberId, p.joints),
          boneRotations: sourceByMember.get(p.memberId)?.boneRotations,
          orientation: sourceByMember.get(p.memberId)?.orientation,
          worldOffset: p.worldOffset,
          isEstimated: p.isEstimated ?? false,
        };
      });
    }

    this.lastSnapshot = {
      timestamp: elapsedSec,
      currentTime: elapsedSec,
      sourceVideoTime: sourceFrame?.sourceVideoTime ?? elapsedSec,
      bpm: sourceFrame?.bpm ?? this.dataset.meta.bpm,
      beat: sourceFrame?.beat,
      beatIndex: sourceFrame?.beatIndex,
      poseQuality: sourceFrame?.poseQuality,
      timeline: timelineMeta,
      frame: sourceFrame,
      formation: sourceFrame?.formation ?? null,
      memberTracks: sourceFrame?.memberTracks ? [...sourceFrame.memberTracks] : [],
      confidence: sourceFrame?.confidence ?? 0,
      userMemberId: state.userMemberId,
      userJoints,
      userAnchor,
      aiAvatars,
    };

    return this.lastSnapshot;
  }

  private resolveTimeline(
    elapsedSec: number,
    sourceFrame: SkeletonFrameData | null,
    frameIndexOverride?: number,
  ) {
    const duration = this.timeline?.duration ?? this.dataset.meta.durationSec ?? 0;
    const fps = this.timeline?.fps ?? this.dataset.meta.fps ?? 30;
    const totalFrames =
      this.timeline?.totalFrames
      ?? Math.max(1, Math.round(duration * fps));

    const frameIndex =
      frameIndexOverride != null && frameIndexOverride >= 0
        ? frameIndexOverride
        : (sourceFrame?.frameIndex
          ?? (this.sourceFrames.length
            ? findFrameIndexAtTime(this.sourceFrames, elapsedSec)
            : timeSecToFrameIndex(elapsedSec, fps, totalFrames)));

    const progress = duration > 0 ? Math.min(1, Math.max(0, elapsedSec / duration)) : 0;

    return {
      duration,
      fps,
      totalFrames,
      frameIndex,
      progress,
    };
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }
}

export default SkeletonGroupDanceSyncEngine;
