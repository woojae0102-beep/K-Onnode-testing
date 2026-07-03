// @ts-nocheck
import type { FormationKeyframe, MemberTrackMeta } from '../types/danceDatabase';
import type { SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';

/** timestamp(초) → fractional beat (BPM 기준) */
export function timeSecToBeat(timeSec: number, bpm: number): number {
  const rate = Number(bpm);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return (Number(timeSec) * rate) / 60;
}

export function timeSecToBeatIndex(timeSec: number, bpm: number): number {
  return Math.floor(timeSecToBeat(timeSec, bpm));
}

function averageMemberConfidence(members: SkeletonMemberData[]): number {
  if (!members?.length) return 0;
  const scores = members.map((m) => m.confidence ?? 0).filter((v) => v > 0);
  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * 프레임 Pose Quality — 관절 confidence·visibility·멤버 수 기반 0~1.
 */
export function evaluateFramePoseQuality(frame: SkeletonFrameData): number {
  const members = frame.members || [];
  if (!members.length) return 0;

  let jointScore = 0;
  let jointCount = 0;
  members.forEach((m) => {
    if (m.isEstimated) return;
    Object.values(m.joints || {}).forEach((j) => {
      const c = j.confidence ?? j.visibility ?? 0;
      if (c > 0) {
        jointScore += c;
        jointCount += 1;
      }
    });
  });

  const jointAvg = jointCount ? jointScore / jointCount : 0;
  const memberAvg = averageMemberConfidence(members);
  const estimatedPenalty = members.filter((m) => m.isEstimated).length / members.length;

  return Math.max(0, Math.min(1, jointAvg * 0.55 + memberAvg * 0.35 + (1 - estimatedPenalty) * 0.1));
}

export interface EnrichFrameMetadataInput {
  bpm: number;
  fps: number;
  sourceVideoDurationSec?: number;
  memberTracks?: MemberTrackMeta[];
  formationKeyframes?: FormationKeyframe[];
}

/**
 * Frame 메타데이터 부착 — timestamp, frameIndex, bpm, beat, formation,
 * memberTracks, confidence, sourceVideoTime, poseQuality
 */
export function enrichSkeletonFrameMetadata(
  frames: SkeletonFrameData[],
  {
    bpm,
    fps,
    sourceVideoDurationSec,
    memberTracks = [],
    formationKeyframes = [],
  }: EnrichFrameMetadataInput,
): SkeletonFrameData[] {
  if (!frames?.length) return frames;

  const rate = Number(bpm) > 0 ? Number(bpm) : 120;
  const sortedFormation = [...(formationKeyframes || [])].sort((a, b) => a.timestamp - b.timestamp);

  const resolveFormation = (t: number): FormationKeyframe | undefined => {
    if (!sortedFormation.length) return undefined;
    let active = sortedFormation[0];
    for (let i = 0; i < sortedFormation.length; i += 1) {
      if (sortedFormation[i].timestamp <= t) active = sortedFormation[i];
      else break;
    }
    return active;
  };

  return frames.map((frame, frameIndex) => {
    const sourceVideoTime = frame.sourceVideoTime ?? frame.timestamp;
    const beat = timeSecToBeat(sourceVideoTime, rate);
    const beatIndex = timeSecToBeatIndex(sourceVideoTime, rate);
    const poseQuality = frame.poseQuality ?? evaluateFramePoseQuality(frame);
    const confidence = frame.confidence ?? averageMemberConfidence(frame.members || []);

    const frameMemberTracks = frame.memberTracks?.length
      ? frame.memberTracks
      : (frame.members || []).map((m) => ({
          trackId: Number(m.trackId ?? m.personIndex ?? 0),
          memberId: m.estimatedMemberId,
          confidence: m.confidence ?? poseQuality,
        }));

    return {
      ...frame,
      timestamp: frame.timestamp,
      timestampMs: frame.timestampMs ?? Math.round(frame.timestamp * 1000),
      frameIndex: frame.frameIndex ?? frameIndex,
      sourceVideoTime,
      bpm: rate,
      beat,
      beatIndex,
      formation: frame.formation ?? resolveFormation(sourceVideoTime),
      formationType: frame.formationType
        ?? resolveFormation(sourceVideoTime)?.formationType
        ?? undefined,
      memberTracks: frameMemberTracks,
      confidence,
      poseQuality,
      videoWidth: frame.videoWidth,
      videoHeight: frame.videoHeight,
      members: frame.members,
      boundingBox: frame.boundingBox,
      worldCoordinates: frame.worldCoordinates,
    };
  });
}

export function summarizePoseQuality(frames: SkeletonFrameData[]) {
  if (!frames.length) return { avg: 0, min: 0, max: 0, lowQualityFrames: 0 };
  const scores = frames.map((f) => f.poseQuality ?? evaluateFramePoseQuality(f));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const lowQualityFrames = scores.filter((s) => s < 0.45).length;
  return { avg, min, max, lowQualityFrames };
}
