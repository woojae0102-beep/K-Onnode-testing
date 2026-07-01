// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_DATA } from '../data/groupPracticeData';
import { AvatarGroupManager } from '../services/group/AvatarGroupManager';
import { GroupDanceSyncEngine } from '../services/group/GroupDanceSyncEngine';
import {
  loadChoreographyDataset,
  skeletonFramesToChoreographyDataset,
} from '../services/group/ChoreographyDatasetLoader';
import type { ChoreographyDataset, GroupDanceRenderSnapshot } from '../types/groupChoreography';

export interface UseGroupDanceEngineOptions {
  groupId: string;
  songId: string;
  userMemberId: string;
  skeletonFrames?: any[] | null;
  practiceDuration?: number;
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
  practiceDuration = 180,
}: UseGroupDanceEngineOptions) {
  const [dataset, setDataset] = useState<ChoreographyDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GroupDanceRenderSnapshot | null>(null);

  const syncEngineRef = useRef<GroupDanceSyncEngine | null>(null);
  const managerRef = useRef<AvatarGroupManager | null>(null);

  const group = GROUP_DATA[groupId];
  const myMember = group?.members.find((m) => m.id === userMemberId);
  const userFallbackAnchor = useMemo(
    () => ({ x: myMember?.defaultX ?? 0.5, y: myMember?.defaultY ?? 0.5, z: 0 }),
    [myMember],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let loaded: ChoreographyDataset;
        if (skeletonFrames?.length) {
          loaded = skeletonFramesToChoreographyDataset({
            groupId,
            songId,
            formation: group?.defaultFormation || 'diamond',
            memberMeta: (group?.members || []).map((m) => ({
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
            durationSec: practiceDuration,
            sampleFps: 15,
          });
        } else {
          loaded = await loadChoreographyDataset(groupId, songId);
        }
        if (cancelled) return;
        setDataset(loaded);
        managerRef.current = new AvatarGroupManager({
          dataset: loaded,
          groupMembers: group?.members || [],
          userMemberId,
        });
        syncEngineRef.current = new GroupDanceSyncEngine(loaded, managerRef.current);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, songId, userMemberId, skeletonFrames, practiceDuration, group]);

  const tick = useCallback(
    (elapsedSec: number, userJoints: Record<string, { x: number; y: number; z?: number }> | null = null) => {
      const engine = syncEngineRef.current;
      if (!engine) return null;
      const next = engine.tick({
        elapsedSec,
        userJoints,
        userFallbackAnchor,
      });
      setSnapshot(next);
      return next;
    },
    [userFallbackAnchor],
  );

  return {
    loading,
    error,
    dataset,
    snapshot,
    tick,
    manager: managerRef.current,
    userFallbackAnchor,
  };
}

export default useGroupDanceEngine;
