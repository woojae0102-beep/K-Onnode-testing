// @ts-nocheck
/**
 * ProductionDanceAsset → GroupMotionContent (memberId 기반, extraction 0회).
 */
import type { ProductionDanceAsset } from '../../types/productionDanceAsset';
import type { GroupMotionContent, GroupMemberMotion } from '../../types/groupMotionContent';
import type { SkeletonFrameData } from '../../types/groupPractice';
import { GROUP_DATA } from '../../data/groupPracticeData';

async function fetchJsonMotion(url: string): Promise<SkeletonFrameData[] | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as SkeletonFrameData[];
    if (Array.isArray(data.frames)) return data.frames as SkeletonFrameData[];
    if (Array.isArray(data.motionData)) return data.motionData as SkeletonFrameData[];
    return null;
  } catch {
    return null;
  }
}

function defaultFormationTrack(groupId: string, memberId: string, durationSec: number) {
  const group = GROUP_DATA[groupId];
  const anchor = group?.members?.find((m) => m.id === memberId)?.formationAnchor
    || { x: 0, y: 0, z: 0 };
  return [
    { timestamp: 0, position: anchor },
    { timestamp: durationSec, position: anchor },
  ];
}

export async function buildGroupMotionContentFromProductionAsset(
  asset: ProductionDanceAsset,
): Promise<GroupMotionContent> {
  const members: GroupMemberMotion[] = [];
  const allFrames: SkeletonFrameData[] = [];

  for (const m of asset.members) {
    let motionData: SkeletonFrameData[] | undefined;
    if (m.motionFormat === 'json' && m.motionAssetUrl) {
      motionData = (await fetchJsonMotion(m.motionAssetUrl)) || undefined;
    }
    const formationTimeline = (m.formationTrack || []).map((kf) => ({
      time: kf.timestamp,
      position: kf.position,
      rotation: kf.rotation,
    }));

    if (motionData?.length) {
      motionData.forEach((frame, frameIndex) => {
        allFrames.push({
          ...frame,
          frameIndex,
          members: frame.members?.map((mem) => ({
            ...mem,
            estimatedMemberId: m.memberId,
          })) || frame.members,
        });
      });
    }

    members.push({
      memberId: m.memberId,
      memberName: m.memberName,
      motionAsset: m.motionAssetUrl,
      motionFormat: m.motionFormat,
      motionData,
      formationTimeline: formationTimeline.length
        ? formationTimeline
        : defaultFormationTrack(asset.groupId, m.memberId, asset.durationSec).map((kf) => ({
          time: kf.timestamp,
          position: kf.position,
        })),
      avatarId: m.avatarAssetId || m.memberId,
    });
  }

  const hasMotion = members.some((m) => m.motionData?.length || m.motionAsset);
  if (!hasMotion) {
    throw new Error('MOTION_OUTPUT_INVALID: Production Asset에 재생 가능한 motion data가 없습니다.');
  }

  return {
    id: asset.id,
    groupId: asset.groupId,
    songId: asset.songId,
    version: asset.version,
    durationSec: asset.durationSec,
    sampleFps: asset.fps,
    members,
    frames: allFrames.length ? allFrames : undefined,
    source: 'static_json',
    savedAt: asset.updatedAt,
  };
}

export default buildGroupMotionContentFromProductionAsset;
