// @ts-nocheck
/**
 * MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST
 * ProductionMotionAssetV2 multi-member binding contract (K-POP 안무 아님).
 */
import type { ProductionMotionAssetV2 } from '../types/ProductionMotionAssetV2';

const THREEJS = 'https://threejs.org/examples/models/gltf';

export const MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST_NAME = 'MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST';

export const PRODUCTION_MOTION_TEST_GROUP_ID = 'real-multi-member-motion-test';
export const PRODUCTION_MOTION_TEST_SONG_ID = 'production-motion-test';

/** 동일 choreography timeline — member별 motion asset은 독립 */
export const CHOREOGRAPHY_DURATION_SEC = 30;

export const MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST: ProductionMotionAssetV2 = {
  schemaVersion: 2,
  groupId: PRODUCTION_MOTION_TEST_GROUP_ID,
  songId: PRODUCTION_MOTION_TEST_SONG_ID,
  durationSec: CHOREOGRAPHY_DURATION_SEC,
  fps: 30,
  status: 'ready',
  assetProvenance: 'synthetic_test',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  members: [
    {
      memberId: 'member_a',
      memberName: 'Member A',
      avatar: {
        avatarAssetId: 'contract-avatar-a',
        glbUrl: 'https://models.readyplayer.me/64bfa15f0e72fc558b8f1144.glb?meshLod=0&textureAtlas=1024',
      },
      motion: {
        motionAssetId: 'contract-motion-a',
        motionFormat: 'gltf_animation',
        motionUrl: `${THREEJS}/RobotExpressive/RobotExpressive.glb`,
        durationSec: CHOREOGRAPHY_DURATION_SEC,
        animationClipName: 'Idle',
      },
      formation: {
        keyframes: [{ timeSec: 0, position: { x: 0.5, y: 0.25, z: 0 } }],
      },
    },
    {
      memberId: 'member_b',
      memberName: 'Member B',
      avatar: {
        avatarAssetId: 'contract-avatar-b',
        glbUrl: 'https://models.readyplayer.me/64bfa1670e72fc558b8f1145.glb?meshLod=0&textureAtlas=1024',
      },
      motion: {
        motionAssetId: 'contract-motion-b',
        motionFormat: 'gltf_animation',
        motionUrl: `${THREEJS}/Soldier.glb`,
        durationSec: CHOREOGRAPHY_DURATION_SEC,
        animationClipName: 'Run',
      },
      formation: {
        keyframes: [{ timeSec: 0, position: { x: 0.75, y: 0.5, z: 0 } }],
      },
    },
    {
      memberId: 'member_c',
      memberName: 'Member C',
      avatar: {
        avatarAssetId: 'contract-avatar-c',
        glbUrl: 'https://models.readyplayer.me/64bfa1880e72fc558b8f1146.glb?meshLod=0&textureAtlas=1024',
      },
      motion: {
        motionAssetId: 'contract-motion-c',
        motionFormat: 'gltf_animation',
        motionUrl: `${THREEJS}/Flamingo.glb`,
        durationSec: CHOREOGRAPHY_DURATION_SEC,
        animationClipName: 'Flamingo_A_',
      },
      formation: {
        keyframes: [{ timeSec: 0, position: { x: 0.25, y: 0.5, z: 0 } }],
      },
    },
    {
      memberId: 'member_d',
      memberName: 'Member D',
      avatar: {
        avatarAssetId: 'contract-avatar-d',
        glbUrl: 'https://models.readyplayer.me/64bfa1a90e72fc558b8f1147.glb?meshLod=0&textureAtlas=1024',
      },
      motion: {
        motionAssetId: 'contract-motion-d',
        motionFormat: 'gltf_animation',
        motionUrl: `${THREEJS}/Parrot.glb`,
        durationSec: CHOREOGRAPHY_DURATION_SEC,
        animationClipName: 'parrot_A_',
      },
      formation: {
        keyframes: [{ timeSec: 0, position: { x: 0.5, y: 0.75, z: 0 } }],
      },
    },
  ],
};

/** @deprecated — use MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST */
export const PRODUCTION_MOTION_TEST_CONTRACT = MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST;
/** @deprecated PHASE 4 alias */
export const REAL_MULTI_MEMBER_MOTION_ASSET_TEST = MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST;
export const REAL_MULTI_MEMBER_TEST_GROUP_ID = PRODUCTION_MOTION_TEST_GROUP_ID;
export const REAL_MULTI_MEMBER_TEST_SONG_ID = PRODUCTION_MOTION_TEST_SONG_ID;

export default MULTI_MEMBER_MOTION_BINDING_CONTRACT_TEST;
