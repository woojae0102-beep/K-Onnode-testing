// @ts-nocheck
/**
 * GroupMotionAsset → practice session (skeleton bridge 없음).
 */
import type { ReferenceVideoMeta, PracticeSessionData } from '../../../types/practiceSession';
import { GROUP_DATA } from '../../../data/groupPracticeData';
import { getVisibleGroupMembers } from '../runtime/getVisibleGroupMembers';
import type { GroupMotionAsset } from '../types/GroupMotionAsset';
import type { GroupPracticeRuntimeState } from '../../../types/groupMotionContent';
import { getSongById } from '../../../data/groupStudioSongs';

export function buildGroupPracticeRuntimeFromMotionAsset(
  asset: GroupMotionAsset,
  selectedMemberId: string,
): GroupPracticeRuntimeState {
  const group = GROUP_DATA[asset.groupId];
  if (!group) throw new Error(`Unknown group: ${asset.groupId}`);

  const { userMember, visibleAiMembers } = getVisibleGroupMembers({
    members: asset.members.map((m) => ({ memberId: m.memberId, memberName: m.memberName })),
    selectedMemberId,
    mode: 'group-practice',
  });

  if (!userMember) {
    throw new Error(`Member ${selectedMemberId} not found in motion asset ${asset.assetId}`);
  }

  const fullUser = asset.members.find((m) => m.memberId === userMember.memberId)!;
  const aiAvatarMembers = visibleAiMembers.map((ai) => {
    const src = asset.members.find((m) => m.memberId === ai.memberId)!;
    return {
      memberId: src.memberId,
      memberName: src.memberName,
      motionAsset: src.motionUrl,
      motionFormat: src.motionFormat,
      formationTimeline: (src.formationTimeline || []).map((kf) => ({
        time: kf.timeSec,
        position: kf.position,
        rotation: kf.rotation,
      })),
    };
  });

  return {
    selectedMemberId,
    userSlot: {
      memberId: fullUser.memberId,
      memberName: fullUser.memberName,
      referenceMotion: {
        memberId: fullUser.memberId,
        memberName: fullUser.memberName,
        formationTimeline: (fullUser.formationTimeline || []).map((kf) => ({
          time: kf.timeSec,
          position: kf.position,
        })),
      },
      formationAnchor: fullUser.formationTimeline?.[0]?.position,
    },
    aiAvatarMembers,
  };
}

function buildPositionMap(
  asset: GroupMotionAsset,
  runtime: GroupPracticeRuntimeState,
) {
  const group = GROUP_DATA[asset.groupId];
  const anchors = new Map(
    (group?.members || []).map((m) => [m.id, { x: m.defaultX, y: m.defaultY }]),
  );
  return {
    userMemberId: runtime.selectedMemberId,
    aiMemberIds: runtime.aiAvatarMembers.map((m) => m.memberId),
    anchors,
  };
}

export async function buildGroupPracticeSessionFromMotionAsset(opts: {
  motionAsset: GroupMotionAsset;
  selectedMemberId: string;
  referenceVideo?: ReferenceVideoMeta;
}): Promise<{
  session: PracticeSessionData;
  runtime: GroupPracticeRuntimeState;
}> {
  const { motionAsset, selectedMemberId, referenceVideo = {} } = opts;
  const runtime = buildGroupPracticeRuntimeFromMotionAsset(motionAsset, selectedMemberId);
  const song = getSongById(motionAsset.songId);
  const durationSec = motionAsset.durationSec;
  const fps = motionAsset.fps || 30;
  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  const session: PracticeSessionData = {
    frames: [],
    referenceFrames: [],
    duration: durationSec,
    fps,
    totalFrames,
    formationTimeline: {
      groupId: motionAsset.groupId,
      songId: motionAsset.songId,
      userMemberId: selectedMemberId,
      defaultFormation: GROUP_DATA[motionAsset.groupId]?.defaultFormation || 'diamond',
      segments: [],
      keyframes: [],
    },
    memberTracks: motionAsset.members.map((m, i) => ({
      trackId: i + 1,
      memberId: m.memberId,
      initialPosition: {
        x: m.formationTimeline?.[0]?.position.x ?? 0.5,
        y: m.formationTimeline?.[0]?.position.y ?? 0.5,
      },
      avgConfidence: motionAsset.status === 'motion_asset_ready' ? 1 : 0,
    })),
    userMemberId: selectedMemberId,
    songId: motionAsset.songId,
    groupId: motionAsset.groupId,
    stageScale: { width: 4, height: 3, depth: 2 },
    coordinateSystem: 'normalized-0-1',
    referenceVideo,
    motionMetadata: {
      detectedMemberCount: motionAsset.members.length,
      aiMemberIds: runtime.aiAvatarMembers.map((m) => m.memberId),
      skeletonCoverageSec: 0,
      lastFrameTimestamp: 0,
      videoWidth: 0,
      videoHeight: 0,
      sampleFps: fps,
      builtAt: new Date().toISOString(),
      bpm: song?.bpm,
    },
    sourceVideoDurationSec: durationSec,
    positionMap: buildPositionMap(motionAsset, runtime),
    formationHole: {
      memberId: selectedMemberId,
      anchor: runtime.userSlot.formationAnchor || { x: 0.5, y: 0.5, z: 0 },
      label: runtime.userSlot.memberName,
      color: '#FF1F8E',
    },
    preBuiltContent: true,
    contentSource: 'production',
    groupPracticeRuntime: runtime,
    groupMotionAsset: motionAsset,
    motionAssetStatus: motionAsset.status,
  };

  return { session, runtime };
}

export default buildGroupPracticeSessionFromMotionAsset;
