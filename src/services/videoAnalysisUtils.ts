// @ts-nocheck
import type { SkeletonFrameData } from './groupPractice';
import { CHOREO_DEFAULT_SAMPLE_FPS } from '../config/choreoExtractConfig';
import type { AnalysisResult } from './videoAnalysisTypes';
import {
  computeBoundingBoxFromJoints,
  normalizeTrackMemberMap,
  resolveMemberForTrack,
} from '../utils/skeletonDataUtils';
import {
  sanitizeHolisticFace,
  sanitizeHolisticHand,
} from '../utils/holisticLandmarkUtils';
import { worldJointsToSkeletonWorldPoints } from '../utils/jointConfidenceFilter';

export function jointsToSkeletonJoints(joints: Record<string, { x: number; y: number; z?: number; confidence?: number; visibility?: number; presence?: number }>) {
  const out: Record<string, { x: number; y: number; z: number; visibility?: number; presence?: number; confidence?: number }> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    out[name] = {
      x: joint.x,
      y: joint.y,
      z: joint.z ?? 0,
      visibility: joint.visibility ?? joint.confidence ?? 1,
      presence: joint.presence,
      confidence: joint.confidence ?? joint.visibility ?? 1,
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

  const extractionFps = analysisResult.sampleFps ?? CHOREO_DEFAULT_SAMPLE_FPS;

  const rawFrames = analysisResult.frames
    .map((frame, frameIndex) => {
      const members = (frame.detectedPeople || [])
        .map((person) => {
          const memberId = resolveMemberForTrack(map, person.trackId, excludeMemberId);
          if (!memberId) return null;
          const joints = jointsToSkeletonJoints(person.joints || {});
          if (!Object.keys(joints).length) return null;
          const boundingBox = computeBoundingBoxFromJoints(joints);
          const worldCoordinates = person.worldJoints && Object.keys(person.worldJoints).length
            ? worldJointsToSkeletonWorldPoints(person.worldJoints)
            : undefined;
          return {
            personIndex: Number(person.trackId),
            trackId: Number(person.trackId),
            estimatedMemberId: memberId,
            isEstimated: person.isEstimated ?? false,
            confidence: person.confidence,
            joints,
            boundingBox,
            worldCoordinates,
            leftHand: sanitizeHolisticHand(person.leftHand),
            rightHand: sanitizeHolisticHand(person.rightHand),
            face: sanitizeHolisticFace(person.face),
          };
        })
        .filter(Boolean);

      const memberTracks = (frame.detectedPeople || []).map((person) => ({
        trackId: Number(person.trackId),
        memberId: resolveMemberForTrack(map, person.trackId, excludeMemberId),
        confidence: person.confidence,
      }));

      const frameConfidence = memberTracks.length
        ? memberTracks.reduce((sum, t) => sum + (t.confidence || 0), 0) / memberTracks.length
        : 0;

      const gridTimestamp = frameIndex / extractionFps;
      const sourceVideoTime = frame.sourceVideoTime ?? frame.timestamp;

      return {
        timestamp: gridTimestamp,
        timestampMs: Math.round(gridTimestamp * 1000),
        sourceVideoTime,
        frameIndex,
        videoWidth: frame.videoWidth ?? videoWidth,
        videoHeight: frame.videoHeight ?? videoHeight,
        members,
        memberTracks,
        confidence: frameConfidence,
        boundingBox: members.length
          ? members.reduce(
              (acc, m) => {
                const box = m.boundingBox;
                if (!box) return acc;
                if (!acc) return { ...box };
                return {
                  minX: Math.min(acc.minX, box.minX),
                  minY: Math.min(acc.minY, box.minY),
                  maxX: Math.max(acc.maxX, box.maxX),
                  maxY: Math.max(acc.maxY, box.maxY),
                };
              },
              null as { minX: number; minY: number; maxX: number; maxY: number } | null,
            ) ?? undefined
          : undefined,
      };
    })
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

  if (import.meta.env?.DEV) {
    const mid = rawFrames[Math.floor(rawFrames.length / 2)];
    console.debug(
      `[buildSkeletonFrames] ${rawFrames.length}프레임, AI멤버 ${memberIds.length}명, 샘플 프레임 멤버 ${mid?.members?.length ?? 0}명`,
    );
  }

  return rawFrames;
}

export default buildSkeletonFramesFromAnalysis;
