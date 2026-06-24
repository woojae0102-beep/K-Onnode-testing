// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';
import type { AnalysisResult } from './videoAnalysisTypes';

export function jointsToSkeletonJoints(joints: Record<string, { x: number; y: number; z?: number; confidence?: number; visibility?: number }>) {
  const out: Record<string, { x: number; y: number; z: number; visibility?: number }> = {};
  Object.entries(joints).forEach(([name, joint]) => {
    out[name] = {
      x: joint.x,
      y: joint.y,
      z: joint.z ?? 0,
      visibility: joint.visibility ?? joint.confidence,
    };
  });
  return out;
}

/** 트랙→멤버 매핑으로 SkeletonFrameData 생성. 선택 멤버는 AI 아바타 데이터에서 제외 */
export function buildSkeletonFramesFromAnalysis(
  analysisResult: AnalysisResult,
  trackToMemberMap: Map<number, string>,
  excludeMemberId: string,
): SkeletonFrameData[] {
  return analysisResult.frames
    .map((frame) => ({
      timestamp: frame.timestamp,
      members: frame.detectedPeople
        .map((person) => {
          const memberId = trackToMemberMap.get(person.trackId);
          if (!memberId || memberId === excludeMemberId) return null;
          return {
            personIndex: person.trackId,
            estimatedMemberId: memberId,
            joints: jointsToSkeletonJoints(person.joints),
          };
        })
        .filter(Boolean),
    }))
    .filter((frame) => frame.members.length > 0);
}

export default buildSkeletonFramesFromAnalysis;
