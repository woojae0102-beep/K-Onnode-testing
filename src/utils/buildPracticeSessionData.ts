// @ts-nocheck
import { CHOREO_SAMPLE_FPS } from '../config/choreoExtractConfig';
import { GROUP_DATA } from '../data/groupPracticeData';
import { getSongById } from '../data/groupStudioSongs';
import type { DanceDatabase } from '../types/danceDatabase';
import type { SkeletonFrameData } from '../types/groupPractice';
import type { ReferenceVideoMeta } from '../types/practiceSession';
import {
  DEFAULT_COORDINATE_SYSTEM,
  DEFAULT_STAGE_SCALE,
  type PracticeSessionData,
} from '../types/practiceSession';
import {
  auditSkeletonPipeline,
  validateSkeletonForPractice,
} from './skeletonDataUtils';
import { logUndefinedFields } from './practiceValidationDebug';
import {
  MOTION_PIPELINE_VERSION,
  runGroupMotionPipeline,
} from '../services/motion/GroupMotionPipeline';
import { summarizePoseQuality } from './frameMetadataUtils';
import { buildSkeletonRenderTimeline } from '../services/rendering/SkeletonTimelineBuilder';
import { PRACTICE_RENDER_FPS } from '../config/practiceRenderConfig';
import {
  resolvePracticeVideoDuration,
  resolveSkeletonLastTimestamp,
} from '../services/practice/PracticePlayer';

const DURATION_TOLERANCE_SEC = 0.5;

/**
 * 연습 타임라인 길이 — videoDuration = Timeline Duration.
 * HTMLVideoElement.duration 우선; skeleton 마지막 timestamp와 동기화.
 */
export function resolvePracticeDurationSec(
  sourceVideoDurationSec: number | null | undefined,
  frames?: import('../types/groupPractice').SkeletonFrameData[] | null,
): number | null {
  const duration = resolvePracticeVideoDuration(frames ?? [], sourceVideoDurationSec);
  return duration > 0 ? duration : null;
}

export function practiceDurationsMatch(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= DURATION_TOLERANCE_SEC;
}

export interface BuildPracticeSessionInput {
  frames: SkeletonFrameData[] | null | undefined;
  danceDatabase?: DanceDatabase | null;
  groupId: string;
  songId: string;
  userMemberId: string;
  sourceVideoDurationSec?: number | null;
  referenceVideo?: ReferenceVideoMeta;
}

/** completeChoreoExtract → GroupStudioSession 전달용 전체 패키지 생성 */
export function buildPracticeSessionData({
  frames,
  danceDatabase = null,
  groupId,
  songId,
  userMemberId,
  sourceVideoDurationSec = null,
  referenceVideo = {},
}: BuildPracticeSessionInput): PracticeSessionData | null {
  const group = GROUP_DATA[groupId];
  if (!group || !userMemberId) return null;

  const rawFrames = frames ?? danceDatabase?.skeletonFrames ?? [];
  if (!rawFrames.length) return null;

  const aiMemberIds =
    danceDatabase?.positionMap?.aiMemberIds?.length
      ? danceDatabase.positionMap.aiMemberIds
      : group.members.filter((m) => m.id !== userMemberId).map((m) => m.id);

  const allMemberIds = [userMemberId, ...aiMemberIds];
  const formationTimeline = danceDatabase?.formation ?? {
    groupId,
    songId,
    userMemberId,
    defaultFormation: group.defaultFormation || 'diamond',
    keyframes: [],
  };
  const memberTracks = danceDatabase?.memberTracks ?? [];

  const fps = danceDatabase?.sampleFps ?? CHOREO_SAMPLE_FPS;
  const bpmMeta = danceDatabase?.bpm ?? { bpm: getSongById(songId)?.bpm ?? 120 };
  const bpm = bpmMeta.bpm ?? 120;
  const videoDuration =
    sourceVideoDurationSec
    ?? danceDatabase?.sourceVideoDurationSec
    ?? null;
  const duration = resolvePracticeDurationSec(videoDuration, rawFrames);
  if (!duration || duration <= 0) {
    logUndefinedFields('buildPracticeSessionData.duration', {
      sourceVideoDurationSec,
      videoDuration,
      duration,
    }, ['duration', 'sourceVideoDurationSec']);
    console.error('[buildPracticeSessionData] invalid video duration', { videoDuration });
    return null;
  }

  const alreadyProcessed =
    danceDatabase?.pipelineVersion === MOTION_PIPELINE_VERSION
    && danceDatabase?.skeletonFrames?.length;

  let pipeline;
  try {
    pipeline = runGroupMotionPipeline({
      rawFrames,
      groupId,
      songId,
      userMemberId,
      allMemberIds,
      videoDurationSec: duration,
      fps,
      bpm,
      trackToMember: danceDatabase?.positionMap?.trackToMember,
      memberTracks,
      formationKeyframes: formationTimeline.keyframes || [],
      skipPostProcess: Boolean(alreadyProcessed),
    });
  } catch (err) {
    console.error('[buildPracticeSessionData] motion pipeline failed', err);
    return null;
  }

  const normalized = pipeline.frames;
  const timeline = pipeline.timeline;
  const validation = pipeline.validation;
  const renderTimeline = buildSkeletonRenderTimeline(normalized, duration, PRACTICE_RENDER_FPS);
  const practiceFps = PRACTICE_RENDER_FPS;
  const practiceTotalFrames = renderTimeline.totalFrames;
  const lastFrameTimestamp = resolveSkeletonLastTimestamp(normalized);
  const extractedFrameCount = pipeline.extractedFrameCount;
  const videoWidth = normalized[0]?.videoWidth ?? 1920;
  const videoHeight = normalized[0]?.videoHeight ?? 1080;

  const poseQuality = summarizePoseQuality(normalized);

  return {
    frames: normalized,
    duration: timeline.duration,
    fps: practiceFps,
    totalFrames: practiceTotalFrames,
    renderTimeline,
    extractedFrameCount,
    formationTimeline,
    memberTracks,
    userMemberId,
    songId,
    groupId,
    stageScale: DEFAULT_STAGE_SCALE,
    coordinateSystem: DEFAULT_COORDINATE_SYSTEM,
    referenceVideo: {
      videoId: referenceVideo.videoId ?? danceDatabase?.videoId ?? null,
      youtubeUrl: referenceVideo.youtubeUrl ?? null,
      fromCache: referenceVideo.fromCache ?? false,
      blobCacheKey: referenceVideo.blobCacheKey ?? null,
      localPlaybackUrl: referenceVideo.localPlaybackUrl ?? null,
      mimeType: referenceVideo.mimeType ?? null,
      durationSec: referenceVideo.durationSec ?? timeline.duration,
    },
    motionPipelineAudit: pipeline.audit,
    motionMetadata: {
      detectedMemberCount: danceDatabase?.detectedMemberCount ?? validation.aiMemberCount + 1,
      aiMemberIds: validation.aiMemberIds,
      skeletonCoverageSec: lastFrameTimestamp,
      lastFrameTimestamp,
      videoWidth,
      videoHeight,
      sampleFps: timeline.fps,
      extractedFrameCount,
      timeline: { ...timeline, fps: practiceFps, totalFrames: practiceTotalFrames },
      builtAt: new Date().toISOString(),
      pipelineAudit: auditSkeletonPipeline(rawFrames, normalized, userMemberId),
      validationReport: validation.report,
      poseQuality,
      bpm,
    },
    sourceVideoDurationSec: timeline.duration,
    positionMap: danceDatabase?.positionMap,
    formationHole: danceDatabase?.formationHole,
    detectedMemberCount: danceDatabase?.detectedMemberCount ?? validation.aiMemberCount + 1,
    videoWidth,
    videoHeight,
  };
}

export default buildPracticeSessionData;
