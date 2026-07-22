// @ts-nocheck
import type { ProductionMotionAssetV2 } from '../types/ProductionMotionAssetV2';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { getVisibleGroupMembers } from './getVisibleGroupMembers';

export function validateProductionMotionDistinctness(asset: ProductionMotionAssetV2): void {
  const motionIds = asset.members.map((m) => m.motion.motionAssetId.trim());
  const motionUrls = asset.members.map((m) => m.motion.motionUrl.trim());

  const dupId = motionIds.find((id, i) => motionIds.indexOf(id) !== i);
  if (dupId) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID,
      `duplicate motionAssetId: ${dupId}`,
    );
  }

  const dupUrl = motionUrls.find((url, i) => motionUrls.indexOf(url) !== i);
  if (dupUrl) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL,
      `duplicate motionUrl: ${dupUrl}`,
    );
  }
}

export function validateSelectedMemberAndActors(
  asset: ProductionMotionAssetV2,
  selectedMemberId: string,
): ReturnType<typeof getVisibleGroupMembers> {
  const selected = String(selectedMemberId || '').trim();
  if (!selected) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.SELECTED_MEMBER_NOT_FOUND,
      'selectedMemberId required',
    );
  }

  const memberIds = asset.members.map((m) => m.memberId);
  if (!memberIds.includes(selected)) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.SELECTED_MEMBER_NOT_FOUND,
      `member ${selected} not in asset`,
    );
  }

  const result = getVisibleGroupMembers({
    members: asset.members.map((m) => ({ memberId: m.memberId })),
    selectedMemberId: selected,
    mode: 'production-runtime',
  });

  if (!result.visibleAiMembers.length) {
    throw new ProductionMotionAssetError(
      PRODUCTION_MOTION_ERRORS.GROUP_MOTION_ACTOR_COUNT_INVALID,
      'visible AI member count is 0',
    );
  }

  return result;
}

export type GroupMotionIsolationSnapshot = {
  selectedMemberId: string;
  userSlot: string;
  visibleAiMemberIds: string[];
  mountedAvatarMemberIds: string[];
  loadedMotionMemberIds: string[];
  mixerCreatedMemberIds: string[];
  currentTimeSecByMember: Record<string, number>;
};

export function buildGroupMotionIsolationSnapshot(input: {
  selectedMemberId: string;
  visibleAiMemberIds: string[];
  memberMixerStates: Record<string, { avatarLoaded?: boolean; motionLoaded?: boolean; mixerCreated?: boolean; currentTimeSec?: number }>;
}): GroupMotionIsolationSnapshot {
  const mountedAvatarMemberIds: string[] = [];
  const loadedMotionMemberIds: string[] = [];
  const mixerCreatedMemberIds: string[] = [];
  const currentTimeSecByMember: Record<string, number> = {};

  for (const memberId of input.visibleAiMemberIds) {
    const state = input.memberMixerStates[memberId];
    if (state?.avatarLoaded) mountedAvatarMemberIds.push(memberId);
    if (state?.motionLoaded) loadedMotionMemberIds.push(memberId);
    if (state?.mixerCreated) mixerCreatedMemberIds.push(memberId);
    if (state && Number.isFinite(state.currentTimeSec)) {
      currentTimeSecByMember[memberId] = state.currentTimeSec!;
    }
  }

  return {
    selectedMemberId: input.selectedMemberId,
    userSlot: input.selectedMemberId,
    visibleAiMemberIds: [...input.visibleAiMemberIds],
    mountedAvatarMemberIds,
    loadedMotionMemberIds,
    mixerCreatedMemberIds,
    currentTimeSecByMember,
  };
}

export function assertGroupMotionIsolationInvariants(snapshot: GroupMotionIsolationSnapshot): void {
  const { selectedMemberId, visibleAiMemberIds } = snapshot;

  if (snapshot.mountedAvatarMemberIds.includes(selectedMemberId)) {
    throw new Error(`selectedMemberId ${selectedMemberId} must not be mounted as avatar`);
  }
  if (snapshot.loadedMotionMemberIds.includes(selectedMemberId)) {
    throw new Error(`selectedMemberId ${selectedMemberId} must not load motion`);
  }
  if (snapshot.mixerCreatedMemberIds.includes(selectedMemberId)) {
    throw new Error(`selectedMemberId ${selectedMemberId} must not have mixer`);
  }

  const sort = (arr: string[]) => [...arr].sort().join(',');
  if (sort(snapshot.mountedAvatarMemberIds) !== sort(visibleAiMemberIds)) {
    throw new Error('mountedAvatarMemberIds must equal visibleAiMemberIds');
  }
  if (sort(snapshot.loadedMotionMemberIds) !== sort(visibleAiMemberIds)) {
    throw new Error('loadedMotionMemberIds must equal visibleAiMemberIds');
  }
}

export default validateSelectedMemberAndActors;
