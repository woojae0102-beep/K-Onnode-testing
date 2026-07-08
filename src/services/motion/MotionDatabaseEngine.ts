// @ts-nocheck
/**
 * Motion Database Engine — 멤버별 실제 Motion 트랙 저장·조회.
 * 선택 멤버 복사 금지: 리사 Motion / 제니 Motion / 로제 Motion 각각 독립 트랙.
 */
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { resolvePracticeFrameAtTime } from '../../utils/skeletonTimelineUtils';
import { synthesizeFormationMembersForFrames } from '../motion/MemberMotionRetargeting';
import type { FormationRetargetContext } from '../motion/MemberMotionRetargeting';

export interface MemberMotionSample {
  timestamp: number;
  member: SkeletonMemberData;
}

export interface MemberMotionTrack {
  memberId: string;
  samples: MemberMotionSample[];
}

/** 프레임 시퀀스 → 멤버별 Motion 트랙 인덱스 */
export function buildMemberMotionTracks(
  frames: SkeletonFrameData[],
  memberIds: string[],
): Map<string, MemberMotionTrack> {
  const tracks = new Map<string, MemberMotionTrack>();
  memberIds.forEach((id) => tracks.set(id, { memberId: id, samples: [] }));

  frames.forEach((frame) => {
    (frame.members || []).forEach((member) => {
      const memberId = member.estimatedMemberId;
      if (!memberId || !tracks.has(memberId)) return;
      if (!member.joints || !Object.keys(member.joints).length) return;

      tracks.get(memberId)!.samples.push({
        timestamp: frame.timestamp,
        member: { ...member, joints: { ...member.joints } },
      });
    });
  });

  return tracks;
}

/** 멤버 트랙에서 해당 시점 Motion 조회 — 다른 멤버 데이터 사용 안 함 */
export function resolveMemberMotionAtTime(
  track: MemberMotionTrack | undefined,
  timestamp: number,
): SkeletonMemberData | null {
  if (!track?.samples?.length) return null;

  const live = track.samples.find(
    (s) => Math.abs(s.timestamp - timestamp) < 1e-3 && !s.member.isEstimated,
  );
  if (live) return live.member;

  const nearest = track.samples.reduce((best, s) =>
    Math.abs(s.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? s : best,
  );

  const prev = [...track.samples].reverse().find((s) => s.timestamp <= timestamp);
  const next = track.samples.find((s) => s.timestamp >= timestamp);

  if (prev && next && prev.timestamp !== next.timestamp) {
    const ratio = (timestamp - prev.timestamp) / (next.timestamp - prev.timestamp);
    return interpolateMemberMotion(prev.member, next.member, ratio, timestamp);
  }

  return nearest?.member ?? null;
}

function interpolateMemberMotion(
  a: SkeletonMemberData,
  b: SkeletonMemberData,
  ratio: number,
  timestamp: number,
): SkeletonMemberData {
  const t = Math.min(1, Math.max(0, ratio));
  const joints: SkeletonMemberData['joints'] = {};
  const names = new Set([...Object.keys(a.joints || {}), ...Object.keys(b.joints || {})]);

  names.forEach((name) => {
    const ja = a.joints?.[name];
    const jb = b.joints?.[name];
    if (!ja || !jb) return;
    joints[name] = {
      ...ja,
      x: ja.x + (jb.x - ja.x) * t,
      y: ja.y + (jb.y - ja.y) * t,
      z: (ja.z ?? 0) + ((jb.z ?? 0) - (ja.z ?? 0)) * t,
      confidence: ((ja.confidence ?? 1) * (1 - t) + (jb.confidence ?? 1) * t) * 0.8,
    };
  });

  return {
    ...a,
    joints,
    timestamp,
    isEstimated: true,
    confidence: ((a.confidence ?? 1) * (1 - t) + (b.confidence ?? 1) * t) * 0.75,
  };
}

/** 멤버별 실측 Motion 커버리지 (0~1) */
export function measureMemberMotionCoverage(
  tracks: Map<string, MemberMotionTrack>,
  memberIds: string[],
  durationSec: number,
): Map<string, number> {
  const coverage = new Map<string, number>();
  memberIds.forEach((id) => {
    const track = tracks.get(id);
    if (!track?.samples.length || durationSec <= 0) {
      coverage.set(id, 0);
      return;
    }
    const realSamples = track.samples.filter((s) => !s.member.isEstimated);
    const span = realSamples.length
      ? realSamples[realSamples.length - 1].timestamp - realSamples[0].timestamp
      : 0;
    coverage.set(id, Math.min(1, span / durationSec));
  });
  return coverage;
}

export interface ApplyMotionDatabaseOptions {
  allMemberIds: string[];
  userMemberId: string;
  /** true면 1인 영상 — Formation Retarget 폴백 허용 */
  singleDancerMode?: boolean;
  formationContext?: FormationRetargetContext & { allMemberIds: string[] };
}

/**
 * 프레임별 멤버 Motion — DB 트랙 우선, 복사는 singleDancerMode에서만.
 */
export function resolveFrameMembersFromMotionDatabase(
  frame: SkeletonFrameData,
  tracks: Map<string, MemberMotionTrack>,
  options: ApplyMotionDatabaseOptions,
): SkeletonMemberData[] {
  const { allMemberIds, userMemberId } = options;
  const aiIds = allMemberIds.filter((id) => id && id !== userMemberId);
  const liveById = new Map(
    (frame.members || [])
      .filter((m) => m.estimatedMemberId)
      .map((m) => [m.estimatedMemberId, m]),
  );

  return aiIds.map((memberId, idx) => {
    const live = liveById.get(memberId);
    if (live?.joints && Object.keys(live.joints).length && !live.isEstimated) {
      return {
        ...live,
        trackId: live.trackId ?? idx,
        personIndex: live.personIndex ?? idx,
        estimatedMemberId: memberId,
      };
    }

    const fromTrack = resolveMemberMotionAtTime(tracks.get(memberId), frame.timestamp);
    if (fromTrack?.joints && Object.keys(fromTrack.joints).length) {
      return {
        ...fromTrack,
        trackId: fromTrack.trackId ?? idx,
        personIndex: fromTrack.personIndex ?? idx,
        estimatedMemberId: memberId,
        isEstimated: fromTrack.isEstimated ?? !live,
      };
    }

    return live || null;
  }).filter(Boolean) as SkeletonMemberData[];
}

/**
 * 전체 프레임에 멤버별 Motion Database 적용.
 * 다인 실측 데이터가 있으면 복사 경로 차단.
 */
export function applyMemberMotionDatabase(
  frames: SkeletonFrameData[],
  options: ApplyMotionDatabaseOptions,
): SkeletonFrameData[] {
  if (!frames?.length) return frames;

  const aiIds = options.allMemberIds.filter((id) => id && id !== options.userMemberId);
  const tracks = buildMemberMotionTracks(frames, aiIds);
  const duration = frames[frames.length - 1]?.timestamp || 0;
  const coverage = measureMemberMotionCoverage(tracks, aiIds, duration);

  const multiMemberRealMotion = aiIds.filter((id) => (coverage.get(id) ?? 0) > 0.05).length >= 2;

  if (!multiMemberRealMotion && options.singleDancerMode && options.formationContext) {
    if (import.meta.env?.DEV) {
      console.debug('[MotionDatabase] 1인 영상 — Formation Retarget 폴백');
    }
    return synthesizeFormationMembersForFrames(frames, options.formationContext);
  }

  if (import.meta.env?.DEV) {
    const summary = aiIds.map((id) => `${id}:${((coverage.get(id) ?? 0) * 100).toFixed(0)}%`).join(', ');
    console.debug('[MotionDatabase] 멤버별 실측 Motion', summary);
  }

  return frames.map((frame) => {
    const members = resolveFrameMembersFromMotionDatabase(frame, tracks, options);
    return {
      ...frame,
      members,
      memberTracks: members.map((m) => ({
        trackId: Number(m.trackId ?? 0),
        memberId: m.estimatedMemberId,
        confidence: m.confidence ?? 0.7,
      })),
    };
  });
}

/** DanceDatabase skeletonFrames에서 특정 시점 멤버 Motion 조회 */
export function resolveMembersFromStoredMotionDatabase(
  frame: SkeletonFrameData,
  skeletonFrames: SkeletonFrameData[],
  groupMemberIds: string[],
  userMemberId: string,
): SkeletonMemberData[] {
  const dbFrame = resolvePracticeFrameAtTime(skeletonFrames, frame.timestamp);
  if (!dbFrame?.members?.length) return frame.members || [];

  const byId = new Map(
    dbFrame.members.map((m) => [m.estimatedMemberId, m]),
  );

  return groupMemberIds
    .filter((id) => id !== userMemberId)
    .map((memberId, idx) => {
      const fromDb = byId.get(memberId);
      if (fromDb?.joints && Object.keys(fromDb.joints).length) {
        return {
          ...fromDb,
          trackId: fromDb.trackId ?? idx,
          personIndex: fromDb.personIndex ?? idx,
          estimatedMemberId: memberId,
        };
      }
      const live = (frame.members || []).find((m) => m.estimatedMemberId === memberId);
      return live || null;
    })
    .filter(Boolean) as SkeletonMemberData[];
}

export default applyMemberMotionDatabase;
