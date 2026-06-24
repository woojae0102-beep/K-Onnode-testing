// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useAvatarSync } from './useAvatarSync';
import { AvatarGroupManager } from '../services/group/AvatarGroupManager';
import { GroupDanceSyncEngine } from '../services/group/GroupDanceSyncEngine';
import {
  loadChoreographyDataset,
  skeletonFramesToChoreographyDataset,
} from '../services/group/ChoreographyDatasetLoader';
import type { ChoreographyDataset, GroupDanceRenderSnapshot } from '../types/groupChoreography';

export interface UseGroupDanceStageOptions {
  groupId: string;
  songId: string;
  userMemberId: string;
  /** 기존 MediaPipe 추출 skeleton frames (없으면 JSON dataset 로드) */
  skeletonFrames?: any[] | null;
  practiceDuration?: number;
  /** 외부 MediaPipe pose joints (useMediaPipeTV.poseData.joints) */
  userJoints?: Record<string, { x: number; y: number; z?: number; visibility?: number }> | null;
  autoStart?: boolean;
}

/**
 * Dataset 로드 → AvatarGroupManager → SyncEngine → RenderSnapshot 파이프라인
 */
export function useGroupDanceStage({
  groupId,
  songId,
  userMemberId,
  skeletonFrames = null,
  practiceDuration = 180,
  userJoints = null,
  autoStart = false,
}: UseGroupDanceStageOptions) {
  const [dataset, setDataset] = useState<ChoreographyDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GroupDanceRenderSnapshot | null>(null);

  const avatarSync = useAvatarSync(skeletonFrames);
  const syncEngineRef = useRef<GroupDanceSyncEngine | null>(null);
  const managerRef = useRef<AvatarGroupManager | null>(null);
  const rafRef = useRef(0);

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

  useEffect(() => {
    if (autoStart && dataset) avatarSync.start();
  }, [autoStart, dataset, avatarSync]);

  const tick = useCallback(() => {
    const engine = syncEngineRef.current;
    if (!engine) return;
    const next = engine.tick({
      elapsedSec: avatarSync.getElapsed(),
      userJoints: userJoints as any,
      userFallbackAnchor,
    });
    setSnapshot(next);
  }, [avatarSync, userJoints, userFallbackAnchor]);

  useEffect(() => {
    const loop = () => {
      tick();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const setUserMember = useCallback(
    (memberId: string) => {
      if (!dataset || !managerRef.current) return;
      managerRef.current.setUserMemberId(memberId, dataset, group?.members || []);
      syncEngineRef.current?.updateDataset(dataset);
    },
    [dataset, group],
  );

  return {
    loading,
    error,
    dataset,
    snapshot,
    avatarSync,
    manager: managerRef.current,
    setUserMember,
    userFallbackAnchor,
  };
}

export default useGroupDanceStage;
