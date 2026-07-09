// @ts-nocheck
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { hungarianAssign, jointsPoseDistance } from './poseSimilarity';
import { TrackMotionPredictor } from '../motion/TrackMotionPredictor';
import { TrackPool } from '../motion/TrackPool';
import {
  computeAdaptiveMatchThreshold,
  computeJointMotionVelocity,
} from '../motion/adaptiveMatchThreshold';
import { computeMemberPoseConfidence } from '../../utils/jointConfidenceFilter';
import { yieldEvery } from '../../utils/mainThreadYield';

function cloneMember(member: SkeletonMemberData, overrides: Partial<SkeletonMemberData> = {}): SkeletonMemberData {
  return {
    ...member,
    ...overrides,
    joints: { ...member.joints },
    worldCoordinates: member.worldCoordinates ? { ...member.worldCoordinates } : undefined,
    boundingBox: member.boundingBox ? { ...member.boundingBox } : undefined,
  };
}

function resolveMemberIdFromTrack(
  trackId: number,
  trackToMember?: Record<number, string> | Map<number, string>,
): string | null {
  if (!trackToMember) return null;
  if (trackToMember instanceof Map) return trackToMember.get(trackId) || null;
  return trackToMember[trackId] ?? trackToMember[String(trackId)] ?? null;
}

function buildMemberTracksForFrame(members: SkeletonMemberData[]) {
  return members.map((m) => ({
    trackId: Number(m.trackId ?? 0),
    memberId: m.estimatedMemberId,
    confidence: computeMemberPoseConfidence(m),
    initialPosition: m.boundingBox
      ? {
          x: (m.boundingBox.minX + m.boundingBox.maxX) / 2,
          y: (m.boundingBox.minY + m.boundingBox.maxY) / 2,
        }
      : undefined,
  }));
}

/**
 * normalize 이후 프레임 간 trackId 안정화.
 * Kalman Prediction → confidence-weighted Pose Similarity → Hungarian.
 * TrackPool로 ID 재사용 — 프레임마다 증가하는 trackId 방지.
 */
export async function stabilizeSkeletonMemberTracks(
  frames: SkeletonFrameData[],
  options: {
    trackToMember?: Record<number, string> | Map<number, string>;
    maxMatchCost?: number;
    bpm?: number;
    sampleFps?: number;
    maxTracks?: number;
    maxOcclusionFrames?: number;
  } = {},
): Promise<SkeletonFrameData[]> {
  if (!frames.length) return frames;

  const bpm = options.bpm ?? 120;
  const sampleFps = options.sampleFps ?? 30;
  const maxOcclusionFrames = options.maxOcclusionFrames ?? Math.ceil(sampleFps * 2);
  const trackPool = new TrackPool(options.maxTracks ?? 9);
  const predictorByTrackId = new Map<number, TrackMotionPredictor>();
  const occlusionByTrackId = new Map<number, number>();

  const getPredictor = (trackId: number) => {
    let p = predictorByTrackId.get(trackId);
    if (!p) {
      p = new TrackMotionPredictor();
      predictorByTrackId.set(trackId, p);
    }
    return p;
  };

  const releaseTrack = (trackId: number) => {
    predictorByTrackId.get(trackId)?.reset();
    predictorByTrackId.delete(trackId);
    occlusionByTrackId.delete(trackId);
    trackPool.release(trackId);
  };

  const stabilized: SkeletonFrameData[] = [];
  let prevMembers: SkeletonMemberData[] = [];
  let prevTimestamp = 0;

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    // 프레임 수천 개 × 멤버별 Hungarian 매칭은 무거운 연산 — 메인 스레드 장시간
    // 블로킹(→ "페이지 응답 없음" 팝업) 방지를 위해 주기적으로 이벤트 루프를 양보한다.
    await yieldEvery(frameIndex, 150);

    const frame = frames[frameIndex];
    const currMembers = frame.members || [];
    const timestamp = frame.timestamp ?? frameIndex / sampleFps;
    const dtSec = prevTimestamp > 0 ? Math.max(1e-3, timestamp - prevTimestamp) : 1 / sampleFps;

    if (!prevMembers.length) {
      const seeded = currMembers.map((m) => {
        const trackId = trackPool.acquire(Number(m.trackId)) ?? trackPool.acquire() ?? 0;
        const estimatedMemberId =
          resolveMemberIdFromTrack(trackId, options.trackToMember)
          ?? m.estimatedMemberId;
        const member = cloneMember(m, {
          trackId,
          personIndex: trackId,
          estimatedMemberId,
          confidence: computeMemberPoseConfidence(m),
        });
        if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
        occlusionByTrackId.set(trackId, 0);
        return member;
      });
      prevMembers = seeded;
      prevTimestamp = timestamp;
      stabilized.push({
        ...frame,
        frameIndex: frame.frameIndex ?? frameIndex,
        members: seeded,
        memberTracks: buildMemberTracksForFrame(seeded),
      });
      continue;
    }

    let motionVelocity = 0;
    prevMembers.forEach((prev) => {
      const tid = Number(prev.trackId ?? 0);
      motionVelocity = Math.max(motionVelocity, getPredictor(tid).averageVelocity());
    });
    currMembers.forEach((curr, i) => {
      const prev = prevMembers[i];
      if (prev?.joints && curr?.joints) {
        motionVelocity = Math.max(motionVelocity, computeJointMotionVelocity(prev.joints, curr.joints, dtSec));
      }
    });

    const avgConfidence =
      currMembers.reduce((s, m) => s + computeMemberPoseConfidence(m), 0) / Math.max(1, currMembers.length);

    const baseThreshold = options.maxMatchCost ?? computeAdaptiveMatchThreshold({
      motionVelocity,
      poseConfidence: avgConfidence,
      bpm,
      sampleFps,
    });

    const nPrev = prevMembers.length;
    const nCurr = currMembers.length;

    const costMatrix = Array.from({ length: nPrev }, (_, i) => {
      const prev = prevMembers[i];
      const trackId = Number(prev.trackId);
      const occlusionFrames = occlusionByTrackId.get(trackId) ?? (prev.isEstimated ? 1 : 0);
      const refJoints = occlusionFrames > 0
        ? getPredictor(trackId).predict(timestamp)
        : prev.joints;
      const boost = occlusionFrames > 0
        ? computeAdaptiveMatchThreshold({
            motionVelocity,
            poseConfidence: avgConfidence,
            bpm,
            sampleFps,
            occlusionFrames,
          }) - baseThreshold
        : 0;

      return Array.from({ length: nCurr }, (_, j) => {
        const raw = jointsPoseDistance(refJoints, currMembers[j]?.joints);
        return Math.max(0, raw - boost * 0.15);
      });
    });

    const assignment = hungarianAssign(costMatrix);
    const matchedCurr = new Set<number>();
    const matchedPrev = new Set<number>();
    const nextMembers: SkeletonMemberData[] = [];

    assignment.forEach((currIdx, prevIdx) => {
      if (currIdx < 0 || currIdx >= nCurr) return;
      const prev = prevMembers[prevIdx];
      const trackId = Number(prev.trackId);
      const cost = costMatrix[prevIdx]?.[currIdx] ?? Infinity;
      const occlusionFrames = occlusionByTrackId.get(trackId) ?? (prev.isEstimated ? 1 : 0);
      const threshold = computeAdaptiveMatchThreshold({
        motionVelocity,
        poseConfidence: avgConfidence,
        bpm,
        sampleFps,
        occlusionFrames,
      });
      if (cost > threshold) return;

      matchedCurr.add(currIdx);
      matchedPrev.add(prevIdx);
      const curr = currMembers[currIdx];
      const estimatedMemberId =
        resolveMemberIdFromTrack(trackId, options.trackToMember)
        ?? prev.estimatedMemberId
        ?? curr.estimatedMemberId;

      const member = cloneMember(curr, {
        trackId,
        personIndex: trackId,
        estimatedMemberId,
        isEstimated: Boolean(curr.isEstimated),
        confidence: computeMemberPoseConfidence(curr),
      });
      if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
      occlusionByTrackId.set(trackId, 0);
      nextMembers.push(member);
    });

    const staleTrackIds: number[] = [];
    prevMembers.forEach((prev, prevIdx) => {
      if (matchedPrev.has(prevIdx)) return;
      const trackId = Number(prev.trackId);
      const missed = (occlusionByTrackId.get(trackId) ?? 0) + 1;
      occlusionByTrackId.set(trackId, missed);

      if (missed > maxOcclusionFrames) {
        staleTrackIds.push(trackId);
        return;
      }

      const predicted = getPredictor(trackId).predict(timestamp);
      const holdJoints = Object.keys(predicted).length ? predicted : prev.joints;

      nextMembers.push(
        cloneMember(prev, {
          trackId,
          personIndex: trackId,
          joints: holdJoints,
          isEstimated: true,
          confidence: computeMemberPoseConfidence(prev) * 0.7,
        }),
      );
    });
    staleTrackIds.forEach((trackId) => releaseTrack(trackId));

    currMembers.forEach((curr, currIdx) => {
      if (matchedCurr.has(currIdx)) return;

      let reIdPrev: SkeletonMemberData | null = null;
      let reIdCost = Infinity;
      prevMembers.forEach((prev, prevIdx) => {
        if (matchedPrev.has(prevIdx)) return;
        const trackId = Number(prev.trackId);
        const occlusionFrames = occlusionByTrackId.get(trackId) ?? 1;
        if (occlusionFrames <= 0) return;

        const predicted = getPredictor(trackId).predict(timestamp);
        const cost = jointsPoseDistance(predicted, curr.joints);
        const threshold = computeAdaptiveMatchThreshold({
          motionVelocity,
          poseConfidence: avgConfidence,
          bpm,
          sampleFps,
          occlusionFrames,
        });
        if (cost < reIdCost && cost <= threshold) {
          reIdCost = cost;
          reIdPrev = prev;
        }
      });

      if (reIdPrev) {
        const trackId = Number(reIdPrev.trackId);
        const estimatedMemberId =
          resolveMemberIdFromTrack(trackId, options.trackToMember)
          ?? reIdPrev.estimatedMemberId
          ?? curr.estimatedMemberId;
        const member = cloneMember(curr, {
          trackId,
          personIndex: trackId,
          estimatedMemberId,
          confidence: computeMemberPoseConfidence(curr),
        });
        if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
        occlusionByTrackId.set(trackId, 0);
        nextMembers.push(member);
        return;
      }

      const trackId = trackPool.acquire(Number(curr.trackId));
      if (trackId == null) return;

      const estimatedMemberId =
        resolveMemberIdFromTrack(trackId, options.trackToMember)
        ?? curr.estimatedMemberId;
      const member = cloneMember(curr, {
        trackId,
        personIndex: trackId,
        estimatedMemberId,
        confidence: computeMemberPoseConfidence(curr),
      });
      if (member.joints) getPredictor(trackId).update(member.joints, timestamp);
      occlusionByTrackId.set(trackId, 0);
      nextMembers.push(member);
    });

    prevMembers = nextMembers;
    prevTimestamp = timestamp;
    stabilized.push({
      ...frame,
      frameIndex: frame.frameIndex ?? frameIndex,
      members: nextMembers,
      memberTracks: buildMemberTracksForFrame(nextMembers),
    });
  }

  if (import.meta.env?.DEV) {
    console.debug('[SkeletonMemberTracker] stabilized', stabilized.length, 'frames (TrackPool+confidence)');
  }

  return stabilized;
}

export default stabilizeSkeletonMemberTracks;
