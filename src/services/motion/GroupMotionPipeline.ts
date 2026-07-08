// @ts-nocheck
/**
 * 그룹 모션 파이프라인 v5.0 — 전체 연습 파이프라인 오케스트레이터.
 *
 * Video
 *   ↓ Pose Extraction (MotionExtractionEngine)
 *   ↓ [1] normalize
 *   ↓ [2] confidence
 *   ↓ [3] smooth?
 *   ↓ [4] tracking
 *   ↓ [5] interpolation
 *   ↓ [6] formation_detection
 *   ↓ [7] member_identification
 *   ↓ [8] motion_timeline + motion_database
 *   ↓ [9] orientation
 *   ↓ [10] joint_rotation
 *   ↓ [11] formation metadata
 *   ↓ [12] timeline grid
 *   ↓ [13] metadata
 *   ↓ [14] validate
 *   ↓ Motion Database → Avatar Retarget → Group Stage
 */

import type { FormationKeyframe, MemberTrackMeta } from '../../types/danceDatabase';
import type { SkeletonFrameData } from '../../types/groupPractice';
import type { PracticeTimeline } from '../../utils/practiceTimelineUtils';
import {
  computePracticeTimeline,
  normalizeFrameTimestampsToFpsGrid,
} from '../../utils/practiceTimelineUtils';
import { resolvePracticeDurationSec } from '../../utils/buildPracticeSessionData';
import {
  attachSessionMetadataToFrames,
  normalizeSkeletonFrames,
  validateSkeletonForPractice,
  type SkeletonValidationResult,
} from '../../utils/skeletonDataUtils';
import { interpolateSkeletonFrameGaps } from '../skeleton/FrameInterpolationEngine';
import { stabilizeSkeletonMemberTracks } from '../skeleton/SkeletonMemberTracker';
import { interpolateLowConfidenceJoints } from '../../utils/jointConfidenceFilter';
import { normalizeMemberPoseScale } from '../../utils/skeletonPoseNormalize';
import { enrichSkeletonFrameMetadata } from '../../utils/frameMetadataUtils';
import { smoothSkeletonFrames } from './JointKalmanFilter';
import { applyMemberMotionDatabase } from './MotionDatabaseEngine';
import { analyzeFormationTimeline } from '../dance/FormationTimelineEngine';
import { identifyMembersFromTracks } from './MemberIdentificationEngine';
import { buildMemberMotionTimelines } from './MotionTimelineEngine';
import { applyOrientationToFrames } from './OrientationEngine';
import { applyJointRotationsToFrames } from './JointRotationEngine';

export const MOTION_PIPELINE_VERSION = '5.0';

export const MOTION_PIPELINE_STAGES = [
  'normalize',
  'confidence',
  'smooth',
  'tracking',
  'interpolation',
  'formation_detection',
  'member_identification',
  'motion_timeline',
  'motion_database',
  'orientation',
  'joint_rotation',
  'formation',
  'timeline',
  'metadata',
  'validate',
] as const;

export type MotionPipelineStageId = (typeof MOTION_PIPELINE_STAGES)[number];

export interface MotionPipelineStageAudit {
  applied: boolean;
  inputFrames?: number;
  outputFrames?: number;
  interpolatedMembers?: number;
  identifiedMembers?: number;
  error?: string;
}

export interface MotionPipelineAudit {
  version: string;
  ranAt: string;
  stages: Partial<Record<MotionPipelineStageId, MotionPipelineStageAudit>>;
  inputFrameCount: number;
  outputFrameCount: number;
  interpolatedMemberCount: number;
  timeline: PracticeTimeline | null;
  motionTimelineMemberCount?: number;
}

export interface GroupMotionPipelineInput {
  rawFrames: SkeletonFrameData[];
  groupId?: string;
  songId?: string;
  userMemberId: string;
  allMemberIds: string[];
  videoDurationSec: number;
  fps: number;
  bpm?: number;
  trackToMember?: Record<number, string> | Map<number, string>;
  memberTracks?: MemberTrackMeta[];
  formationKeyframes?: FormationKeyframe[];
  applySmoothing?: boolean;
  skipPostProcess?: boolean;
  /** 추출 단계: 보간·타임라인 리그리드 없이 원본 프레임 유지 */
  preserveExtractionFrames?: boolean;
}

export interface GroupMotionPipelineResult {
  frames: SkeletonFrameData[];
  timeline: PracticeTimeline;
  extractedFrameCount: number;
  validation: SkeletonValidationResult;
  audit: MotionPipelineAudit;
  motionTimelines?: ReturnType<typeof buildMemberMotionTimelines>;
  memberIdentification?: ReturnType<typeof identifyMembersFromTracks>;
  formationTimeline?: ReturnType<typeof analyzeFormationTimeline>;
}

function countInterpolatedMembers(frames: SkeletonFrameData[]): number {
  let count = 0;
  frames.forEach((frame) => {
    frame.members?.forEach((m) => {
      if (m.isEstimated) count += 1;
    });
  });
  return count;
}

function stage(
  audit: MotionPipelineAudit,
  id: MotionPipelineStageId,
  applied: boolean,
  extra: Partial<MotionPipelineStageAudit> = {},
) {
  audit.stages[id] = { applied, ...extra };
}

export function runGroupMotionPipeline({
  rawFrames,
  groupId,
  songId = 'unknown',
  userMemberId,
  allMemberIds,
  videoDurationSec,
  fps,
  bpm = 120,
  trackToMember,
  memberTracks: inputMemberTracks = [],
  formationKeyframes: inputFormationKeyframes = [],
  applySmoothing = false,
  skipPostProcess = false,
  preserveExtractionFrames = false,
}: GroupMotionPipelineInput): GroupMotionPipelineResult {
  let formationKeyframes = [...inputFormationKeyframes];
  let memberTracks = [...inputMemberTracks];
  let motionTimelines: ReturnType<typeof buildMemberMotionTimelines> | undefined;
  let memberIdentification: ReturnType<typeof identifyMembersFromTracks> | undefined;
  let formationTimeline: ReturnType<typeof analyzeFormationTimeline> | undefined;

  const audit: MotionPipelineAudit = {
    version: MOTION_PIPELINE_VERSION,
    ranAt: new Date().toISOString(),
    stages: {},
    inputFrameCount: rawFrames?.length ?? 0,
    outputFrameCount: 0,
    interpolatedMemberCount: 0,
    timeline: null,
  };

  if (!rawFrames?.length) {
    throw new Error('[GroupMotionPipeline] 입력 프레임이 비어 있습니다.');
  }

  const duration = resolvePracticeDurationSec(videoDurationSec, rawFrames);
  if (!duration) {
    throw new Error('[GroupMotionPipeline] video.duration가 유효하지 않습니다.');
  }

  const timeline = computePracticeTimeline(duration, fps);
  if (!timeline) {
    throw new Error('[GroupMotionPipeline] timeline(duration × fps) 계산 실패');
  }
  audit.timeline = timeline;

  let frames = rawFrames;

  if (skipPostProcess) {
    MOTION_PIPELINE_STAGES.forEach((id) => stage(audit, id, false, { error: 'skipPostProcess' }));
    frames = enrichSkeletonFrameMetadata(frames, {
      bpm,
      fps: timeline.fps,
      sourceVideoDurationSec: duration,
      memberTracks,
      formationKeyframes,
    });
    stage(audit, 'metadata', true);
    stage(audit, 'validate', true);
    const validation = validateSkeletonForPractice(frames, userMemberId, {
      skipNormalize: true,
      expectedDurationSec: duration,
    });
    audit.outputFrameCount = frames.length;
    audit.interpolatedMemberCount = countInterpolatedMembers(frames);
    return { frames, timeline, extractedFrameCount: frames.length, validation, audit };
  }

  // [1] normalize
  frames = normalizeSkeletonFrames(frames);
  frames = frames.map((frame) => ({
    ...frame,
    members: frame.members.map((m) => normalizeMemberPoseScale(m)),
  }));
  stage(audit, 'normalize', true, { inputFrames: rawFrames.length, outputFrames: frames.length });
  if (!frames.length) throw new Error('[GroupMotionPipeline] normalize 후 프레임 없음');

  // [2] confidence — 추출 단계는 원본 관절 유지 (보간은 렌더링에서)
  if (preserveExtractionFrames) {
    stage(audit, 'confidence', false, { error: 'preserveExtractionFrames' });
  } else {
    frames = interpolateLowConfidenceJoints(frames);
    stage(audit, 'confidence', true, { outputFrames: frames.length });
  }

  // [3] smooth
  if (applySmoothing) {
    frames = smoothSkeletonFrames(frames);
    stage(audit, 'smooth', true);
  } else {
    stage(audit, 'smooth', false);
  }

  // [4] tracking
  frames = stabilizeSkeletonMemberTracks(frames, {
    trackToMember,
    bpm,
    sampleFps: timeline.fps,
    maxTracks: allMemberIds?.length || 9,
  });
  stage(audit, 'tracking', true, { outputFrames: frames.length });

  // [5] interpolation — 추출 단계 스킵 (렌더링에서 수행)
  if (preserveExtractionFrames) {
    stage(audit, 'interpolation', false, { error: 'preserveExtractionFrames' });
  } else {
    const beforeInterp = countInterpolatedMembers(frames);
    frames = interpolateSkeletonFrameGaps(frames, allMemberIds);
    stage(audit, 'interpolation', true, {
      interpolatedMembers: Math.max(0, countInterpolatedMembers(frames) - beforeInterp),
      outputFrames: frames.length,
    });
  }

  if (groupId && allMemberIds.length > 1) {
    const trackMap = trackToMember instanceof Map
      ? trackToMember
      : trackToMember
        ? new Map(Object.entries(trackToMember).map(([k, v]) => [Number(k), v]))
        : new Map();

    // [6] formation_detection
    formationTimeline = analyzeFormationTimeline({
      groupId,
      songId,
      userMemberId,
      frames,
      trackToMember: trackMap,
    });
    if (!formationKeyframes.length && formationTimeline.keyframes?.length) {
      formationKeyframes = formationTimeline.keyframes;
    }
    stage(audit, 'formation_detection', true, {
      outputFrames: formationTimeline.segments?.length ?? 0,
    });

    // [7] member_identification
    memberIdentification = identifyMembersFromTracks(frames, trackMap, allMemberIds, userMemberId);
    if (memberIdentification.memberTracks.length) {
      memberTracks = memberIdentification.memberTracks;
    }
    stage(audit, 'member_identification', true, {
      identifiedMembers: memberIdentification.identifiedCount,
    });

    // [8] motion_timeline + motion_database
    const maxLiveDetected = Math.max(
      0,
      ...frames.map((f) => (f.members || []).filter((m) => !m.isEstimated).length),
    );
    const singleDancerMode = maxLiveDetected <= 1;

    frames = applyMemberMotionDatabase(frames, {
      allMemberIds,
      userMemberId,
      singleDancerMode,
      formationContext: {
        groupId,
        focusMemberId: userMemberId,
        allMemberIds,
        formationTimeline,
        formationKeyframes,
      },
    });
    stage(audit, 'motion_database', true, { outputFrames: frames.length });

    motionTimelines = buildMemberMotionTimelines(
      frames,
      allMemberIds.filter((id) => id !== userMemberId),
    );
    audit.motionTimelineMemberCount = motionTimelines.size;
    stage(audit, 'motion_timeline', true, {
      identifiedMembers: motionTimelines.size,
    });
  } else {
    stage(audit, 'formation_detection', false);
    stage(audit, 'member_identification', false);
    stage(audit, 'motion_timeline', false);
    stage(audit, 'motion_database', false);
  }

  // [9] orientation — 앞/뒤/45°/90°
  frames = applyOrientationToFrames(frames);
  stage(audit, 'orientation', true, { outputFrames: frames.length });

  // [10] joint_rotation — Quaternion (GLB 리타겟)
  frames = applyJointRotationsToFrames(frames);
  stage(audit, 'joint_rotation', true, { outputFrames: frames.length });

  // [11] formation metadata
  frames = attachSessionMetadataToFrames(frames, { memberTracks, formationKeyframes });
  stage(audit, 'formation', true, { outputFrames: frames.length });

  // [12] timeline grid — 추출 단계는 30fps 그리드 timestamp 유지
  if (preserveExtractionFrames) {
    stage(audit, 'timeline', false, { error: 'preserveExtractionFrames' });
  } else {
    frames = normalizeFrameTimestampsToFpsGrid(frames, timeline.fps);
    stage(audit, 'timeline', true, { outputFrames: frames.length });
  }

  // [13] metadata
  frames = enrichSkeletonFrameMetadata(frames, {
    bpm,
    fps: timeline.fps,
    sourceVideoDurationSec: duration,
    memberTracks,
    formationKeyframes,
  });
  stage(audit, 'metadata', true);

  // [14] validate
  const validation = validateSkeletonForPractice(frames, userMemberId, {
    skipNormalize: true,
    expectedDurationSec: duration,
  });
  stage(audit, 'validate', true, { error: validation.valid ? undefined : validation.reason });

  if (!validation.valid) {
    throw new Error(validation.reason || '[GroupMotionPipeline] 스켈레톤 검증 실패');
  }

  audit.outputFrameCount = frames.length;
  audit.interpolatedMemberCount = countInterpolatedMembers(frames);

  if (import.meta.env?.DEV) {
    console.debug('[GroupMotionPipeline] v5.0 완료', {
      stages: Object.keys(audit.stages),
      motionMembers: audit.motionTimelineMemberCount,
      formationSegments: formationTimeline?.segments?.length,
    });
  }

  return {
    frames,
    timeline,
    extractedFrameCount: frames.length,
    validation,
    audit,
    motionTimelines,
    memberIdentification,
    formationTimeline,
  };
}

export default runGroupMotionPipeline;
