// @ts-nocheck
/**
 * ProductionDanceAsset → GroupMotionAsset (skeleton bridge 없음, gltf_animation only).
 */
import type { ProductionDanceAsset, ProductionMemberMotion, ProductionMotionFormat } from '../../../types/productionDanceAsset';
import type {
  GroupFormationKeyframe,
  GroupMotionAsset,
  GroupMotionMember,
} from '../types/groupMotionAsset';

function mapMotionFormat(format: ProductionMotionFormat): 'gltf_animation' | null {
  if (format === 'glb') return 'gltf_animation';
  return null;
}

function isPlayableMemberMotion(member: ProductionMemberMotion): boolean {
  return Boolean(
    member.motionFormat === 'glb'
    && member.motionAssetUrl
    && member.status === 'ready',
  );
}

function formationFromTrack(
  track: ProductionMemberMotion['formationTrack'],
): GroupFormationKeyframe[] {
  return (track || []).map((kf) => ({
    timeSec: kf.timestamp,
    position: kf.position,
    rotation: kf.rotation,
  }));
}

function mapMember(asset: ProductionDanceAsset, member: ProductionMemberMotion): GroupMotionMember {
  const playable = isPlayableMemberMotion(member);
  return {
    memberId: member.memberId,
    memberName: member.memberName,
    motionAssetId: `${asset.id}:${member.memberId}`,
    motionFormat: 'gltf_animation',
    motionUrl: playable ? member.motionAssetUrl : '',
    formationAssetId: member.avatarAssetId,
    formationTimeline: formationFromTrack(member.formationTrack),
  };
}

export function productionAssetToGroupMotionAsset(asset: ProductionDanceAsset): GroupMotionAsset {
  const members = (asset.members || []).map((m) => mapMember(asset, m));
  const allMembersPlayable = members.length > 0 && members.every((m) => Boolean(m.motionUrl));
  const productionReady = asset.status === 'ready';

  let status: GroupMotionAsset['status'] = 'motion_asset_missing';
  if (productionReady && allMembersPlayable) {
    status = 'motion_asset_ready';
  }

  return {
    assetId: asset.id,
    groupId: asset.groupId,
    songId: asset.songId,
    version: String(asset.version),
    durationSec: asset.durationSec,
    fps: asset.fps,
    status,
    members,
  };
}

export default productionAssetToGroupMotionAsset;
