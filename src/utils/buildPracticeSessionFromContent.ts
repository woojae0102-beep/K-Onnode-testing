// @ts-nocheck
/**
 * Pre-built GroupMotionContent → PracticeSessionData (extraction 없음).
 */
import { getSongById } from '../data/groupStudioSongs';
import type { GroupMotionContent, GroupPracticeRuntimeState } from '../types/groupMotionContent';
import type { PracticeSessionData, ReferenceVideoMeta } from '../types/practiceSession';
import { buildPracticeSessionData } from './buildPracticeSessionData';
import { applyRuntimeToContent, buildPositionMapFromRuntime } from '../services/group/buildGroupPracticeRuntime';
import type { DanceDatabase } from '../types/danceDatabase';
import { MOTION_PIPELINE_VERSION } from '../services/motion/GroupMotionPipeline';

export type BuildPracticeSessionFromContentInput = {
  content: GroupMotionContent;
  runtime: GroupPracticeRuntimeState;
  referenceVideo?: ReferenceVideoMeta;
};

function contentToDanceDatabase(
  content: GroupMotionContent,
  runtime: GroupPracticeRuntimeState,
): DanceDatabase {
  const enriched = applyRuntimeToContent(content, runtime);
  const positionMap = buildPositionMapFromRuntime(runtime, content.groupId);
  const song = getSongById(content.songId);
  return {
    version: '2.0',
    pipelineVersion: MOTION_PIPELINE_VERSION,
    preBuilt: true,
    groupId: content.groupId,
    songId: content.songId,
    videoId: content.videoId,
    detectedMemberCount: content.members.length,
    durationSec: content.durationSec,
    sourceVideoDurationSec: content.durationSec,
    sampleFps: content.sampleFps ?? 30,
    bpm: { bpm: content.bpm ?? song?.bpm ?? 120, estimated: false, source: 'song' },
    skeletonFrames: enriched.frames ?? [],
    memberTracks: content.members.map((m, i) => ({
      trackId: i + 1,
      memberId: m.memberId,
      initialPosition: {
        x: m.formationAnchor?.x ?? 0.5,
        y: m.formationAnchor?.y ?? 0.5,
      },
      avgConfidence: 1,
    })),
    formation: enriched.formation ?? {
      groupId: content.groupId,
      songId: content.songId,
      userMemberId: runtime.selectedMemberId,
      defaultFormation: 'diamond',
      segments: [],
      keyframes: [],
    },
    positionMap,
    formationHole: enriched.formationHole ?? {
      memberId: runtime.selectedMemberId,
      anchor: runtime.userSlot.formationAnchor ?? { x: 0.5, y: 0.5, z: 0 },
      label: runtime.userSlot.memberName,
      color: '#FF1F8E',
    },
    savedAt: content.savedAt ?? new Date().toISOString(),
  };
}

export async function buildPracticeSessionFromContent({
  content,
  runtime,
  referenceVideo = {},
}: BuildPracticeSessionFromContentInput): Promise<PracticeSessionData | null> {
  const danceDatabase = contentToDanceDatabase(content, runtime);
  const session = await buildPracticeSessionData({
    frames: danceDatabase.skeletonFrames,
    danceDatabase,
    groupId: content.groupId,
    songId: content.songId,
    userMemberId: runtime.selectedMemberId,
    sourceVideoDurationSec: content.durationSec,
    referenceVideo,
    preBuiltContent: true,
  });

  if (!session) return null;

  return {
    ...session,
    groupMotionContent: content,
    groupPracticeRuntime: runtime,
    contentSource: content.source,
    preBuiltContent: true,
  };
}

export default buildPracticeSessionFromContent;
