// @ts-nocheck
/**
 * Group Mode motion domain — gltf_animation only.
 * SkeletonFrameData / joints / trackId / detection metadata 금지.
 */

/** Group Runtime에서 허용하는 motion format (단일) */
export type GroupMotionFormat = 'gltf_animation';

import type { SkeletonProfile } from './ProductionSkeletonContract';
import type { AssetProvenance } from './AssetProvenance';

export type GroupMotionAssetStatus =
  | 'motion_asset_missing'
  | 'motion_asset_loading'
  | 'motion_asset_ready'
  | 'motion_asset_error';

export type GroupFormationKeyframe = {
  timeSec: number;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
};

export type GroupMotionMember = {
  memberId: string;
  memberName: string;
  motionAssetId: string;
  motionFormat: GroupMotionFormat;
  motionUrl: string;
  animationClipName?: string;
  sourceSkeletonProfile?: SkeletonProfile;
  sourceSkeletonVersion?: string;
  avatarSkeletonProfile?: SkeletonProfile;
  avatarSkeletonVersion?: string;
  formationAssetId?: string;
  formationTimeline?: GroupFormationKeyframe[];
};

export type GroupMotionAsset = {
  assetId: string;
  groupId: string;
  songId: string;
  version: string;
  durationSec: number;
  fps: number;
  status: GroupMotionAssetStatus;
  members: GroupMotionMember[];
  /** DEV fixture 사용 시 true */
  devFixture?: boolean;
  assetProvenance?: AssetProvenance;
  trustedProvenance?: import('../../../gx10/ingest/trustedProvenance').TrustedRealProductionProvenance;
  productionAssetId?: string;
};

export default GroupMotionAsset;
