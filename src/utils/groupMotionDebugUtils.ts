// @ts-nocheck
import type { MotionPipelineAudit } from '../services/motion/GroupMotionPipeline';
import type { MemberMotionTimeline } from '../services/motion/MotionTimelineEngine';
import {
  EMPTY_GROUP_MOTION_DEBUG,
  type GroupMotionEngineDebugState,
} from '../types/groupMotionEngine';
import type { SkeletonFrameData } from '../types/groupPractice';
import type { PracticeSessionData } from '../types/practiceSession';
import { computeMemberPoseConfidence } from './jointConfidenceFilter';

export function buildGroupMotionDebugFromFrame(
  frame: SkeletonFrameData | null | undefined,
  overrides: Partial<GroupMotionEngineDebugState> = {},
): GroupMotionEngineDebugState {
  if (!frame) return { ...EMPTY_GROUP_MOTION_DEBUG, ...overrides };

  const members = frame.members || [];
  const visible = members.filter((m) => !m.isEstimated);
  const estimated = members.filter((m) => m.isEstimated);

  return {
    ...EMPTY_GROUP_MOTION_DEBUG,
    frameIndex: frame.frameIndex ?? 0,
    timestamp: frame.timestamp ?? 0,
    trackedCount: members.length,
    visibleCount: visible.length,
    estimatedCount: estimated.length,
    activeTrackIds: members.map((m) => Number(m.trackId ?? 0)),
    avgPoseConfidence:
      members.reduce((s, m) => s + computeMemberPoseConfidence(m), 0) / Math.max(1, members.length),
    formationType: frame.formationType ?? frame.formation?.formationType ?? null,
    formationTransition: frame.formation?.transition ?? null,
    orientationLabels: members.map((m) => m.orientation?.label ?? 'unknown'),
    interpolationActive: estimated.length > 0,
    pipelineStage: overrides.pipelineStage ?? 'playback',
    ...overrides,
  };
}

export function buildMotionTimelineCoverage(
  frames: SkeletonFrameData[],
  memberIds: string[],
): Record<string, number> {
  const coverage: Record<string, number> = {};
  memberIds.forEach((id) => {
    let real = 0;
    let total = 0;
    frames.forEach((f) => {
      const m = f.members?.find((mem) => mem.estimatedMemberId === id);
      if (m) {
        total += 1;
        if (!m.isEstimated) real += 1;
      }
    });
    coverage[id] = real / Math.max(1, total);
  });
  return coverage;
}

export function buildGroupMotionDebugFromAudit(
  audit: MotionPipelineAudit | null | undefined,
  options: {
    motionTimelines?: MemberMotionTimeline[];
    lastFrame?: SkeletonFrameData | null;
    fromCache?: boolean;
  } = {},
): GroupMotionEngineDebugState {
  const { motionTimelines, lastFrame, fromCache = false } = options;
  const base = lastFrame
    ? buildGroupMotionDebugFromFrame(lastFrame, { pipelineStage: 'complete' })
    : { ...EMPTY_GROUP_MOTION_DEBUG, pipelineStage: 'complete' };

  const coverage: Record<string, number> = {};
  motionTimelines?.forEach((t) => {
    coverage[t.memberId] = t.realSampleCount / Math.max(1, t.sampleCount);
  });

  return {
    ...base,
    pipelineStage: audit ? `pipeline_v${audit.version}` : base.pipelineStage,
    interpolationActive: (audit?.interpolatedMemberCount ?? 0) > 0,
    motionTimelineCoverage: Object.keys(coverage).length ? coverage : base.motionTimelineCoverage,
    cacheHit: fromCache,
  };
}

export function buildGroupMotionDebugFromSession(
  practiceSessionData: PracticeSessionData,
  frame: SkeletonFrameData | null | undefined,
  effectiveTime: number,
): GroupMotionEngineDebugState {
  const audit = practiceSessionData.motionPipelineAudit;
  const aiIds = practiceSessionData.motionMetadata?.aiMemberIds ?? [];
  const coverage = buildMotionTimelineCoverage(practiceSessionData.frames, aiIds);

  return buildGroupMotionDebugFromFrame(frame, {
    timestamp: frame?.timestamp ?? effectiveTime,
    pipelineStage: audit ? `v${audit.version}` : 'playback',
    motionTimelineCoverage: coverage,
    interpolationActive: (audit?.interpolatedMemberCount ?? 0) > 0,
    cacheHit: practiceSessionData.referenceVideo?.fromCache ?? false,
    singleDancerMode: (practiceSessionData.detectedMemberCount ?? 1) <= 1,
  });
}
