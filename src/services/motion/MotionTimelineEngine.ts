// @ts-nocheck
/**
 * Motion Timeline Engine — 멤버별 독립 Motion 타임라인.
 * 리사/제니/로제/지수 각각의 시계열 Motion (복사 금지).
 */
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import type { BodyOrientation } from './OrientationEngine';
import type { BoneQuaternion } from '../../utils/quaternionInterpolation';

export interface MotionTimelineSample {
  timestamp: number;
  frameIndex?: number;
  joints: SkeletonMemberData['joints'];
  worldCoordinates?: SkeletonMemberData['worldCoordinates'];
  orientation?: BodyOrientation;
  boneRotations?: Record<string, BoneQuaternion>;
  confidence?: number;
  isEstimated?: boolean;
}

export interface MemberMotionTimeline {
  memberId: string;
  trackId?: number;
  sampleCount: number;
  realSampleCount: number;
  coverageSec: number;
  samples: MotionTimelineSample[];
}

export function buildMemberMotionTimelines(
  frames: SkeletonFrameData[],
  memberIds: string[],
): Map<string, MemberMotionTimeline> {
  const tracks = new Map<string, MemberMotionTimeline>();

  memberIds.forEach((memberId) => {
    tracks.set(memberId, {
      memberId,
      sampleCount: 0,
      realSampleCount: 0,
      coverageSec: 0,
      samples: [],
    });
  });

  frames.forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const memberId = member.estimatedMemberId;
      if (!memberId || !tracks.has(memberId)) return;
      if (!member.joints || !Object.keys(member.joints).length) return;

      const track = tracks.get(memberId)!;
      track.samples.push({
        timestamp: frame.timestamp,
        frameIndex: frame.frameIndex,
        joints: member.joints,
        worldCoordinates: member.worldCoordinates,
        orientation: member.orientation,
        boneRotations: member.boneRotations,
        confidence: member.confidence,
        isEstimated: member.isEstimated,
      });
      track.sampleCount += 1;
      if (!member.isEstimated) track.realSampleCount += 1;
      track.trackId = member.trackId ?? track.trackId;
    });
  });

  tracks.forEach((track) => {
    const real = track.samples.filter((s) => !s.isEstimated);
    if (real.length >= 2) {
      track.coverageSec = real[real.length - 1].timestamp - real[0].timestamp;
    }
  });

  if (import.meta.env?.DEV) {
    const summary = [...tracks.values()]
      .map((t) => `${t.memberId}:${t.realSampleCount}/${t.sampleCount}`)
      .join(', ');
    console.debug('[MotionTimeline]', summary);
  }

  return tracks;
}

export function resolveSampleAtTime(
  timeline: MemberMotionTimeline,
  timestamp: number,
): MotionTimelineSample | null {
  if (!timeline.samples.length) return null;

  let nearest = timeline.samples[0];
  timeline.samples.forEach((s) => {
    if (Math.abs(s.timestamp - timestamp) < Math.abs(nearest.timestamp - timestamp)) {
      nearest = s;
    }
  });
  return nearest;
}

export default buildMemberMotionTimelines;
