// @ts-nocheck
/**
 * Member Tracking Engine — Adaptive Hungarian · Kalman · Occlusion Recovery · TrackPool.
 * 프레임 간 persistent state — 매 프레임 predictor 재생성 금지.
 */
import { hungarianAssign, jointsPoseDistance } from '../skeleton/poseSimilarity';
import type { SkeletonMemberData } from '../../types/groupPractice';
import { TrackMotionPredictor } from './TrackMotionPredictor';
import { TrackPool } from './TrackPool';
import {
  computeAdaptiveMatchThreshold,
  computeJointMotionVelocity,
} from './adaptiveMatchThreshold';
import {
  applyJointConfidenceFilter,
  computeMemberPoseConfidence,
} from '../../utils/jointConfidenceFilter';
import { applyOrientationToMember } from './OrientationEngine';
import { applyBoneRotationsToMember } from './JointRotationEngine';
import { interpolateJointsHybrid } from '../../utils/quaternionInterpolation';
import {
  isProfileEnabled,
  profileStep,
} from '../../benchmark/reconstructFrameProfiler';
import {
  jointsRefDiag,
  memberJointDiag,
  runMotionPipelineStep,
  summarizeMembers,
} from '../../utils/motionPipelineStepDiagnostics';

export interface MemberTrackingOptions {
  bpm?: number;
  sampleFps?: number;
  timestamp?: number;
  prevTimestamp?: number;
  maxTracks?: number;
  maxOcclusionFrames?: number;
  debugFrameIndex?: number;
  debugTimestamp?: number;
  debugMemberCount?: number;
}

export interface MemberTrackingResult {
  members: SkeletonMemberData[];
  occlusionRecoveries: number;
  avgVelocity: number;
  identityConfidence: Record<string, number>;
}

export class MemberTrackingEngine {
  private trackPool: TrackPool;

  private predictors = new Map<number, TrackMotionPredictor>();

  private occlusionByTrack = new Map<number, number>();

  private identityConfidence = new Map<string, number>();

  private memberVelocity = new Map<string, number>();

  private lastTimestamp = 0;

  constructor(maxTracks = 9) {
    this.trackPool = new TrackPool(maxTracks);
  }

  reset() {
    this.trackPool.reset();
    this.predictors.forEach((p) => p.reset());
    this.predictors.clear();
    this.occlusionByTrack.clear();
    this.identityConfidence.clear();
    this.memberVelocity.clear();
    this.lastTimestamp = 0;
  }

  getTrackPool() {
    return this.trackPool;
  }

  getIdentityConfidence(): Record<string, number> {
    const out: Record<string, number> = {};
    this.identityConfidence.forEach((v, k) => { out[k] = v; });
    return out;
  }

  private trackCtx(options: MemberTrackingOptions, extra: Record<string, unknown> = {}) {
    return {
      frameIndex: options.debugFrameIndex,
      timestamp: options.debugTimestamp,
      memberCount: options.debugMemberCount,
      ...extra,
    };
  }

  private getPredictor(trackId: number) {
    let p = this.predictors.get(trackId);
    if (!p) {
      p = new TrackMotionPredictor();
      this.predictors.set(trackId, p);
    }
    return p;
  }

  private releaseTrack(trackId: number) {
    this.predictors.get(trackId)?.reset();
    this.predictors.delete(trackId);
    this.occlusionByTrack.delete(trackId);
    this.trackPool.release(trackId);
  }

  private stepJointsPoseDistance(
    step: string,
    refJoints: Record<string, unknown> | null | undefined,
    targetJoints: Record<string, unknown> | null | undefined,
    refMember: SkeletonMemberData | null | undefined,
    targetMember: SkeletonMemberData | null | undefined,
    ctx: Record<string, unknown>,
  ) {
    return runMotionPipelineStep(step, () => jointsPoseDistance(refJoints, targetJoints), {
      ...ctx,
      ref: jointsRefDiag('ref', refJoints, refMember ?? undefined),
      target: jointsRefDiag('target', targetJoints, targetMember ?? undefined),
    });
  }

  private stepApplyOrientation(step: string, member: SkeletonMemberData, ctx: Record<string, unknown>) {
    return runMotionPipelineStep(step, () => applyOrientationToMember(member), {
      ...ctx,
      ...memberJointDiag(member),
    });
  }

  private stepApplyBoneRotations(step: string, member: SkeletonMemberData, ctx: Record<string, unknown>) {
    return runMotionPipelineStep(step, () => applyBoneRotationsToMember(member), {
      ...ctx,
      ...memberJointDiag(member),
    });
  }

  private stepApplyOrientationAndBones(step: string, member: SkeletonMemberData, ctx: Record<string, unknown>) {
    const oriented = this.stepApplyOrientation(`${step} → applyOrientationToMember`, member, ctx);
    return this.stepApplyBoneRotations(`${step} → applyBoneRotationsToMember`, oriented, ctx);
  }

  /** Visibility · Presence 필터 적용 */
  private filterMemberVisibility(member: SkeletonMemberData): SkeletonMemberData {
    const filtered = applyJointConfidenceFilter(
      member.joints || {},
      (member.worldCoordinates || {}) as Record<string, import('../../types/groupPractice').JointPoint>,
    );
    return {
      ...member,
      joints: filtered.joints,
      worldCoordinates: Object.keys(filtered.worldJoints).length
        ? filtered.worldJoints as SkeletonMemberData['worldCoordinates']
        : member.worldCoordinates,
      confidence: computeMemberPoseConfidence({ joints: filtered.joints, confidence: member.confidence }),
    };
  }

  /** 첫 프레임 시드 */
  seedMembers(
    members: SkeletonMemberData[],
    options: Pick<MemberTrackingOptions, 'debugFrameIndex' | 'debugTimestamp'> = {},
  ): SkeletonMemberData[] {
    const ctx = this.trackCtx(options, { phase: 'seedMembers', inputCount: members.length });
    return members.map((m, idx) => runMotionPipelineStep(`STEP 2 seedMembers[${idx}]`, () => {
      const filtered = this.filterMemberVisibility(m);
      const trackId = this.trackPool.acquire(Number(filtered.trackId)) ?? this.trackPool.acquire() ?? 0;
      if (filtered.joints) {
        runMotionPipelineStep(
          `STEP E TrackMotionPredictor.update seed[${idx}]`,
          () => this.getPredictor(trackId).update(filtered.joints, this.lastTimestamp),
          { ...ctx, trackId, ...memberJointDiag(filtered) },
        );
      }
      this.occlusionByTrack.set(trackId, 0);
      if (filtered.estimatedMemberId) {
        this.identityConfidence.set(filtered.estimatedMemberId, filtered.confidence ?? 0.8);
      }
      return this.stepApplyOrientationAndBones(`STEP F/G seedMembers[${idx}]`, {
        ...filtered,
        trackId,
        personIndex: trackId,
      }, { ...ctx, trackId, idx });
    }, { ...ctx, idx, ...memberJointDiag(m) }));
  }

  /**
   * Kalman Prediction → Adaptive Hungarian → Occlusion Recovery → Quaternion/Orientation.
   */
  trackMembers(
    currentMembers: SkeletonMemberData[],
    previousMembers: SkeletonMemberData[],
    options: MemberTrackingOptions = {},
  ): MemberTrackingResult {
    const baseCtx = this.trackCtx(options, {
      phase: 'trackMembers',
      nPrev: previousMembers.length,
      nCurr: currentMembers.length,
      previousMembers: summarizeMembers(previousMembers),
      currentMembers: summarizeMembers(currentMembers),
    });

    if (!previousMembers.length) {
      const seeded = this.seedMembers(currentMembers, options);
      return {
        members: seeded,
        occlusionRecoveries: 0,
        avgVelocity: 0,
        identityConfidence: this.getIdentityConfidence(),
      };
    }

    const now = options.timestamp ?? 0;
    const dtSec = options.timestamp != null && options.prevTimestamp != null
      ? Math.max(1e-3, now - options.prevTimestamp)
      : 1 / (options.sampleFps || 30);
    this.lastTimestamp = now;

    const maxOcclusion = options.maxOcclusionFrames ?? Math.ceil((options.sampleFps || 30) * 2);
    this.trackPool.setMaxSlots(options.maxTracks ?? 9);

    const filteredCurrent = currentMembers.map((m) => this.filterMemberVisibility(m));

    let frameMotionVelocity = 0;
    this.predictors.forEach((p) => {
      frameMotionVelocity = Math.max(frameMotionVelocity, p.averageVelocity());
    });

    const avgConfidence =
      filteredCurrent.reduce((s, m) => s + computeMemberPoseConfidence(m), 0)
      / Math.max(1, filteredCurrent.length);

    const nPrev = previousMembers.length;
    const nCurr = filteredCurrent.length;

    const buildCostMatrix = () => Array.from({ length: nPrev }, (_, i) => {
      const prev = previousMembers[i];
      const tid = Number(prev.trackId ?? i);
      const occlusionFrames = this.occlusionByTrack.get(tid) ?? (prev.isEstimated ? 1 : 0);
      const refJoints = occlusionFrames > 0
        ? runMotionPipelineStep(
          `STEP D TrackMotionPredictor.predict cost[${i}]`,
          () => this.getPredictor(tid).predict(now),
          { ...baseCtx, trackId: tid, prevIdx: i, ...memberJointDiag(prev) },
        )
        : prev.joints;
      const boost = occlusionFrames > 0
        ? computeAdaptiveMatchThreshold({
            motionVelocity: frameMotionVelocity,
            poseConfidence: avgConfidence,
            bpm: options.bpm,
            sampleFps: options.sampleFps,
            occlusionFrames,
          }) - computeAdaptiveMatchThreshold({
            motionVelocity: frameMotionVelocity,
            poseConfidence: avgConfidence,
            bpm: options.bpm,
            sampleFps: options.sampleFps,
          })
        : 0;

      return Array.from({ length: nCurr }, (_, j) => {
        const raw = this.stepJointsPoseDistance(
          `STEP C jointsPoseDistance cost[${i},${j}]`,
          refJoints,
          filteredCurrent[j]?.joints,
          prev,
          filteredCurrent[j],
          { ...baseCtx, prevIdx: i, currIdx: j, trackId: tid },
        );
        return Math.max(0, raw - boost * 0.15);
      });
    });

    const costMatrix = isProfileEnabled()
      ? profileStep('memberMatching', () => buildCostMatrix()) as number[][]
      : runMotionPipelineStep('STEP A buildCostMatrix', buildCostMatrix, baseCtx);

    const assignment = isProfileEnabled()
      ? profileStep('hungarianMatching', () => runMotionPipelineStep(
        'STEP B hungarianAssign',
        () => hungarianAssign(costMatrix),
        baseCtx,
      )) as number[]
      : runMotionPipelineStep('STEP B hungarianAssign', () => hungarianAssign(costMatrix), baseCtx);

    const matchedCurr = new Set<number>();
    const matchedPrev = new Set<number>();
    const result: SkeletonMemberData[] = [];
    let occlusionRecoveries = 0;
    let velocitySum = 0;
    let velocityCount = 0;
    const staleTracks: number[] = [];

    const runPoseMerge = () => {
      assignment.forEach((currIdx, prevIdx) => {
        if (currIdx < 0 || currIdx >= nCurr) return;
        const prev = previousMembers[prevIdx];
        const tid = Number(prev.trackId ?? prevIdx);
        const cost = costMatrix[prevIdx]?.[currIdx] ?? Infinity;
        const occlusionFrames = this.occlusionByTrack.get(tid) ?? (prev.isEstimated ? 1 : 0);
        const threshold = computeAdaptiveMatchThreshold({
          motionVelocity: frameMotionVelocity,
          poseConfidence: avgConfidence,
          bpm: options.bpm,
          sampleFps: options.sampleFps,
          occlusionFrames,
        });
        if (cost > threshold) return;

        matchedCurr.add(currIdx);
        matchedPrev.add(prevIdx);
        const curr = filteredCurrent[currIdx];
        const memberId = prev.estimatedMemberId ?? curr.estimatedMemberId;
        const mergeCtx = {
          ...baseCtx,
          prevIdx,
          currIdx,
          trackId: tid,
          estimatedMemberId: memberId,
        };

        if (prev.joints && curr.joints) {
          const vel = runMotionPipelineStep(
            `STEP C computeJointMotionVelocity merge[${prevIdx},${currIdx}]`,
            () => computeJointMotionVelocity(prev.joints, curr.joints, dtSec),
            {
              ...mergeCtx,
              prev: memberJointDiag(prev),
              curr: memberJointDiag(curr),
            },
          );
          frameMotionVelocity = Math.max(frameMotionVelocity, vel);
          if (memberId) {
            this.memberVelocity.set(memberId, vel);
            velocitySum += vel;
            velocityCount += 1;
          }
        }

        runMotionPipelineStep(
          `STEP E TrackMotionPredictor.update merge[${prevIdx},${currIdx}]`,
          () => this.getPredictor(tid).update(curr.joints, now),
          { ...mergeCtx, ...memberJointDiag(curr) },
        );
        this.occlusionByTrack.set(tid, 0);

        if (memberId) {
          const prevConf = this.identityConfidence.get(memberId) ?? 0.5;
          this.identityConfidence.set(
            memberId,
            prevConf * 0.15 + (curr.confidence ?? 0.8) * 0.85,
          );
        }

        result.push(this.stepApplyOrientationAndBones(
          `STEP F/G poseMerge[${prevIdx},${currIdx}]`,
          {
            ...curr,
            trackId: tid,
            personIndex: tid,
            estimatedMemberId: memberId,
            isEstimated: false,
          },
          mergeCtx,
        ));
      });
    };

    if (isProfileEnabled()) {
      profileStep('poseMerge', runPoseMerge);
    } else {
      runMotionPipelineStep('STEP poseMerge', runPoseMerge, baseCtx);
    }

    const runMissingMemberFill = () => {
      previousMembers.forEach((prev, prevIdx) => {
        if (matchedPrev.has(prevIdx)) return;
        const tid = Number(prev.trackId ?? prevIdx);
        const missed = (this.occlusionByTrack.get(tid) ?? 0) + 1;
        this.occlusionByTrack.set(tid, missed);

        if (missed > maxOcclusion) {
          staleTracks.push(tid);
          return;
        }

        const fillCtx = { ...baseCtx, prevIdx, trackId: tid, ...memberJointDiag(prev) };
        const predicted = runMotionPipelineStep(
          `STEP D TrackMotionPredictor.predict missing[${prevIdx}]`,
          () => this.getPredictor(tid).predict(now),
          fillCtx,
        );
        const holdJoints = Object.keys(predicted).length ? predicted : prev.joints;

        result.push(this.stepApplyOrientationAndBones(
          `STEP F/G missingHold[${prevIdx}]`,
          {
            ...prev,
            joints: holdJoints,
            isEstimated: true,
            confidence: computeMemberPoseConfidence(prev) * 0.7,
          },
          fillCtx,
        ));
      });
      staleTracks.forEach((tid) => this.releaseTrack(tid));

      filteredCurrent.forEach((curr, currIdx) => {
        if (matchedCurr.has(currIdx)) return;

        let reIdPrev: SkeletonMemberData | null = null;
        let reIdCost = Infinity;
        let reIdTid = -1;

        previousMembers.forEach((prev, prevIdx) => {
          if (matchedPrev.has(prevIdx)) return;
          const tid = Number(prev.trackId ?? prevIdx);
          const occlusionFrames = this.occlusionByTrack.get(tid) ?? 1;
          if (occlusionFrames <= 0) return;

          const predicted = runMotionPipelineStep(
            `STEP D TrackMotionPredictor.predict reId[${currIdx},${prevIdx}]`,
            () => this.getPredictor(tid).predict(now),
            { ...baseCtx, currIdx, prevIdx, trackId: tid, ...memberJointDiag(prev) },
          );
          const cost = this.stepJointsPoseDistance(
            `STEP C jointsPoseDistance reId[${currIdx},${prevIdx}]`,
            predicted,
            curr.joints,
            prev,
            curr,
            { ...baseCtx, currIdx, prevIdx, trackId: tid },
          );
          const threshold = computeAdaptiveMatchThreshold({
            motionVelocity: frameMotionVelocity,
            poseConfidence: avgConfidence,
            bpm: options.bpm,
            sampleFps: options.sampleFps,
            occlusionFrames,
          });
          if (cost < reIdCost && cost <= threshold) {
            reIdCost = cost;
            reIdPrev = prev;
            reIdTid = tid;
          }
        });

        if (reIdPrev && reIdTid >= 0) {
          occlusionRecoveries += 1;
          const memberId = reIdPrev.estimatedMemberId ?? curr.estimatedMemberId;
          const reIdCtx = {
            ...baseCtx,
            currIdx,
            trackId: reIdTid,
            estimatedMemberId: memberId,
          };
          runMotionPipelineStep(
            `STEP E TrackMotionPredictor.update reId[${currIdx}]`,
            () => this.getPredictor(reIdTid).update(curr.joints, now),
            { ...reIdCtx, ...memberJointDiag(curr) },
          );
          this.occlusionByTrack.set(reIdTid, 0);
          if (memberId) this.identityConfidence.set(memberId, (curr.confidence ?? 0.75) * 0.9);

          result.push(this.stepApplyOrientationAndBones(
            `STEP F/G reIdMerge[${currIdx}]`,
            {
              ...curr,
              trackId: reIdTid,
              personIndex: reIdTid,
              estimatedMemberId: memberId,
            },
            reIdCtx,
          ));
          return;
        }

        const trackId = this.trackPool.acquire(Number(curr.trackId));
        if (trackId == null) return;

        const newCtx = { ...baseCtx, currIdx, trackId, ...memberJointDiag(curr) };
        runMotionPipelineStep(
          `STEP E TrackMotionPredictor.update newTrack[${currIdx}]`,
          () => this.getPredictor(trackId).update(curr.joints, now),
          newCtx,
        );
        this.occlusionByTrack.set(trackId, 0);
        if (curr.estimatedMemberId) {
          this.identityConfidence.set(curr.estimatedMemberId, curr.confidence ?? 0.6);
        }

        result.push(this.stepApplyOrientationAndBones(
          `STEP F/G newTrack[${currIdx}]`,
          {
            ...curr,
            trackId,
            personIndex: trackId,
          },
          newCtx,
        ));
      });
    };

    if (isProfileEnabled()) {
      profileStep('missingMemberFill', runMissingMemberFill);
    } else {
      runMotionPipelineStep('STEP missingMemberFill', runMissingMemberFill, baseCtx);
    }

    return {
      members: result,
      occlusionRecoveries,
      avgVelocity: velocityCount ? velocitySum / velocityCount : 0,
      identityConfidence: this.getIdentityConfidence(),
    };
  }

  /** 멤버 Motion Timeline 기반 Quaternion 보간 hold */
  interpolateMemberHold(
    memberId: string,
    prev: SkeletonMemberData | null,
    next: SkeletonMemberData | null,
    ratio: number,
    timestamp: number,
  ): SkeletonMemberData | null {
    if (!prev?.joints || !next?.joints) return prev || next;
    const ctx = {
      estimatedMemberId: memberId,
      timestamp,
      prev: memberJointDiag(prev),
      next: memberJointDiag(next),
    };
    const joints = runMotionPipelineStep(
      'STEP H interpolateJointsHybrid',
      () => interpolateJointsHybrid(prev.joints, next.joints, ratio),
      ctx,
    );
    return this.stepApplyOrientationAndBones('STEP F/G interpolateMemberHold', {
      ...prev,
      joints,
      timestamp,
      isEstimated: true,
      confidence: ((prev.confidence ?? 1) * (1 - ratio) + (next.confidence ?? 1) * ratio) * 0.8,
      estimatedMemberId: memberId,
    }, ctx);
  }
}

export default MemberTrackingEngine;
