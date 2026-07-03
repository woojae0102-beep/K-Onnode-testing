// @ts-nocheck
import type { DetectionFrame } from '../MultiPersonTracker';
import type { FormationTimeline } from '../../types/danceDatabase';
import { buildSkeletonFramesFromAnalysis } from '../videoAnalysisUtils';
import { analyzeFormationTimeline } from './FormationTimelineEngine';

/**
 * DetectionFrame → SkeletonFrameData 변환 후 FormationTimelineEngine 분석.
 * @deprecated 직접 analyzeFormationTimeline(skeletonFrames) 사용 권장
 */
export function buildFormationTimeline({
  groupId,
  songId,
  userMemberId,
  frames,
  trackToMember,
}: {
  groupId: string;
  songId: string;
  userMemberId: string;
  frames: DetectionFrame[];
  trackToMember: Map<number, string>;
}): FormationTimeline {
  const skeletonFrames = buildSkeletonFramesFromAnalysis(
    { frames, videoWidth: frames[0]?.videoWidth, videoHeight: frames[0]?.videoHeight } as any,
    trackToMember,
    userMemberId,
  );

  return analyzeFormationTimeline({
    groupId,
    songId,
    userMemberId,
    frames: skeletonFrames,
    trackToMember,
  });
}

export { analyzeFormationTimeline, resolveFormationAtTime } from './FormationTimelineEngine';
export default buildFormationTimeline;
