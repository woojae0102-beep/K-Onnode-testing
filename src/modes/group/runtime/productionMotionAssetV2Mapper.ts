// @ts-nocheck
/**
 * ProductionMotionAssetV2 → GroupMotionAsset / legacy ProductionDanceAsset shim.
 */
import type { ProductionDanceAsset } from '../../../types/productionDanceAsset';
import type { GroupMotionAsset, GroupMotionMember } from '../types/groupMotionAsset';
import type { ProductionMotionAssetV2 } from '../types/ProductionMotionAssetV2';

export function productionMotionAssetV2ToGroupMotionAsset(
  asset: ProductionMotionAssetV2,
): GroupMotionAsset {
  const members: GroupMotionMember[] = asset.members.map((m) => ({
    memberId: m.memberId,
    memberName: m.memberName,
    motionAssetId: m.motion.motionAssetId,
    motionFormat: 'gltf_animation',
    motionUrl: m.motion.motionUrl,
    animationClipName: m.motion.animationClipName,
    sourceSkeletonProfile: m.motion.sourceSkeletonProfile,
    sourceSkeletonVersion: m.motion.sourceSkeletonVersion,
    avatarSkeletonProfile: m.avatar.avatarSkeletonProfile,
    avatarSkeletonVersion: m.avatar.avatarSkeletonVersion,
    formationAssetId: m.avatar.avatarAssetId,
    formationTimeline: (m.formation?.keyframes || []).map((kf) => ({
      timeSec: kf.timeSec,
      position: kf.position,
      rotation: kf.rotation,
    })),
  }));

  let status: GroupMotionAsset['status'] = 'motion_asset_missing';
  if (asset.status === 'ready') {
    status = members.every((m) => m.motionUrl) ? 'motion_asset_ready' : 'motion_asset_missing';
  } else if (asset.status === 'processing') {
    status = 'motion_asset_loading';
  } else if (asset.status === 'error') {
    status = 'motion_asset_error';
  }

  return {
    assetId: `${asset.groupId}:${asset.songId}:v2`,
    groupId: asset.groupId,
    songId: asset.songId,
    version: '2',
    durationSec: asset.durationSec,
    fps: asset.fps ?? 30,
    status,
    members,
    devFixture: asset.assetProvenance === 'dev_fixture',
    assetProvenance: asset.assetProvenance,
    trustedProvenance: asset.trustedProvenance,
    productionAuthorityProof: asset.productionAuthorityProof,
    productionAssetId: asset.productionAssetId,
  };
}

/** Avatar resolver 호환 shim — skeleton 필드 없음 */
export function productionMotionAssetV2ToLegacyDanceAsset(
  asset: ProductionMotionAssetV2,
): ProductionDanceAsset {
  return {
    id: `${asset.groupId}:${asset.songId}`,
    groupId: asset.groupId,
    songId: asset.songId,
    title: asset.songId,
    version: 2,
    durationSec: asset.durationSec,
    fps: asset.fps ?? 30,
    members: asset.members.map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      motionAssetUrl: m.motion.motionUrl,
      motionFormat: 'glb',
      avatarAssetUrl: m.avatar.glbUrl,
      avatarAssetId: m.avatar.avatarAssetId,
      formationTrack: (m.formation?.keyframes || []).map((kf) => ({
        timestamp: kf.timeSec,
        position: kf.position,
        rotation: kf.rotation,
      })),
      motionDurationSec: m.motion.durationSec,
      status: asset.status === 'ready' ? 'ready' : 'failed',
    })),
    stage: {
      backgroundId: 'stage-default',
      cameraPreset: 'group-practice',
      stagePreset: 'default',
    },
    status: asset.status === 'ready' ? 'ready' : 'failed',
    provider: 'deepmotion',
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export default productionMotionAssetV2ToGroupMotionAsset;
