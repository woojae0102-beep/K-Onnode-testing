// @ts-nocheck
/**
 * Motion Binding Contract Tests — Production Asset 구조 검증용 (K-POP 안무 아님).
 */
import type { ProductionMotionAssetV2 } from '../types/ProductionMotionAssetV2';

const THREEJS = 'https://threejs.org/examples/models/gltf';
const ROBOT = `${THREEJS}/RobotExpressive/RobotExpressive.glb`;
const SOLDIER = `${THREEJS}/Soldier.glb`;

export const BINDING_TEST_GROUP_ID = 'motion-binding-contract-test';
export const BINDING_TEST_SONG_ID = 'motion-binding-contract';

const BASE: Omit<ProductionMotionAssetV2, 'members'> = {
  schemaVersion: 2,
  groupId: BINDING_TEST_GROUP_ID,
  songId: BINDING_TEST_SONG_ID,
  durationSec: 10,
  fps: 30,
  status: 'ready',
  assetProvenance: 'synthetic_test' as const,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
};

/** Avatar + Motion 동일 GLB → track/bone 이름 일치 기대 */
export const FULLY_BINDABLE_MOTION_CONTRACT: ProductionMotionAssetV2 = {
  ...BASE,
  members: [{
    memberId: 'bind_full',
    memberName: 'Fully Bindable',
    avatar: { avatarAssetId: 'avatar-robot', glbUrl: ROBOT },
    motion: {
      motionAssetId: 'motion-robot-idle',
      motionFormat: 'gltf_animation',
      motionUrl: ROBOT,
      durationSec: 10,
      animationClipName: 'Idle',
    },
  }],
};

/** Avatar Robot + Motion Soldier → partial overlap 기대 */
export const PARTIALLY_BINDABLE_MOTION_CONTRACT: ProductionMotionAssetV2 = {
  ...BASE,
  members: [{
    memberId: 'bind_partial',
    memberName: 'Partially Bindable',
    avatar: { avatarAssetId: 'avatar-robot', glbUrl: ROBOT },
    motion: {
      motionAssetId: 'motion-soldier-run',
      motionFormat: 'gltf_animation',
      motionUrl: SOLDIER,
      durationSec: 10,
      animationClipName: 'Run',
    },
  }],
};

/** Avatar Robot + Motion Flamingo → unbound 기대 */
export const UNBOUND_MOTION_CONTRACT: ProductionMotionAssetV2 = {
  ...BASE,
  members: [{
    memberId: 'bind_unbound',
    memberName: 'Unbound',
    avatar: { avatarAssetId: 'avatar-robot', glbUrl: ROBOT },
    motion: {
      motionAssetId: 'motion-flamingo',
      motionFormat: 'gltf_animation',
      motionUrl: `${THREEJS}/Flamingo.glb`,
      durationSec: 10,
      animationClipName: 'Flamingo_A_',
    },
  }],
};

export default FULLY_BINDABLE_MOTION_CONTRACT;
