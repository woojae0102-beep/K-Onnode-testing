// @ts-nocheck
/**
 * Group Mode dance engine — GroupMotionAsset + AvatarMotionController only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_DATA } from '../data/groupPracticeData';
import { AvatarGroupManager } from '../services/group/AvatarGroupManager';
import { GroupDanceSyncEngine } from '../services/group/GroupDanceSyncEngine';
import { computePracticeTimeline } from '../utils/practiceTimelineUtils';
import type { ChoreographyDataset, ChoreographyMemberMeta } from '../types/groupChoreography';
import type { ReferenceVideoMeta } from '../types/practiceSession';
import type { PracticeMotionSnapshot } from '../types/motionSnapshot';
import { assemblePracticeMotionSnapshot } from '../utils/motionSnapshotUtils';
import type { GroupMotionAsset } from '../modes/group/types/GroupMotionAsset';

export interface UseGroupDanceEngineOptions {
  groupId: string;
  songId: string;
  userMemberId: string;
  groupMotionAsset?: GroupMotionAsset | null;
  practiceDuration?: number;
  sampleFps?: number;
  totalFrames?: number;
  referenceVideo?: ReferenceVideoMeta | null;
  sourceVideoDurationSec?: number | null;
}

function motionAssetToDataset(
  asset: GroupMotionAsset,
  groupMembers: Array<{ id: string; name: string; nameKr?: string; color: string; defaultX: number; defaultY: number }>,
): ChoreographyDataset {
  const memberMeta: ChoreographyMemberMeta[] = asset.members.map((m) => {
    const gm = groupMembers.find((g) => g.id === m.memberId);
    const anchor = m.formationTimeline?.[0]?.position
      || { x: gm?.defaultX ?? 0.5, y: gm?.defaultY ?? 0.5, z: 0 };
    return {
      memberId: m.memberId,
      displayName: m.memberName || gm?.name || m.memberId,
      displayNameKr: gm?.nameKr,
      persona: {
        styleId: 'member',
        energy: 0.8,
        sharpness: 0.75,
        groove: 0.7,
        accentColor: gm?.color || '#FF1F8E',
      },
      formationAnchor: anchor,
    };
  });

  return {
    meta: {
      groupId: asset.groupId,
      songId: asset.songId,
      durationSec: asset.durationSec,
      formation: GROUP_DATA[asset.groupId]?.defaultFormation || 'diamond',
      fps: asset.fps,
    },
    members: memberMeta,
    frames: [],
  };
}

export function useGroupDanceEngine({
  groupId,
  songId,
  userMemberId,
  groupMotionAsset = null,
  practiceDuration = 0,
  sampleFps = 30,
  totalFrames = 0,
  referenceVideo = null,
  sourceVideoDurationSec = null,
}: UseGroupDanceEngineOptions) {
  const [loading, setLoading] = useState(() => !groupMotionAsset);
  const [error, setError] = useState<string | null>(null);

  const syncEngineRef = useRef<GroupDanceSyncEngine | null>(null);
  const managerRef = useRef<AvatarGroupManager | null>(null);
  const datasetRef = useRef<ChoreographyDataset | null>(null);

  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === userMemberId);
  const userFallbackAnchor = useMemo(
    () => ({ x: myMember?.defaultX ?? 0.5, y: myMember?.defaultY ?? 0.5, z: 0 }),
    [myMember],
  );

  useEffect(() => {
    if (!group || !groupMotionAsset) {
      setLoading(false);
      if (!groupMotionAsset) {
        setError('Production Motion Asset이 준비되지 않았습니다.');
      }
      return undefined;
    }

    if (groupMotionAsset.status !== 'motion_asset_ready') {
      setError('Production Motion Asset이 준비되지 않았습니다.');
      setLoading(false);
      return undefined;
    }

    const duration = practiceDuration || groupMotionAsset.durationSec;
    if (!duration || duration <= 0) {
      setError('연습 길이(practiceDuration)가 설정되지 않았습니다.');
      setLoading(false);
      return undefined;
    }

    try {
      const timeline = computePracticeTimeline(duration, sampleFps)
        ?? { duration, fps: sampleFps, totalFrames: totalFrames || Math.round(duration * sampleFps) };

      const loaded = motionAssetToDataset(groupMotionAsset, group.members);
      datasetRef.current = loaded;
      managerRef.current = new AvatarGroupManager({
        dataset: loaded,
        groupMembers: group.members,
        userMemberId,
      });
      syncEngineRef.current = new GroupDanceSyncEngine(groupMotionAsset, managerRef.current, {
        timeline: {
          ...timeline,
          totalFrames: totalFrames > 0 ? totalFrames : timeline.totalFrames,
        },
      });
      setError(null);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || String(err));
      setLoading(false);
    }

    return undefined;
  }, [groupId, songId, userMemberId, groupMotionAsset, practiceDuration, sampleFps, totalFrames, group]);

  const tick = useCallback(
    (
      elapsedSec: number,
      userJoints: Record<string, { x: number; y: number; z?: number }> | null = null,
    ): PracticeMotionSnapshot | null => {
      const engine = syncEngineRef.current;
      if (!engine) return null;
      const tickResult = engine.tick({
        elapsedSec,
        userJoints,
        userFallbackAnchor,
      });
      return assemblePracticeMotionSnapshot(
        {
          groupId,
          songId,
          userMemberId,
          videoDuration: sourceVideoDurationSec ?? practiceDuration ?? groupMotionAsset?.durationSec ?? 0,
          frameCount: totalFrames || tickResult.timeline.totalFrames,
          fps: sampleFps || tickResult.timeline.fps,
          referenceVideo: referenceVideo ?? null,
        },
        tickResult,
      );
    },
    [userFallbackAnchor, groupId, songId, userMemberId, sourceVideoDurationSec, practiceDuration, totalFrames, sampleFps, referenceVideo, groupMotionAsset],
  );

  return {
    loading,
    error,
    dataset: datasetRef.current,
    tick,
    manager: managerRef.current,
    userFallbackAnchor,
    motionAdapter: syncEngineRef.current?.getMotionAdapter() ?? null,
  };
}

export default useGroupDanceEngine;
