// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';
import type { AnalysisResult } from './videoAnalysisTypes';
import { fillMemberGapsInSkeletonFrames } from '../utils/skeletonTimelineUtils';
import { normalizeTrackMemberMap, resolveMemberForTrack } from '../utils/skeletonDataUtils';

export function jointsToSkeletonJoints(joints: Record<string, { x: number; y: number; z?: number; confidence?: number; visibility?: number }>) {
  const out: Record<string, { x: number; y: number; z: number; visibility?: number }> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    out[name] = {
      x: joint.x,
      y: joint.y,
      z: joint.z ?? 0,
      visibility: joint.visibility ?? joint.confidence ?? 1,
    };
  });
  return out;
}

export function buildSkeletonFramesFromAnalysis(
  analysisResult: AnalysisResult,
  trackToMemberMap: Map<number, string> | Record<string | number, string>,
  excludeMemberId: string,
): SkeletonFrameData[] {
  const map = normalizeTrackMemberMap(trackToMemberMap);
  const { videoWidth, videoHeight } = analysisResult;

  const memberIds = [
    ...new Set(
      [...map.values()].filter((id) => id && id !== excludeMemberId),
    ),
  ];

  if (!memberIds.length) {
    console.error('[buildSkeletonFrames] AI 멤버 매핑이 없습니다.', [...map.entries()]);
    return [];
  }

  if (!analysisResult.frames?.length) {
    console.error('[buildSkeletonFrames] 분석 프레임이 없습니다.');
    return [];
  }

  const rawFrames = analysisResult.frames
    .map((frame) => ({
      timestamp: frame.timestamp,
      timestampMs: frame.timestampMs ?? Math.round(frame.timestamp * 1000),
      videoWidth: frame.videoWidth ?? videoWidth,
      videoHeight: frame.videoHeight ?? videoHeight,
      members: (frame.detectedPeople || [])
        .map((person) => {
          const memberId = resolveMemberForTrack(map, person.trackId, excludeMemberId);
          if (!memberId) return null;
          const joints = jointsToSkeletonJoints(person.joints || {});
          if (!Object.keys(joints).length) return null;
          return {
            personIndex: Number(person.trackId),
            estimatedMemberId: memberId,
            isEstimated: person.isEstimated ?? false,
            joints,
          };
        })
        .filter(Boolean),
    }))
    .filter((frame) => frame.members.length > 0);

  if (!rawFrames.length) {
    console.error(
      '[buildSkeletonFrames] 트랙→멤버 매핑과 분석 프레임 trackId가 일치하지 않습니다.',
      {
        mapEntries: [...map.entries()],
        sampleTrackIds: analysisResult.frames[0]?.detectedPeople?.map((p) => p.trackId),
      },
    );
  }

  const filled = fillMemberGapsInSkeletonFrames(rawFrames, memberIds);

  if (import.meta.env?.DEV) {
    const mid = filled[Math.floor(filled.length / 2)];
    console.debug(
      `[buildSkeletonFrames] ${filled.length}프레임, AI멤버 ${memberIds.length}명, 샘플 프레임 멤버 ${mid?.members?.length ?? 0}명`,
    );
  }

  return filled;
}

export default buildSkeletonFramesFromAnalysis;
