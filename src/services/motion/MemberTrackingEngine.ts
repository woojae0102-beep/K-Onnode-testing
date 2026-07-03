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

export interface MemberTrackingOptions {
  bpm?: number;
  sampleFps?: number;
  timestamp?: number;
  prevTimestamp?: number;
  maxTracks?: number;
  maxOcclusionFrames?: number;
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
  seedMembers(members: SkeletonMemberData[]): SkeletonMemberData[] {
    return members.map((m) => {
      const filtered = this.filterMemberVisibility(m);
      const trackId = this.trackPool.acquire(Number(filtered.trackId)) ?? this.trackPool.acquire() ?? 0;
      if (filtered.joints) this.getPredictor(trackId).update(filtered.joints, this.lastTimestamp);
      this.occlusionByTrack.set(trackId, 0);
      if (filtered.estimatedMemberId) {
        this.identityConfidence.set(filtered.estimatedMemberId, filtered.confidence ?? 0.8);
      }
      return applyBoneRotationsToMember(applyOrientationToMember({
        ...filtered,
        trackId,
        personIndex: trackId,
      }));
    });
  }

  /**
   * Kalman Prediction → Adaptive Hungarian → Occlusion Recovery → Quaternion/Orientation.
   */
  trackMembers(
    currentMembers: SkeletonMemberData[],
    previousMembers: SkeletonMemberData[],
    options: MemberTrackingOptions = {},
  ): MemberTrackingResult {
    if (!previousMembers.length) {
      const seeded = this.seedMembers(currentMembers);
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

    const costMatrix = Array.from({ length: nPrev }, (_, i) => {
      const prev = previousMembers[i];
      const tid = Number(prev.trackId ?? i);
      const occlusionFrames = this.occlusionByTrack.get(tid) ?? (prev.isEstimated ? 1 : 0);
      const refJoints = occlusionFrames > 0
        ? this.getPredictor(tid).predict(now)
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
        const raw = jointsPoseDistance(refJoints, filteredCurrent[j]?.joints);
        return Math.max(0, raw - boost * 0.15);
      });
    });

    const assignment = hungarianAssign(costMatrix);
    const matchedCurr = new Set<number>();
    const matchedPrev = new Set<number>();
    const result: SkeletonMemberData[] = [];
    let occlusionRecoveries = 0;
    let velocitySum = 0;
    let velocityCount = 0;

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

      if (prev.joints && curr.joints) {
        const vel = computeJointMotionVelocity(prev.joints, curr.joints, dtSec);
        frameMotionVelocity = Math.max(frameMotionVelocity, vel);
        if (memberId) {
          this.memberVelocity.set(memberId, vel);
          velocitySum += vel;
          velocityCount += 1;
        }
      }

      this.getPredictor(tid).update(curr.joints, now);
      this.occlusionByTrack.set(tid, 0);

      if (memberId) {
        const prevConf = this.identityConfidence.get(memberId) ?? 0.5;
        this.identityConfidence.set(
          memberId,
          prevConf * 0.15 + (curr.confidence ?? 0.8) * 0.85,
        );
      }

      result.push(applyBoneRotationsToMember(applyOrientationToMember({
        ...curr,
        trackId: tid,
        personIndex: tid,
        estimatedMemberId: memberId,
        isEstimated: false,
      })));
    });

    const staleTracks: number[] = [];
    previousMembers.forEach((prev, prevIdx) => {
      if (matchedPrev.has(prevIdx)) return;
      const tid = Number(prev.trackId ?? prevIdx);
      const missed = (this.occlusionByTrack.get(tid) ?? 0) + 1;
      this.occlusionByTrack.set(tid, missed);

      if (missed > maxOcclusion) {
        staleTracks.push(tid);
        return;
      }

      const predicted = this.getPredictor(tid).predict(now);
      const holdJoints = Object.keys(predicted).length ? predicted : prev.joints;

      result.push(applyBoneRotationsToMember(applyOrientationToMember({
        ...prev,
        joints: holdJoints,
        isEstimated: true,
        confidence: computeMemberPoseConfidence(prev) * 0.7,
      })));
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

        const predicted = this.getPredictor(tid).predict(now);
        const cost = jointsPoseDistance(predicted, curr.joints);
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
        this.getPredictor(reIdTid).update(curr.joints, now);
        this.occlusionByTrack.set(reIdTid, 0);
        if (memberId) this.identityConfidence.set(memberId, (curr.confidence ?? 0.75) * 0.9);

        result.push(applyBoneRotationsToMember(applyOrientationToMember({
          ...curr,
          trackId: reIdTid,
          personIndex: reIdTid,
          estimatedMemberId: memberId,
        })));
        return;
      }

      const trackId = this.trackPool.acquire(Number(curr.trackId));
      if (trackId == null) return;

      this.getPredictor(trackId).update(curr.joints, now);
      this.occlusionByTrack.set(trackId, 0);
      if (curr.estimatedMemberId) {
        this.identityConfidence.set(curr.estimatedMemberId, curr.confidence ?? 0.6);
      }

      result.push(applyBoneRotationsToMember(applyOrientationToMember({
        ...curr,
        trackId,
        personIndex: trackId,
      })));
    });

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
    const joints = interpolateJointsHybrid(prev.joints, next.joints, ratio);
    return applyBoneRotationsToMember(applyOrientationToMember({
      ...prev,
      joints,
      timestamp,
      isEstimated: true,
      confidence: ((prev.confidence ?? 1) * (1 - ratio) + (next.confidence ?? 1) * ratio) * 0.8,
      estimatedMemberId: memberId,
    }));
  }
}

export default MemberTrackingEngine;
