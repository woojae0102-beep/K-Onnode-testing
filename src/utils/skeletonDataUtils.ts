// @ts-nocheck
import type { SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';

/** Map / plain object / JSON 복원 모두 → Map<number, string> */
export function normalizeTrackMemberMap(
  input: Map<number, string> | Record<string | number, string> | null | undefined,
): Map<number, string> {
  const out = new Map<number, string>();
  if (!input) return out;

  if (input instanceof Map) {
    input.forEach((memberId, trackId) => {
      if (memberId) out.set(Number(trackId), String(memberId));
    });
    return out;
  }

  Object.entries(input).forEach(([trackId, memberId]) => {
    if (memberId) out.set(Number(trackId), String(memberId));
  });
  return out;
}

export function normalizePositionMap(
  input: Map<number, { x: number; y: number }> | Record<string, { x: number; y: number }> | null | undefined,
): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  if (!input) return out;

  if (input instanceof Map) {
    input.forEach((pos, trackId) => out.set(Number(trackId), pos));
    return out;
  }

  Object.entries(input).forEach(([trackId, pos]) => {
    if (pos) out.set(Number(trackId), pos);
  });
  return out;
}

function hasUsableJoints(joints: Record<string, unknown> | null | undefined): boolean {
  if (!joints || typeof joints !== 'object') return false;
  return Object.values(joints).some(
    (j: any) => j && Number.isFinite(j.x) && Number.isFinite(j.y),
  );
}

/** IndexedDB/구 캐시 스키마 → 현재 SkeletonFrameData 형식 */
export function normalizeSkeletonMember(raw: any): SkeletonMemberData | null {
  if (!raw) return null;

  const estimatedMemberId =
    raw.estimatedMemberId || raw.memberId || raw.id || null;
  if (!estimatedMemberId) return null;

  const joints = raw.joints || {};
  const normalizedJoints: SkeletonMemberData['joints'] = {};

  Object.entries(joints).forEach(([name, joint]: [string, any]) => {
    if (!joint) return;
    normalizedJoints[name] = {
      x: Number(joint.x) || 0,
      y: Number(joint.y) || 0,
      z: Number(joint.z) || 0,
      visibility: joint.visibility ?? joint.confidence ?? 1,
    };
  });

  return {
    personIndex: Number(raw.personIndex ?? raw.trackId ?? 0),
    estimatedMemberId: String(estimatedMemberId),
    isEstimated: Boolean(raw.isEstimated),
    joints: normalizedJoints,
  };
}

export function normalizeSkeletonFrames(frames: SkeletonFrameData[] | null | undefined): SkeletonFrameData[] {
  if (!frames?.length) return [];

  return frames
    .map((frame) => {
      const members = (frame.members || [])
        .map((m) => normalizeSkeletonMember(m))
        .filter((m): m is SkeletonMemberData => Boolean(m && hasUsableJoints(m.joints)));

      return {
        timestamp: Number(frame.timestamp) || 0,
        timestampMs: frame.timestampMs ?? Math.round((Number(frame.timestamp) || 0) * 1000),
        videoWidth: frame.videoWidth || 1920,
        videoHeight: frame.videoHeight || 1080,
        members,
      };
    })
    .filter((frame) => frame.members.length > 0);
}

export function resolveMemberForTrack(
  trackToMemberMap: Map<number, string>,
  trackId: number | string,
  excludeMemberId?: string,
): string | null {
  const id = Number(trackId);
  const memberId =
    trackToMemberMap.get(id) ||
    trackToMemberMap.get(Number(String(trackId))) ||
    null;
  if (!memberId || (excludeMemberId && memberId === excludeMemberId)) return null;
  return memberId;
}

export interface SkeletonValidationResult {
  valid: boolean;
  frameCount: number;
  aiMemberIds: string[];
  aiMemberCount: number;
  sampleMemberCount: number;
  reason?: string;
}

/** 연습 가능한 스켈레톤인지 검증 (userMemberId 제외 AI 멤버) */
export function validateSkeletonForPractice(
  frames: SkeletonFrameData[] | null | undefined,
  userMemberId: string,
): SkeletonValidationResult {
  const normalized = normalizeSkeletonFrames(frames);
  if (!normalized.length) {
    return {
      valid: false,
      frameCount: 0,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: 0,
      reason: '스켈레톤 프레임이 비어 있습니다.',
    };
  }

  const aiIds = new Set<string>();
  normalized.forEach((frame) => {
    frame.members.forEach((m) => {
      if (m.estimatedMemberId && m.estimatedMemberId !== userMemberId && hasUsableJoints(m.joints)) {
        aiIds.add(m.estimatedMemberId);
      }
    });
  });

  const sample = normalized[Math.floor(normalized.length / 2)] || normalized[0];
  const sampleAi = sample.members.filter(
    (m) => m.estimatedMemberId && m.estimatedMemberId !== userMemberId && hasUsableJoints(m.joints),
  );

  if (aiIds.size === 0) {
    return {
      valid: false,
      frameCount: normalized.length,
      aiMemberIds: [],
      aiMemberCount: 0,
      sampleMemberCount: sampleAi.length,
      reason: 'AI 멤버 관절 데이터가 없습니다. 멤버 매칭 또는 추출을 다시 해 주세요.',
    };
  }

  return {
    valid: true,
    frameCount: normalized.length,
    aiMemberIds: [...aiIds],
    aiMemberCount: aiIds.size,
    sampleMemberCount: sampleAi.length,
  };
}

export function countAiSkeletonsAtTime(
  frames: SkeletonFrameData[],
  timeSec: number,
  userMemberId: string,
): number {
  const normalized = normalizeSkeletonFrames(frames);
  if (!normalized.length) return 0;

  let lo = 0;
  let hi = normalized.length - 1;
  if (timeSec <= normalized[0].timestamp) {
    return countAiInFrame(normalized[0], userMemberId);
  }
  if (timeSec >= normalized[hi].timestamp) {
    return countAiInFrame(normalized[hi], userMemberId);
  }

  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (normalized[mid].timestamp <= timeSec) lo = mid;
    else hi = mid;
  }

  return countAiInFrame(normalized[lo], userMemberId);
}

function countAiInFrame(frame: SkeletonFrameData, userMemberId: string): number {
  return frame.members.filter(
    (m) =>
      m.estimatedMemberId &&
      m.estimatedMemberId !== userMemberId &&
      hasUsableJoints(m.joints),
  ).length;
}

export default normalizeSkeletonFrames;
