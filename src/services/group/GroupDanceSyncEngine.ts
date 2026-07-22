// @ts-nocheck
/**
 * Group Mode sync engine — @deprecated alias, use GroupMotionClockRuntime.
 * Skeleton frame lookup / joint interpolation / pose reconstruction 금지.
 */
import type { PracticeTimeline } from '../../utils/practiceTimelineUtils';
import { timeSecToFrameIndex } from '../../utils/practiceTimelineUtils';
import type { SyncEngineTickResult } from '../../types/motionSnapshot';
import { GroupAvatarMotionAdapter } from '../../modes/group/runtime/GroupAvatarMotionAdapter';
import { resolveFormationAtTime } from '../../modes/group/runtime/resolveFormationAtTime';
import type { GroupMotionAsset } from '../../modes/group/types/GroupMotionAsset';
import { AvatarGroupManager } from './AvatarGroupManager';

export interface GroupDanceSyncEngineOptions {
  timeline?: PracticeTimeline | null;
}

const DEFAULT_PERSONA = {
  styleId: 'balanced',
  energy: 0.7,
  sharpness: 0.7,
  groove: 0.6,
  accentColor: '#FF1F8E',
};

export class GroupDanceSyncEngine {
  private manager: AvatarGroupManager;
  private motionAsset: GroupMotionAsset;
  private motionAdapter: GroupAvatarMotionAdapter;
  private timeline: PracticeTimeline | null;
  private lastSnapshot: SyncEngineTickResult | null = null;

  constructor(
    motionAsset: GroupMotionAsset,
    manager: AvatarGroupManager,
    options: GroupDanceSyncEngineOptions = {},
  ) {
    this.motionAsset = motionAsset;
    this.manager = manager;
    this.motionAdapter = new GroupAvatarMotionAdapter();
    this.timeline = options.timeline ?? null;
    void this.motionAdapter.loadMotion(motionAsset);
  }

  updateMotionAsset(motionAsset: GroupMotionAsset, options: GroupDanceSyncEngineOptions = {}) {
    this.motionAsset = motionAsset;
    if (options.timeline !== undefined) this.timeline = options.timeline;
    void this.motionAdapter.loadMotion(motionAsset);
  }

  tick({
    elapsedSec,
    userJoints = null,
    userFallbackAnchor,
  }: {
    elapsedSec: number;
    userJoints?: Record<string, { x: number; y: number; z?: number }> | null;
    userFallbackAnchor: { x: number; y: number; z: number };
  }): SyncEngineTickResult {
    this.motionAdapter.update(elapsedSec);
    const state = this.manager.getState();
    const aiMemberIds = this.manager.getAiMemberIds();
    const personaById = new Map(state.aiAvatars.map((a) => [a.memberId, a]));
    const memberById = new Map(this.motionAsset.members.map((m) => [m.memberId, m]));

    const aiAvatars = aiMemberIds.map((memberId) => {
      const memberMotion = memberById.get(memberId);
      const meta = personaById.get(memberId);
      const formation = resolveFormationAtTime(memberMotion?.formationTimeline, elapsedSec);
      const worldOffset = formation
        || meta?.formationAnchor
        || userFallbackAnchor;

      return {
        memberId,
        displayName: meta?.displayName || memberMotion?.memberName || memberId,
        persona: meta?.persona || DEFAULT_PERSONA,
        motionUrl: memberMotion?.motionUrl || '',
        motionFormat: memberMotion?.motionFormat,
        motionAssetId: memberMotion?.motionAssetId,
        animationClipName: memberMotion?.animationClipName,
        sourceSkeletonProfile: memberMotion?.sourceSkeletonProfile,
        avatarSkeletonProfile: memberMotion?.avatarSkeletonProfile,
        worldOffset,
        isEstimated: !memberMotion?.motionUrl,
      };
    });

    const timelineMeta = this.resolveTimeline(elapsedSec);

    this.lastSnapshot = {
      timestamp: elapsedSec,
      currentTime: elapsedSec,
      sourceVideoTime: elapsedSec,
      bpm: undefined,
      timeline: timelineMeta,
      frame: null,
      formation: null,
      memberTracks: [],
      confidence: this.motionAsset.status === 'motion_asset_ready' ? 1 : 0,
      userMemberId: state.userMemberId,
      userJoints,
      userAnchor: userFallbackAnchor,
      aiAvatars,
    };

    return this.lastSnapshot;
  }

  private resolveTimeline(elapsedSec: number) {
    const duration = this.timeline?.duration ?? this.motionAsset.durationSec ?? 0;
    const fps = this.timeline?.fps ?? this.motionAsset.fps ?? 30;
    const totalFrames = this.timeline?.totalFrames ?? Math.max(1, Math.round(duration * fps));
    const frameIndex = timeSecToFrameIndex(elapsedSec, fps, totalFrames);
    const progress = duration > 0 ? Math.min(1, Math.max(0, elapsedSec / duration)) : 0;

    return { duration, fps, totalFrames, frameIndex, progress };
  }

  getMotionAdapter() {
    return this.motionAdapter;
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }
}

export default GroupDanceSyncEngine;
