// @ts-nocheck
/**
 * Legacy GroupMotionContent / choreography JSON → ProductionDanceAsset (transition).
 * avatarAssetUrl은 비워둠 — fake GLB 금지.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import { getSongById } from '../../data/groupStudioSongs';
import type { ProductionDanceAsset, ProductionMemberMotion } from '../../types/productionDanceAsset';
import { loadGroupMotionContent } from './GroupMotionContentLoader';

export async function adaptLegacyContentToProductionAsset(
  groupId: string,
  songId: string,
): Promise<ProductionDanceAsset | null> {
  try {
    const { content } = await loadGroupMotionContent({ groupId, songId });
    const group = GROUP_DATA[groupId];
    const song = getSongById(songId);
    if (!group || !content.members?.length) return null;

    const members: ProductionMemberMotion[] = content.members.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName || m.memberId,
      motionAssetUrl: m.motionAsset || '',
      motionFormat: (m.motionFormat as ProductionMemberMotion['motionFormat']) || 'json',
      avatarAssetUrl: '',
      formationTrack: (m.formationTimeline || []).map((kf) => ({
        timestamp: kf.time,
        position: kf.position,
        rotation: kf.rotation,
      })),
      motionDurationSec: content.durationSec,
      status: m.motionAsset || m.motionData?.length ? 'ready' : 'failed',
    }));

    return {
      id: `${groupId}/${songId}`,
      groupId,
      songId,
      title: song?.title || songId,
      version: content.version || 1,
      durationSec: content.durationSec,
      fps: content.sampleFps || 30,
      members,
      stage: {
        backgroundId: 'stage-default',
        cameraPreset: 'group-practice',
        stagePreset: 'diamond',
      },
      status: 'ready',
      provider: 'deepmotion',
      createdAt: content.savedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default adaptLegacyContentToProductionAsset;
