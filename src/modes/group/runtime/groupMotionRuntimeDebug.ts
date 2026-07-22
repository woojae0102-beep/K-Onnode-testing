// @ts-nocheck
/**
 * Group Mode runtime debug snapshot (skeleton/joints/trackId 없음).
 */

import type {
  MotionBindingDebugSnapshot,
  AvatarMotionTransformProof,
} from '../types/motionBindingDebug';
import type {
  AvatarSkeletonRuntimeAudit,
  RetargetResult,
  RetargetTransformProof,
} from '../types/skeletonRetargeting';
import type {
  ProductionMotionFinalStatus,
  SkeletonProfile,
  SkeletonValidationResult,
} from '../types/ProductionSkeletonContract';
import type { ProductionMotionRuntimeMetrics } from './productionMotionRuntimeCache';
import { getProductionMotionRuntimeMetrics } from './productionMotionRuntimeCache';

export type AvatarMixerDebugState = {
  memberId: string;
  avatarAssetId?: string;
  motionAssetId?: string;
  motionUrl?: string;
  avatarLoaded: boolean;
  avatarMounted?: boolean;
  motionLoaded: boolean;
  mixerCreated: boolean;
  actionCreated?: boolean;
  clipCount: number;
  clipNames: string[];
  selectedClipName?: string;
  clipDurationSec?: number;
  clipError?: string;
  currentTimeSec: number;
  animationState: 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  actionPaused?: boolean;
  actionRunning?: boolean;
  formationPosition?: { x: number; y: number; z: number };
  motionBinding?: MotionBindingDebugSnapshot;
  transformProof?: AvatarMotionTransformProof | RetargetTransformProof;
  skeletonAudit?: AvatarSkeletonRuntimeAudit;
  retargetResult?: RetargetResult;
  playbackPath?: 'direct' | 'retargeted' | 'failed';
  skeletonValidation?: SkeletonValidationResult;
  avatarSkeletonProfile?: SkeletonProfile;
  motionSkeletonProfile?: SkeletonProfile;
  mappedSemanticBones?: Partial<Record<string, string>>;
  retargetedTrackCount?: number;
  finalStatus?: ProductionMotionFinalStatus;
};

export type GroupMotionRuntimeDebugSnapshot = {
  currentTimeSec: number;
  durationSec: number;
  isPlaying: boolean;
  selectedMemberId: string;
  userSlotMemberId: string | null;
  visibleAiMemberIds: string[];
  mountedAvatarMemberIds: string[];
  loadedMotionMemberIds: string[];
  mixerCreatedMemberIds: string[];
  currentTimeSecByMember: Record<string, number>;
  activeMemberIds: string[];
  loadedMotionAssetIds: string[];
  animationClipNames: Record<string, string[]>;
  groupMotionAssetStatus: string;
  groupMotionAssetSchemaVersion: number | null;
  devFixture: boolean;
  memberMixerStates: Record<string, AvatarMixerDebugState>;
  runtimeSteps: string[];
  performanceMetrics: ProductionMotionRuntimeMetrics;
};

const latestSnapshot: { value: GroupMotionRuntimeDebugSnapshot | null } = { value: null };
const mixerStates = new Map<string, AvatarMixerDebugState>();
const runtimeSteps: string[] = [];

function deriveMemberLists(visibleIds: string[]) {
  const mountedAvatarMemberIds: string[] = [];
  const loadedMotionMemberIds: string[] = [];
  const mixerCreatedMemberIds: string[] = [];
  const currentTimeSecByMember: Record<string, number> = {};

  for (const memberId of visibleIds) {
    const state = mixerStates.get(memberId);
    if (!state) continue;
    if (state.avatarMounted || state.avatarLoaded) mountedAvatarMemberIds.push(memberId);
    if (state.motionLoaded) loadedMotionMemberIds.push(memberId);
    if (state.mixerCreated) mixerCreatedMemberIds.push(memberId);
    if (Number.isFinite(state.currentTimeSec)) {
      currentTimeSecByMember[memberId] = state.currentTimeSec;
    }
  }

  return { mountedAvatarMemberIds, loadedMotionMemberIds, mixerCreatedMemberIds, currentTimeSecByMember };
}

export function appendGroupMotionRuntimeStep(step: string): void {
  runtimeSteps.push(`${Date.now()}:${step}`);
  if (runtimeSteps.length > 50) runtimeSteps.shift();
  if (latestSnapshot.value) {
    latestSnapshot.value.runtimeSteps = [...runtimeSteps];
  }
}

export function registerAvatarMixerDebugState(state: AvatarMixerDebugState): void {
  mixerStates.set(state.memberId, state);
  if (latestSnapshot.value) {
    latestSnapshot.value.memberMixerStates = Object.fromEntries(mixerStates.entries());
    latestSnapshot.value.animationClipNames = buildClipNamesMap();
    const derived = deriveMemberLists(latestSnapshot.value.visibleAiMemberIds);
    Object.assign(latestSnapshot.value, derived);
  }
}

export function unregisterAvatarMixerDebugState(memberId: string): void {
  mixerStates.delete(memberId);
}

function buildClipNamesMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  mixerStates.forEach((state, memberId) => {
    out[memberId] = state.clipNames;
  });
  return out;
}

export function buildGroupMotionRuntimeDebugSnapshot(input: {
  currentTimeSec: number;
  durationSec: number;
  isPlaying: boolean;
  selectedMemberId: string;
  userSlotMemberId?: string | null;
  visibleMemberIds: string[];
  loadedMotionAssetIds: string[];
  motionAssetStatus: string;
  schemaVersion?: number | null;
  devFixture?: boolean;
}): GroupMotionRuntimeDebugSnapshot {
  const derived = deriveMemberLists(input.visibleMemberIds);
  const snapshot: GroupMotionRuntimeDebugSnapshot = {
    currentTimeSec: input.currentTimeSec,
    durationSec: input.durationSec,
    isPlaying: input.isPlaying,
    selectedMemberId: input.selectedMemberId,
    userSlotMemberId: input.userSlotMemberId ?? input.selectedMemberId,
    visibleAiMemberIds: input.visibleMemberIds,
    ...derived,
    activeMemberIds: input.visibleMemberIds,
    loadedMotionAssetIds: input.loadedMotionAssetIds,
    animationClipNames: buildClipNamesMap(),
    groupMotionAssetStatus: input.motionAssetStatus,
    groupMotionAssetSchemaVersion: input.schemaVersion ?? null,
    devFixture: Boolean(input.devFixture),
    memberMixerStates: Object.fromEntries(mixerStates.entries()),
    runtimeSteps: [...runtimeSteps],
    performanceMetrics: getProductionMotionRuntimeMetrics(),
  };
  latestSnapshot.value = snapshot;
  return snapshot;
}

export function getLatestGroupMotionRuntimeDebugSnapshot(): GroupMotionRuntimeDebugSnapshot | null {
  return latestSnapshot.value;
}

export function clearGroupMotionRuntimeDebug(): void {
  latestSnapshot.value = null;
  mixerStates.clear();
  runtimeSteps.length = 0;
}

export { getProductionMotionRuntimeMetrics };

export default buildGroupMotionRuntimeDebugSnapshot;
