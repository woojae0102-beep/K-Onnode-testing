// @ts-nocheck
/**
 * 실제 GLB Animation Asset — Group Runtime DEV E2E fixture.
 * skeleton JSON / joints / trackId / stub formation dance 금지.
 */
import { GROUP_DATA } from '../../../data/groupPracticeData';
import { getSongById } from '../../../data/groupStudioSongs';
import type { ProductionDanceAsset } from '../../../types/productionDanceAsset';
import type { GroupMotionAsset, GroupMotionMember } from '../types/groupMotionAsset';
import { buildGroupPracticeSessionFromMotionAsset } from '../services/buildGroupPracticeSession';
import { isDevEnvironment } from '../../../utils/isDevEnvironment';

const THREEJS_GLTF = 'https://threejs.org/examples/models/gltf';

/** 멤버별 독립 motion URL (동일 URL 복사 금지) */
const MEMBER_MOTION_SOURCES: Record<string, { motionAssetId: string; motionUrl: string }> = {
  jennie: {
    motionAssetId: 'member-jennie-motion',
    motionUrl: `${THREEJS_GLTF}/RobotExpressive/RobotExpressive.glb`,
  },
  lisa: {
    motionAssetId: 'member-lisa-motion',
    motionUrl: `${THREEJS_GLTF}/Soldier.glb`,
  },
  rose: {
    motionAssetId: 'member-rose-motion',
    motionUrl: `${THREEJS_GLTF}/Flamingo.glb`,
  },
  jisoo: {
    motionAssetId: 'member-jisoo-motion',
    motionUrl: `${THREEJS_GLTF}/Parrot.glb`,
  },
};

/** 멤ber별 독립 avatar mesh URL */
const MEMBER_AVATAR_URLS: Record<string, string> = {
  jennie: 'https://models.readyplayer.me/64bfa15f0e72fc558b8f1144.glb?meshLod=0&textureAtlas=1024',
  lisa: 'https://models.readyplayer.me/64bfa1670e72fc558b8f1145.glb?meshLod=0&textureAtlas=1024',
  rose: 'https://models.readyplayer.me/64bfa1880e72fc558b8f1146.glb?meshLod=0&textureAtlas=1024',
  jisoo: 'https://models.readyplayer.me/64bfa1a90e72fc558b8f1147.glb?meshLod=0&textureAtlas=1024',
};

export const DEV_MOTION_FIXTURE_GROUP_ID = 'blackpink';

/** @deprecated 자동 로드 금지 — window.__K_ONNODE_GROUP_DEBUG__.loadFixture() 사용 */
export function shouldUseDevMotionFixture(_songId: string): boolean {
  return false;
}

function buildFixtureMembers(groupId: string): GroupMotionMember[] {
  const group = GROUP_DATA[groupId];
  if (!group) return [];

  return group.members.map((m) => {
    const motion = MEMBER_MOTION_SOURCES[m.id];
    if (!motion) {
      throw new Error(`[realMotionAssetFixture] no motion source for member ${m.id}`);
    }
    return {
      memberId: m.id,
      memberName: m.nameKr || m.name,
      motionAssetId: motion.motionAssetId,
      motionFormat: 'gltf_animation' as const,
      motionUrl: motion.motionUrl,
      formationAssetId: `formation-${m.id}`,
      formationTimeline: [
        { timeSec: 0, position: { x: m.defaultX, y: m.defaultY, z: 0 } },
      ],
    };
  });
}

export function buildRealMotionAssetFixture(opts: {
  groupId?: string;
  songId: string;
}): GroupMotionAsset {
  const groupId = opts.groupId || DEV_MOTION_FIXTURE_GROUP_ID;
  const song = getSongById(opts.songId);
  const members = buildFixtureMembers(groupId);

  return {
    assetId: `dev-motion-fixture:${groupId}:${opts.songId}`,
    groupId,
    songId: opts.songId,
    version: 'dev-fixture-1',
    durationSec: song?.duration ?? 30,
    fps: 30,
    status: 'motion_asset_ready',
    members,
    devFixture: true,
  };
}

export function buildDevProductionDanceAsset(songId: string): ProductionDanceAsset {
  const groupId = DEV_MOTION_FIXTURE_GROUP_ID;
  const group = GROUP_DATA[groupId];
  const song = getSongById(songId);

  return {
    id: `dev-production:${groupId}:${songId}`,
    groupId,
    songId,
    title: song?.title || songId,
    version: 1,
    durationSec: song?.duration ?? 30,
    fps: 30,
    members: (group?.members || []).map((m) => {
      const motion = MEMBER_MOTION_SOURCES[m.id]!;
      return {
        memberId: m.id,
        memberName: m.nameKr || m.name,
        motionAssetUrl: motion.motionUrl,
        motionFormat: 'glb',
        avatarAssetUrl: MEMBER_AVATAR_URLS[m.id] || '',
        avatarAssetId: `avatar-${m.id}`,
        formationTrack: [
          { timestamp: 0, position: { x: m.defaultX, y: m.defaultY, z: 0 } },
        ],
        motionDurationSec: song?.duration ?? 30,
        status: 'ready',
      };
    }),
    stage: {
      backgroundId: 'stage-default',
      cameraPreset: 'group-practice',
      stagePreset: 'default',
    },
    status: 'ready',
    provider: 'deepmotion',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function loadDevMotionFixturePractice(opts: {
  selectedMemberId: string;
  songId: string;
  referenceVideo?: import('../../../types/practiceSession').ReferenceVideoMeta;
}) {
  if (!isDevEnvironment()) {
    throw new Error('DEV fixture load is DEV-only — use loadProductionMotionAsset for production');
  }
  const motionAsset = buildRealMotionAssetFixture({ songId: opts.songId });
  const productionAsset = buildDevProductionDanceAsset(opts.songId);
  const { session, runtime } = await buildGroupPracticeSessionFromMotionAsset({
    motionAsset,
    selectedMemberId: opts.selectedMemberId,
    referenceVideo: opts.referenceVideo,
  });

  return {
    motionAsset,
    productionAsset,
    session: {
      ...session,
      productionDanceAsset: productionAsset,
      groupMotionAsset: motionAsset,
      motionAssetStatus: motionAsset.status,
      devMotionFixture: true,
    },
    runtime,
  };
}

export default buildRealMotionAssetFixture;
