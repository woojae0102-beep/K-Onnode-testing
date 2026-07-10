// @ts-nocheck
/**
 * K-POP Group Motion Reconstruction Engine
 *
 * Video → Pose → Tracking → Interpolation → Formation → Member ID
 *   → Motion Timeline → Motion Database → Orientation → Joint Rotation
 *   → Avatar Retarget → Group Stage
 *
 * Skeleton 복사 금지 — 멤버별 실제 Motion Timeline 기반 AI 생성.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { DanceDatabase, FormationTimeline } from '../../types/danceDatabase';
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import {
  EMPTY_GROUP_MOTION_DEBUG,
  type GroupMotionEngineDebugState,
  type GroupMotionEngineMetadata,
  type GroupMotionReconstructionOptions,
  type GroupMotionReconstructionResult,
} from '../../types/groupMotionEngine';
import { MemberTrackingEngine } from './MemberTrackingEngine';
import {
  buildMemberMotionTracks,
  resolveMembersFromStoredMotionDatabase,
} from './MotionDatabaseEngine';
import { buildMemberMotionTimelines } from './MotionTimelineEngine';
import { resolveFormationAtTime } from '../dance/FormationTimelineEngine';
import { identifyMembersFromTracks } from './MemberIdentificationEngine';
import { runGroupMotionPipeline, MOTION_PIPELINE_VERSION } from './GroupMotionPipeline';
import { computeMemberPoseConfidence } from '../../utils/jointConfidenceFilter';
import {
  getCachedChoreo,
  isChoreoCacheValid,
  saveCachedChoreo,
  CHOREO_CACHE_PIPELINE_VERSION,
} from '../groupChoreoCache';
import {
  isProfileEnabled,
  profileBeginFrame,
  profileEndFrame,
  profileRecordBytes,
  profileStep,
} from '../../benchmark/reconstructFrameProfiler';
import {
  frameStepContext,
  logMotionPipelineStepFailure,
  runMotionPipelineStep,
  summarizeMembers,
} from '../../utils/motionPipelineStepDiagnostics';

export const GROUP_MOTION_ENGINE_VERSION = '1.0';

let defaultEngine: GroupMotionReconstructionEngine | null = null;

export function getDefaultGroupMotionEngine(): GroupMotionReconstructionEngine {
  if (!defaultEngine) defaultEngine = new GroupMotionReconstructionEngine();
  return defaultEngine;
}

export class GroupMotionReconstructionEngine {
  private tracker = new MemberTrackingEngine();

  private debug: GroupMotionEngineDebugState = { ...EMPTY_GROUP_MOTION_DEBUG };

  private metadata: Partial<GroupMotionEngineMetadata> = {};

  private formationTimeline: FormationTimeline | null = null;

  private motionTimelines = new Map<string, import('./MotionTimelineEngine').MemberMotionTimeline>();

  private occlusionRecoveryTotal = 0;

  private previousFrame: SkeletonFrameData | null = null;

  reset() {
    this.tracker.reset();
    this.debug = { ...EMPTY_GROUP_MOTION_DEBUG };
    this.metadata = {};
    this.formationTimeline = null;
    this.motionTimelines.clear();
    this.occlusionRecoveryTotal = 0;
    this.previousFrame = null;
  }

  getDebugState(): GroupMotionEngineDebugState {
    return { ...this.debug };
  }

  getMetadata(): GroupMotionEngineMetadata | null {
    if (!this.metadata.groupId) return null;
    return this.metadata as GroupMotionEngineMetadata;
  }

  /**
   * Motion Database 기반 AI 멤버 생성 — Skeleton 복사 금지.
   * 1) 저장된 DB skeletonFrames
   * 2) 세션 누적 live Motion Timeline
   * 3) 프레임 실측 live detection
   */
  generateAIMembers(
    frame: SkeletonFrameData,
    options: GroupMotionReconstructionOptions,
  ): SkeletonMemberData[] {
    const { userMemberId, allMemberIds, motionDatabase, groupId } = options;
    const aiIds = allMemberIds.filter((id) => id && id !== userMemberId);
    const group = GROUP_DATA[groupId];
    if (!group) return frame.members || [];

    if (motionDatabase?.skeletonFrames?.length) {
      return resolveMembersFromStoredMotionDatabase(
        frame,
        motionDatabase.skeletonFrames,
        group.members.map((m) => m.id),
        userMemberId,
      );
    }

    const liveById = new Map(
      (frame.members || [])
        .filter((m) => m.estimatedMemberId && m.estimatedMemberId !== userMemberId)
        .map((m) => [m.estimatedMemberId, m]),
    );

    return aiIds.map((memberId, idx) => {
      const live = liveById.get(memberId);
      if (live?.joints && Object.keys(live.joints).length && !live.isEstimated) {
        return { ...live, trackId: live.trackId ?? idx, personIndex: live.personIndex ?? idx };
      }

      const timeline = this.motionTimelines.get(memberId);
      if (timeline?.samples?.length) {
        const sorted = timeline.samples;
        const prevSample = [...sorted].reverse().find((s) => s.timestamp <= frame.timestamp);
        const nextSample = sorted.find((s) => s.timestamp >= frame.timestamp);

        if (prevSample && nextSample && prevSample.timestamp !== nextSample.timestamp) {
          const ratio = (frame.timestamp - prevSample.timestamp)
            / (nextSample.timestamp - prevSample.timestamp);
          const prevMember: SkeletonMemberData = {
            personIndex: idx,
            trackId: idx,
            estimatedMemberId: memberId,
            joints: prevSample.joints,
            worldCoordinates: prevSample.worldCoordinates,
            confidence: prevSample.confidence,
          };
          const nextMember: SkeletonMemberData = {
            personIndex: idx,
            trackId: idx,
            estimatedMemberId: memberId,
            joints: nextSample.joints,
            worldCoordinates: nextSample.worldCoordinates,
            confidence: nextSample.confidence,
          };
          const held = this.tracker.interpolateMemberHold(
            memberId,
            prevMember,
            nextMember,
            Math.min(1, Math.max(0, ratio)),
            frame.timestamp,
          );
          if (held) return { ...held, trackId: idx, personIndex: idx, estimatedMemberId: memberId };
        }

        const nearest = sorted.reduce((best, s) =>
          Math.abs(s.timestamp - frame.timestamp) < Math.abs(best.timestamp - frame.timestamp) ? s : best,
        );
        if (nearest?.joints && Object.keys(nearest.joints).length) {
          return {
            personIndex: idx,
            trackId: idx,
            estimatedMemberId: memberId,
            joints: nearest.joints,
            worldCoordinates: nearest.worldCoordinates,
            orientation: nearest.orientation,
            boneRotations: nearest.boneRotations,
            confidence: nearest.confidence,
            isEstimated: true,
          };
        }
      }

      return live || null;
    }).filter(Boolean) as SkeletonMemberData[];
  }

  /** 단일 프레임 재구성 — 스트리밍/실시간용 */
  reconstructFrame(
    frame: SkeletonFrameData,
    options: GroupMotionReconstructionOptions,
    detectedCount?: number,
  ): SkeletonFrameData {
    const t0 = isProfileEnabled() ? performance.now() : 0;
    const stepCtx = frameStepContext(frame);
    if (isProfileEnabled()) {
      profileBeginFrame(frame.frameIndex ?? 0, frame.timestamp);
    }

    const {
      groupId,
      userMemberId,
      allMemberIds,
      bpm = 120,
      sampleFps = 30,
      motionDatabase,
      formationTimeline,
    } = options;

    const count = detectedCount ?? (frame.members || []).filter((m) => !m.isEstimated).length;
    let members = frame.members || [];
    let formationKf: import('../../types/danceDatabase').FormationKeyframe | null = null;
    let out: SkeletonFrameData;

    try {
      if (motionDatabase?.skeletonFrames?.length) {
        members = runMotionPipelineStep(
          'STEP 1 generateAIMembers (motionDatabase)',
          () => (isProfileEnabled()
            ? profileStep('generateAI', () => this.generateAIMembers(frame, options))
            : this.generateAIMembers(frame, options)) as SkeletonMemberData[],
          { ...stepCtx, path: 'motion_database' },
        );
        this.debug.pipelineStage = 'motion_database';
      } else if (count > 1) {
        const trackCtx = {
          ...stepCtx,
          detectedCount: count,
          previousMemberCount: this.previousFrame?.members?.length ?? 0,
          currentMembers: summarizeMembers(members),
          previousMembers: summarizeMembers(this.previousFrame?.members),
        };

        let trackResult: import('./MemberTrackingEngine').MemberTrackingResult;
        try {
          trackResult = runMotionPipelineStep(
            this.previousFrame?.members?.length
              ? 'STEP 2 trackMembers'
              : 'STEP 2 seedMembers',
            () => {
              const run = () => (
                this.previousFrame?.members?.length
                  ? this.tracker.trackMembers(members, this.previousFrame.members, {
                      bpm,
                      sampleFps,
                      timestamp: frame.timestamp,
                      prevTimestamp: this.previousFrame.timestamp,
                      maxTracks: allMemberIds.length || 9,
                      debugFrameIndex: frame.frameIndex,
                      debugTimestamp: frame.timestamp,
                      debugMemberCount: members.length,
                    })
                  : {
                      members: this.tracker.seedMembers(members, {
                        debugFrameIndex: frame.frameIndex,
                        debugTimestamp: frame.timestamp,
                      }),
                      occlusionRecoveries: 0,
                      avgVelocity: 0,
                      identityConfidence: {},
                    }
              );
              return (isProfileEnabled() ? profileStep('trackingTotal', run) : run()) as import('./MemberTrackingEngine').MemberTrackingResult;
            },
            trackCtx,
          );
        } catch (error) {
          logMotionPipelineStepFailure('STEP 2 trackMembers/seedMembers', error, trackCtx);
          throw error;
        }

        members = trackResult.members;
        profileRecordBytes('members', members);
        this.occlusionRecoveryTotal += trackResult.occlusionRecoveries;
        this.debug.pipelineStage = 'adaptive_tracking';
        this.debug.avgMemberVelocity = trackResult.avgVelocity;
        Object.assign(this.debug, {
          occlusionRecoveries: this.occlusionRecoveryTotal,
          avgIdentityConfidence: Object.values(trackResult.identityConfidence).reduce((a, b) => a + b, 0)
            / Math.max(1, Object.keys(trackResult.identityConfidence).length),
        });
      } else {
        members = runMotionPipelineStep(
          'STEP 1 generateAIMembers (singleDancer)',
          () => (isProfileEnabled()
            ? profileStep('generateAI', () => this.generateAIMembers(frame, options))
            : this.generateAIMembers(frame, options)) as SkeletonMemberData[],
          { ...stepCtx, path: 'motion_timeline' },
        );
        this.debug.singleDancerMode = true;
        this.debug.pipelineStage = 'motion_timeline';
      }
    } catch (error) {
      logMotionPipelineStepFailure('STEP 1-2 member generation/tracking', error, stepCtx);
      throw error;
    }

    try {
      const formation = formationTimeline ?? this.formationTimeline;
      formationKf = runMotionPipelineStep(
        'STEP 3 resolveFormation',
        () => (isProfileEnabled()
          ? profileStep('formation', () => (formation ? resolveFormationAtTime(formation, frame.timestamp) : null))
          : (formation ? resolveFormationAtTime(formation, frame.timestamp) : null)) as import('../../types/danceDatabase').FormationKeyframe | null,
        stepCtx,
      );
    } catch (error) {
      logMotionPipelineStepFailure('STEP 3 resolveFormation', error, stepCtx);
      throw error;
    }

    try {
      out = runMotionPipelineStep(
        'STEP 4 buildFinalSkeleton',
        () => (isProfileEnabled()
          ? profileStep('finalSkeleton', () => ({
              ...frame,
              members,
              formationType: formationKf?.formationType ?? frame.formationType,
              formation: formationKf ?? frame.formation,
            }))
          : {
              ...frame,
              members,
              formationType: formationKf?.formationType ?? frame.formationType,
              formation: formationKf ?? frame.formation,
            }) as SkeletonFrameData,
        { ...stepCtx, outputMemberCount: members.length },
      );
    } catch (error) {
      logMotionPipelineStepFailure('STEP 4 buildFinalSkeleton', error, stepCtx);
      throw error;
    }

    try {
      this.previousFrame = out;
    } catch (error) {
      logMotionPipelineStepFailure('STEP 5 assignPreviousFrame', error, stepCtx);
      throw error;
    }

    try {
      runMotionPipelineStep(
        'STEP 6 updateLiveTimelines',
        () => {
          if (isProfileEnabled()) {
            profileStep('timeline', () => {
              this.updateLiveTimelines(out, allMemberIds.filter((id) => id !== userMemberId));
            });
          } else {
            this.updateLiveTimelines(out, allMemberIds.filter((id) => id !== userMemberId));
          }
        },
        { ...stepCtx, aiMemberIds: allMemberIds.filter((id) => id !== userMemberId) },
      );
    } catch (error) {
      logMotionPipelineStepFailure('STEP 6 updateLiveTimelines', error, stepCtx);
      throw error;
    }

    try {
      runMotionPipelineStep(
        'STEP 7 updateDebugFromFrame',
        () => this.updateDebugFromFrame(out, options),
        stepCtx,
      );
    } catch (error) {
      logMotionPipelineStepFailure('STEP 7 updateDebugFromFrame', error, stepCtx);
      throw error;
    }

    profileRecordBytes('final', out);

    if (isProfileEnabled()) {
      profileEndFrame(performance.now() - t0);
    }

    return out;
  }

  private updateLiveTimelines(frame: SkeletonFrameData, aiMemberIds: string[]) {
    const tracks = buildMemberMotionTracks([frame], aiMemberIds);
    tracks.forEach((track, memberId) => {
      const existing = this.motionTimelines.get(memberId);
      if (!existing) {
        this.motionTimelines.set(memberId, {
          memberId,
          sampleCount: track.samples.length,
          realSampleCount: track.samples.filter((s) => !s.member.isEstimated).length,
          coverageSec: 0,
          samples: track.samples.map((s) => ({
            timestamp: s.timestamp,
            joints: s.member.joints,
            worldCoordinates: s.member.worldCoordinates,
            orientation: s.member.orientation,
            boneRotations: s.member.boneRotations,
            confidence: s.member.confidence,
            isEstimated: s.member.isEstimated,
          })),
        });
      } else {
        track.samples.forEach((s) => existing.samples.push({
          timestamp: s.timestamp,
          joints: s.member.joints,
          worldCoordinates: s.member.worldCoordinates,
          orientation: s.member.orientation,
          boneRotations: s.member.boneRotations,
          confidence: s.member.confidence,
          isEstimated: s.member.isEstimated,
        }));
        existing.sampleCount = existing.samples.length;
        existing.realSampleCount = existing.samples.filter((s) => !s.isEstimated).length;
      }
    });
  }

  private updateDebugFromFrame(frame: SkeletonFrameData, options: GroupMotionReconstructionOptions) {
    const members = frame.members || [];
    const visible = members.filter((m) => !m.isEstimated);
    const estimated = members.filter((m) => m.isEstimated);

    this.debug = {
      ...this.debug,
      frameIndex: frame.frameIndex ?? this.debug.frameIndex + 1,
      timestamp: frame.timestamp,
      trackedCount: members.length,
      visibleCount: visible.length,
      estimatedCount: estimated.length,
      activeTrackIds: [...this.tracker.getTrackPool().activeCount ? members.map((m) => Number(m.trackId ?? 0)) : []],
      avgPoseConfidence: members.reduce((s, m) => s + computeMemberPoseConfidence(m), 0) / Math.max(1, members.length),
      formationType: frame.formationType ?? null,
      formationTransition: frame.formation?.transition ?? null,
      orientationLabels: members.map((m) => m.orientation?.label ?? 'unknown'),
      motionTimelineCoverage: Object.fromEntries(
        [...this.motionTimelines.entries()].map(([id, t]) => [
          id,
          t.realSampleCount / Math.max(1, t.sampleCount),
        ]),
      ),
      interpolationActive: estimated.length > 0,
    };
  }

  /**
   * 전체 프레임 시퀀스 재구성 — GroupMotionPipeline v5.0 통합.
   */
  async reconstructSequence(
    rawFrames: SkeletonFrameData[],
    options: GroupMotionReconstructionOptions & {
      videoDurationSec: number;
      fps: number;
    },
  ): Promise<GroupMotionReconstructionResult> {
    this.reset();
    const {
      groupId,
      songId = 'unknown',
      userMemberId,
      allMemberIds,
      bpm = 120,
      motionDatabase,
      formationTimeline,
      trackToMember,
      cacheKey,
      skipCache = false,
      videoDurationSec,
      fps,
    } = options;

    if (cacheKey && !skipCache) {
      const cached = await getCachedChoreo(cacheKey);
      if (cached?.frames?.length && isChoreoCacheValid(cached)) {
        this.debug = { ...EMPTY_GROUP_MOTION_DEBUG, cacheHit: true, pipelineStage: 'cache_hit' };
        const meta: GroupMotionEngineMetadata = {
          engineVersion: GROUP_MOTION_ENGINE_VERSION,
          pipelineVersion: cached.pipelineVersion || CHOREO_CACHE_PIPELINE_VERSION,
          reconstructedAt: cached.savedAt || new Date().toISOString(),
          groupId,
          songId,
          userMemberId,
          frameCount: cached.frames.length,
          aiMemberIds: allMemberIds.filter((id) => id !== userMemberId),
          memberTracks: [],
          formationTimeline: formationTimeline ?? null,
          motionTimelines: [],
          identityConfidence: {},
          singleDancerMode: false,
          occlusionRecoveryCount: 0,
          cacheKey,
          fromCache: true,
        };
        return { frames: cached.frames, metadata: meta, debug: this.debug, motionDatabase };
      }
    }

    const pipeline = await runGroupMotionPipeline({
      rawFrames,
      groupId,
      songId,
      userMemberId,
      allMemberIds,
      videoDurationSec,
      fps,
      bpm,
      trackToMember,
      formationKeyframes: formationTimeline?.keyframes,
    });

    let frames = pipeline.frames;
    this.formationTimeline = pipeline.formationTimeline ?? formationTimeline ?? null;

    if (this.formationTimeline) {
      frames = frames.map((frame) => {
        const kf = resolveFormationAtTime(this.formationTimeline!, frame.timestamp);
        return {
          ...frame,
          formation: kf ?? frame.formation,
          formationType: kf?.formationType ?? frame.formationType,
        };
      });
    }

    const aiIds = allMemberIds.filter((id) => id !== userMemberId);
    this.motionTimelines = buildMemberMotionTimelines(frames, aiIds);

    const memberIdResult = identifyMembersFromTracks(
      frames,
      trackToMember ?? new Map(),
      allMemberIds,
      userMemberId,
    );

    const meta: GroupMotionEngineMetadata = {
      engineVersion: GROUP_MOTION_ENGINE_VERSION,
      pipelineVersion: MOTION_PIPELINE_VERSION,
      reconstructedAt: new Date().toISOString(),
      groupId,
      songId,
      userMemberId,
      frameCount: frames.length,
      aiMemberIds: aiIds,
      memberTracks: memberIdResult.memberTracks,
      formationTimeline: this.formationTimeline,
      motionTimelines: [...this.motionTimelines.values()],
      identityConfidence: memberIdResult.coverageByMember,
      singleDancerMode: Math.max(...frames.map((f) =>
        (f.members || []).filter((m) => !m.isEstimated).length,
      )) <= 1,
      occlusionRecoveryCount: this.occlusionRecoveryTotal,
      cacheKey,
      fromCache: false,
      pipelineAudit: pipeline.audit,
    };

    this.metadata = meta;
    this.debug.pipelineStage = 'complete';

    if (cacheKey) {
      await saveCachedChoreo({
        cacheKey,
        songId,
        groupId,
        frames,
        frameCount: frames.length,
        durationSec: videoDurationSec,
        pipelineVersion: MOTION_PIPELINE_VERSION,
        sampleFps: fps,
        savedAt: new Date().toISOString(),
      });
    }

    return {
      frames,
      metadata: meta,
      debug: this.getDebugState(),
      motionDatabase,
    };
  }

  /** 프레임 시퀀스 스트리밍 재구성 (파이프라인 없이 엔진만) */
  reconstructFrameSequence(
    frames: SkeletonFrameData[],
    options: GroupMotionReconstructionOptions,
  ): SkeletonFrameData[] {
    this.reset();
    if (options.formationTimeline) this.formationTimeline = options.formationTimeline;
    return frames.map((frame, i) => {
      const count = (frame.members || []).filter((m) => !m.isEstimated).length;
      return this.reconstructFrame(
        { ...frame, frameIndex: frame.frameIndex ?? i },
        options,
        count,
      );
    });
  }
}

export default GroupMotionReconstructionEngine;
