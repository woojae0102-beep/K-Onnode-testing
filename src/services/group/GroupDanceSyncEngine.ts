// @ts-nocheck
import { findFrameAtTime } from '../../utils/skeletonTimelineUtils';
import type {
  AIAvatarInstance,
  ChoreographyDataset,
  ChoreographyJoint,
  GroupDanceRenderSnapshot,
} from '../../types/groupChoreography';
import { AvatarGroupManager } from './AvatarGroupManager';
import {
  applyFormationPositioning,
  computeLiveUserAnchor,
  computeRoot,
  FORMATION_SPREAD_SCALE,
} from './FormationPositioning';

export interface GroupDanceSyncInput {
  dataset: ChoreographyDataset;
  avatarManager: AvatarGroupManager;
  elapsedSec: number;
  userJoints: Record<string, ChoreographyJoint> | null;
  userFallbackAnchor: { x: number; y: number; z: number };
}

/**
 * MediaPipe 사용자 포즈 + AI 안무 프레임을 하나의 렌더 스냅샷으로 동기화합니다.
 *
 * Rendering Strategy:
 * ┌─────────────────────────────────────────────────────────┐
 * │  Timeline Clock (YouTube / avatarSync elapsed)          │
 * │       ↓                                                 │
 * │  ChoreographyDataset.frames → nearest frame @ t         │
 * │       ↓                                                 │
 * │  AvatarGroupManager → AI member IDs (user excluded)     │
 * │       ↓                                                 │
 * │  FormationPositioning → user anchor 기준 AI 재배치       │
 * │       ↓                                                 │
 * │  GroupDanceRenderSnapshot → Three.js / Canvas renderer  │
 * └─────────────────────────────────────────────────────────┘
 */
export class GroupDanceSyncEngine {
  private dataset: ChoreographyDataset;
  private manager: AvatarGroupManager;
  private lastSnapshot: GroupDanceRenderSnapshot | null = null;

  constructor(dataset: ChoreographyDataset, manager: AvatarGroupManager) {
    this.dataset = dataset;
    this.manager = manager;
  }

  updateDataset(dataset: ChoreographyDataset) {
    this.dataset = dataset;
  }

  tick({
    elapsedSec,
    userJoints,
    userFallbackAnchor,
  }: Omit<GroupDanceSyncInput, 'dataset' | 'avatarManager'>): GroupDanceRenderSnapshot {
    const state = this.manager.getState();
    const frame = findFrameAtTime(this.dataset.frames as any[], elapsedSec);
    const userAnchor = computeLiveUserAnchor(userJoints, userFallbackAnchor);
    const personaById = new Map(state.aiAvatars.map((a) => [a.memberId, a]));
    const aiMemberIds = this.manager.getAiMemberIds();

    let aiAvatars: AIAvatarInstance[];

    if (this.dataset.meta.preserveVideoFormation && frame?.members?.length) {
      const byId = new Map(frame.members.map((m) => [m.memberId, m]));
      aiAvatars = aiMemberIds.map((memberId) => {
        const memberFrame = byId.get(memberId);
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
          joints: memberFrame?.joints || {},
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
          joints: p.joints,
          worldOffset: p.worldOffset,
          isEstimated: p.isEstimated ?? false,
        };
      });
    }

    this.lastSnapshot = {
      timestamp: elapsedSec,
      userMemberId: state.userMemberId,
      userJoints,
      userAnchor,
      aiAvatars,
    };

    return this.lastSnapshot;
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }
}

export default GroupDanceSyncEngine;
