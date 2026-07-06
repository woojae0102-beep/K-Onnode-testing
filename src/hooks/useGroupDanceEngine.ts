// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_DATA } from '../data/groupPracticeData';
import { AvatarGroupManager } from '../services/group/AvatarGroupManager';
import { GroupDanceSyncEngine } from '../services/group/GroupDanceSyncEngine';
import {
  loadChoreographyDataset,
  skeletonFramesToChoreographyDataset,
} from '../services/group/ChoreographyDatasetLoader';
import { computePracticeTimeline } from '../utils/practiceTimelineUtils';
import type { ChoreographyDataset } from '../types/groupChoreography';
import type { ReferenceVideoMeta } from '../types/practiceSession';
import type { PracticeMotionSnapshot } from '../types/motionSnapshot';
import { assemblePracticeMotionSnapshot } from '../utils/motionSnapshotUtils';

export interface UseGroupDanceEngineOptions {
  groupId: string;
  songId: string;
  userMemberId: string;
  skeletonFrames?: any[] | null;
  practiceDuration?: number;
  sampleFps?: number;
  totalFrames?: number;
  referenceVideo?: ReferenceVideoMeta | null;
  sourceVideoDurationSec?: number | null;
}

/**
 * GroupStudioSession 등 기존 avatarSync 루프와 함께 쓰는 SyncEngine 훅.
 * tick(elapsedSec, userJoints)를 호출하는 쪽에서 타임라인을 제어합니다.
 */
export function useGroupDanceEngine({
  groupId,
  songId,
  userMemberId,
  skeletonFrames = null,
  practiceDuration = 0,
  sampleFps = 30,
  totalFrames = 0,
  referenceVideo = null,
  sourceVideoDurationSec = null,
}: UseGroupDanceEngineOptions) {
  const [dataset, setDataset] = useState<ChoreographyDataset | null>(null);
  const [loading, setLoading] = useState(() => !skeletonFrames?.length);
  const [error, setError] = useState<string | null>(null);

  const syncEngineRef = useRef<GroupDanceSyncEngine | null>(null);
  const managerRef = useRef<AvatarGroupManager | null>(null);

  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === userMemberId);
  const userFallbackAnchor = useMemo(
    () => ({ x: myMember?.defaultX ?? 0.5, y: myMember?.defaultY ?? 0.5, z: 0 }),
    [myMember],
  );

  useEffect(() => {
    if (!group) {
      setLoading(false);
      return undefined;
    }

    if (skeletonFrames?.length) {
      if (!practiceDuration || practiceDuration <= 0) {
        setError('연습 길이(practiceDuration)가 설정되지 않았습니다.');
        setLoading(false);
        return undefined;
      }
      try {
        const timeline =
          computePracticeTimeline(practiceDuration, sampleFps)
          ?? { duration: practiceDuration, fps: sampleFps, totalFrames: totalFrames || skeletonFrames.length };

        const loaded = skeletonFramesToChoreographyDataset({
          groupId,
          songId,
          formation: group.defaultFormation || 'diamond',
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
          frames: skeletonFrames,
          durationSec: timeline.duration,
          sampleFps: timeline.fps,
        });
        setDataset(loaded);
        managerRef.current = new AvatarGroupManager({
          dataset: loaded,
          groupMembers: group.members,
          userMemberId,
        });
        syncEngineRef.current = new GroupDanceSyncEngine(loaded, managerRef.current, {
          sourceFrames: skeletonFrames,
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
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const loaded = await loadChoreographyDataset(groupId, songId);
        if (cancelled) return;
        setDataset(loaded);
        managerRef.current = new AvatarGroupManager({
          dataset: loaded,
          groupMembers: group.members,
          userMemberId,
        });
        syncEngineRef.current = new GroupDanceSyncEngine(loaded, managerRef.current, {
          sourceFrames: skeletonFrames,
          timeline: computePracticeTimeline(practiceDuration, sampleFps),
        });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, songId, userMemberId, skeletonFrames, practiceDuration, sampleFps, totalFrames, group]);

  const tick = useCallback(
    (elapsedSec: number, userJoints: Record<string, { x: number; y: number; z?: number }> | null = null): PracticeMotionSnapshot | null => {
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
          videoDuration: sourceVideoDurationSec ?? practiceDuration,
          frameCount: totalFrames || skeletonFrames?.length || tickResult.timeline.totalFrames,
          fps: sampleFps || tickResult.timeline.fps,
          referenceVideo: referenceVideo ?? null,
        },
        tickResult,
      );
    },
    [userFallbackAnchor, groupId, songId, userMemberId, sourceVideoDurationSec, practiceDuration, totalFrames, skeletonFrames, sampleFps, referenceVideo],
  );

  return {
    loading,
    error,
    dataset,
    tick,
    manager: managerRef.current,
    userFallbackAnchor,
  };
}

export default useGroupDanceEngine;
