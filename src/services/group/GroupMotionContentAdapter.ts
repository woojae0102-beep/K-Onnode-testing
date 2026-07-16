// @ts-nocheck
/**
 * DanceDatabase / ChoreographyDataset → GroupMotionContent (memberId 기반).
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { DanceDatabase } from '../../types/danceDatabase';
import type { ChoreographyDataset } from '../../types/groupChoreography';
import type { SkeletonFrameData } from '../../types/groupPractice';
import type {
  GroupMemberMotion,
  GroupMotionContent,
  GroupMotionContentSource,
  GroupFormationKeyframe,
} from '../../types/groupMotionContent';
import { buildMemberMotionTracks } from '../motion/MotionDatabaseEngine';

function memberName(groupId: string, memberId: string): string {
  const m = GROUP_DATA[groupId]?.members?.find((x) => x.id === memberId);
  return m?.nameKr || m?.name || memberId;
}

function extractMemberFrames(
  frames: SkeletonFrameData[],
  memberId: string,
): SkeletonFrameData[] {
  return frames
    .map((frame, frameIndex) => {
      const member = (frame.members || []).find(
        (m) => m.estimatedMemberId === memberId || (m as { memberId?: string }).memberId === memberId,
      );
      if (!member) return null;
      return {
        ...frame,
        frameIndex,
        members: [member],
      };
    })
    .filter(Boolean) as SkeletonFrameData[];
}

function buildFormationTimelineFromFrames(
  frames: SkeletonFrameData[],
  memberId: string,
): GroupFormationKeyframe[] {
  const out: GroupFormationKeyframe[] = [];
  frames.forEach((frame) => {
    const member = frame.members?.[0];
    const hips = member?.joints?.left_hip && member?.joints?.right_hip
      ? {
          x: (member.joints.left_hip.x + member.joints.right_hip.x) / 2,
          y: (member.joints.left_hip.y + member.joints.right_hip.y) / 2,
          z: ((member.joints.left_hip.z ?? 0) + (member.joints.right_hip.z ?? 0)) / 2,
        }
      : member?.joints?.nose
        ? { x: member.joints.nose.x, y: member.joints.nose.y, z: member.joints.nose.z ?? 0 }
        : null;
    if (!hips) return;
    const t = frame.sourceVideoTime ?? frame.timestamp ?? 0;
    out.push({ time: t, position: hips });
  });
  return out;
}

function memberMotionsFromFrames(
  groupId: string,
  frames: SkeletonFrameData[],
  memberIds: string[],
  choreographyMembers?: ChoreographyDataset['members'],
): GroupMemberMotion[] {
  const tracks = buildMemberMotionTracks(frames);
  return memberIds.map((memberId) => {
    const meta = choreographyMembers?.find((m) => m.memberId === memberId);
    const perMemberFrames = extractMemberFrames(frames, memberId);
    const track = tracks.get(memberId);
    return {
      memberId,
      memberName: meta?.displayNameKr || meta?.displayName || memberName(groupId, memberId),
      displayNameKr: meta?.displayNameKr,
      avatarId: memberId,
      motionFormat: 'skeleton_frames' as const,
      motionData: perMemberFrames,
      formationTimeline: buildFormationTimelineFromFrames(perMemberFrames, memberId),
      persona: meta?.persona,
      formationAnchor: meta?.formationAnchor,
    };
  });
}

export function choreographyDatasetToSkeletonFrames(
  dataset: ChoreographyDataset,
): SkeletonFrameData[] {
  return dataset.frames.map((frame, frameIndex) => ({
    timestamp: frame.timestamp,
    sourceVideoTime: frame.timestamp,
    frameIndex,
    members: frame.members.map((m) => ({
      estimatedMemberId: m.memberId,
      joints: m.joints,
      isEstimated: false,
    })),
  }));
}

export function adaptChoreographyDatasetToGroupMotionContent(
  dataset: ChoreographyDataset,
  source: GroupMotionContentSource = 'static_json',
): GroupMotionContent {
  const { groupId, songId } = dataset.meta;
  const frames = choreographyDatasetToSkeletonFrames(dataset);
  const memberIds = dataset.members.map((m) => m.memberId);
  return {
    id: `${groupId}/${songId}`,
    groupId,
    songId,
    version: Number(dataset.meta.version) || 1,
    durationSec: dataset.meta.durationSec,
    bpm: dataset.meta.bpm,
    sampleFps: dataset.meta.fps ?? 30,
    members: memberMotionsFromFrames(groupId, frames, memberIds, dataset.members),
    frames,
    formation: {
      groupId,
      songId,
      userMemberId: '',
      defaultFormation: dataset.meta.formation || 'diamond',
      segments: [],
      keyframes: [],
    },
    source,
    savedAt: new Date().toISOString(),
  };
}

export function adaptDanceDatabaseToGroupMotionContent(
  db: DanceDatabase,
  source: GroupMotionContentSource = 'indexeddb',
): GroupMotionContent {
  const group = GROUP_DATA[db.groupId];
  const memberIds = (group?.members || [])
    .map((m) => m.id)
    .filter((id) => {
      const hasSamples = db.motionTimelines?.some((t) => t.memberId === id && t.sampleCount > 0);
      const inFrames = db.skeletonFrames?.some(
        (f) => f.members?.some((m) => m.estimatedMemberId === id),
      );
      return hasSamples || inFrames;
    });

  const ids = memberIds.length
    ? memberIds
    : (group?.members || []).map((m) => m.id);

  return {
    id: `${db.groupId}/${db.songId}`,
    groupId: db.groupId,
    songId: db.songId,
    version: 2,
    durationSec: db.durationSec,
    bpm: db.bpm?.bpm,
    sampleFps: db.sampleFps,
    members: memberMotionsFromFrames(db.groupId, db.skeletonFrames, ids),
    frames: db.skeletonFrames,
    formation: db.formation,
    formationHole: db.formationHole,
    source,
    videoId: db.videoId,
    savedAt: db.savedAt,
  };
}

export function rebuildFormationHoleForMember(
  content: GroupMotionContent,
  selectedMemberId: string,
): import('../../types/danceDatabase').FormationHole | null {
  const group = GROUP_DATA[content.groupId];
  const member = group?.members?.find((m) => m.id === selectedMemberId);
  const motion = content.members.find((m) => m.memberId === selectedMemberId);
  const anchor = motion?.formationAnchor
    || motion?.formationTimeline?.[0]?.position
    || { x: 0.5, y: 0.5, z: 0 };
  if (!member) return null;
  return {
    memberId: selectedMemberId,
    anchor: { x: anchor.x, y: anchor.y, z: anchor.z ?? 0 },
    label: member.nameKr || member.name,
    color: member.color || '#FF1F8E',
  };
}
