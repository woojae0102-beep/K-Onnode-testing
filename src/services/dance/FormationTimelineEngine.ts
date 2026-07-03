// @ts-nocheck
/**
 * Formation Timeline Engine — 곡 전체 스켈레톤 분석 → 구간별 대형 타임라인.
 * defaultX/defaultY는 초기 시드에만 사용, 이후 실측 위치 기반.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import type {
  FormationKeyframe,
  FormationSegment,
  FormationSlot,
  FormationTimeline,
  FormationTransition,
  FormationType,
} from '../../types/danceDatabase';
import { normalizeTrackMemberMap, resolveMemberForTrack } from '../../utils/skeletonDataUtils';

const HIP_KEYS = ['left_hip', 'right_hip'] as const;

export interface FormationAnalysisInput {
  groupId: string;
  songId: string;
  userMemberId: string;
  frames: SkeletonFrameData[];
  trackToMember?: Map<number, string> | Record<string | number, string>;
  /** 구간 분할 최소 간격(초) */
  minSegmentSec?: number;
}

function memberHipCenter(member: SkeletonMemberData): { x: number; y: number; z: number } | null {
  const joints = member.joints || {};
  const hips = HIP_KEYS.map((k) => joints[k]).filter(Boolean);
  if (hips.length) {
    const sum = hips.reduce(
      (acc, j) => ({ x: acc.x + j.x, y: acc.y + j.y, z: acc.z + (j.z ?? 0) }),
      { x: 0, y: 0, z: 0 },
    );
    return { x: sum.x / hips.length, y: sum.y / hips.length, z: sum.z / hips.length };
  }
  const nose = joints.nose;
  return nose ? { x: nose.x, y: nose.y, z: nose.z ?? 0 } : null;
}

function shoulderRotation(member: SkeletonMemberData): number {
  const ls = member.joints?.left_shoulder;
  const rs = member.joints?.right_shoulder;
  if (!ls || !rs) return 0;
  return Math.atan2(rs.y - ls.y, rs.x - ls.x);
}

function variance(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

/** 멤버 상대 위치 기하로 대형 분류 */
export function classifyFormationType(
  positions: Array<{ x: number; y: number }>,
): FormationType {
  const n = positions.length;
  if (n < 2) return 'scatter';

  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  const cx = xs.reduce((a, b) => a + b, 0) / n;
  const cy = ys.reduce((a, b) => a + b, 0) / n;

  const distances = positions.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const distVar = variance(distances);
  const avgDist = distances.reduce((a, b) => a + b, 0) / n;

  // Line — 가로/세로 일렬
  if (xSpread > 0.22 && ySpread < 0.1) return 'line';
  if (ySpread > 0.22 && xSpread < 0.1) return 'line';

  // Circle — 중심으로부터 거리 유사
  if (n >= 4 && avgDist > 0.08 && distVar < 0.004) return 'circle';

  // Triangle
  if (n === 3 && avgDist > 0.06) return 'triangle';

  // Diamond — 4인, 전후·좌우 분리
  if (n === 4) {
    const front = ys.filter((y) => y < cy - 0.04).length;
    const back = ys.filter((y) => y > cy + 0.04).length;
    const sides = xs.filter((x) => Math.abs(x - cx) > 0.08).length;
    if (front >= 1 && back >= 1 && sides >= 2) return 'diamond';
  }

  // V-shape — 상단 1 + 하단 2+
  if (n >= 4) {
    const top = ys.filter((y) => y < cy - 0.08).length;
    const bottom = ys.filter((y) => y > cy + 0.04).length;
    if (top >= 1 && bottom >= 2) return 'v_shape';
  }

  return 'unknown';
}

function buildSlotsFromFrame(
  frame: SkeletonFrameData,
  map: Map<number, string>,
  userMemberId: string,
  groupId: string,
): FormationSlot[] {
  const group = GROUP_DATA[groupId];
  const slots: FormationSlot[] = [];
  const assigned = new Set<string>();

  (frame.members || []).forEach((member) => {
    const memberId = member.estimatedMemberId
      || resolveMemberForTrack(map, Number(member.trackId), userMemberId);
    if (!memberId || memberId === userMemberId) return;
    const center = memberHipCenter(member);
    if (!center) return;
    assigned.add(memberId);
    slots.push({
      memberId,
      trackId: Number(member.trackId ?? 0),
      x: center.x,
      y: center.y,
      z: center.z,
      isUserSlot: false,
      isEmpty: false,
    });
  });

  const userMember = group?.members.find((m) => m.id === userMemberId);
  if (userMember) {
    slots.push({
      memberId: userMemberId,
      trackId: null,
      x: userMember.defaultX,
      y: userMember.defaultY,
      z: 0,
      isUserSlot: true,
      isEmpty: true,
    });
  }

  return slots;
}

function computeGroupRotation(members: SkeletonMemberData[]): number {
  const rots = members.map(shoulderRotation).filter((r) => Number.isFinite(r));
  if (!rots.length) return 0;
  return rots.reduce((a, b) => a + b, 0) / rots.length;
}

function computeSpacing(positions: Array<{ x: number; y: number }>): number {
  if (positions.length < 2) return 0.5;
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return Math.min(1, Math.max(0.15, spread * 1.4));
}

function sampleFrames(frames: SkeletonFrameData[], intervalSec: number): SkeletonFrameData[] {
  if (!frames.length) return [];
  const out: SkeletonFrameData[] = [];
  let nextT = frames[0].timestamp;
  frames.forEach((frame) => {
    if (frame.timestamp >= nextT - 1e-4) {
      out.push(frame);
      nextT = frame.timestamp + intervalSec;
    }
  });
  if (out[out.length - 1] !== frames[frames.length - 1]) {
    out.push(frames[frames.length - 1]);
  }
  return out;
}

/**
 * 곡 전체 분석 → Formation Segment + Frame별 Keyframe.
 */
export function analyzeFormationTimeline({
  groupId,
  songId,
  userMemberId,
  frames,
  trackToMember = new Map(),
  minSegmentSec = 4,
}: FormationAnalysisInput): FormationTimeline {
  const group = GROUP_DATA[groupId];
  const map = normalizeTrackMemberMap(trackToMember);
  const defaultFormation = (group?.defaultFormation || 'diamond') as FormationType;

  if (!frames?.length) {
    return {
      groupId,
      songId,
      userMemberId,
      defaultFormation,
      segments: [],
      keyframes: [],
    };
  }

  const sampled = sampleFrames(frames, Math.max(0.5, minSegmentSec / 3));
  const snapshots: Array<{
    timestamp: number;
    formationType: FormationType;
    rotation: number;
    spacing: number;
    slots: FormationSlot[];
    positions: Array<{ x: number; y: number }>;
  }> = [];

  sampled.forEach((frame) => {
    const aiMembers = (frame.members || []).filter(
      (m) => m.estimatedMemberId && m.estimatedMemberId !== userMemberId,
    );
    const positions = aiMembers
      .map(memberHipCenter)
      .filter(Boolean) as Array<{ x: number; y: number; z: number }>;

    if (!positions.length) return;

    const slots = buildSlotsFromFrame(frame, map, userMemberId, groupId);
    snapshots.push({
      timestamp: frame.timestamp,
      formationType: classifyFormationType(positions),
      rotation: computeGroupRotation(aiMembers),
      spacing: computeSpacing(positions),
      slots,
      positions,
    });
  });

  if (!snapshots.length) {
    return {
      groupId,
      songId,
      userMemberId,
      defaultFormation,
      segments: [],
      keyframes: [],
    };
  }

  const segments: FormationSegment[] = [];
  let segStart = snapshots[0];
  let prev = snapshots[0];

  for (let i = 1; i < snapshots.length; i += 1) {
    const cur = snapshots[i];
    const typeChanged = cur.formationType !== prev.formationType;
    const spacingChanged = Math.abs(cur.spacing - prev.spacing) > 0.12;
    const timeGap = cur.timestamp - segStart.timestamp;

    if ((typeChanged || spacingChanged) && timeGap >= minSegmentSec * 0.5) {
      segments.push({
        startTime: segStart.timestamp,
        endTime: prev.timestamp,
        formationType: segStart.formationType,
        rotation: segStart.rotation,
        spacing: segStart.spacing,
        transition: typeChanged ? 'morph' : 'step',
        slots: segStart.slots,
      });
      segStart = cur;
    }
    prev = cur;
  }

  segments.push({
    startTime: segStart.timestamp,
    endTime: snapshots[snapshots.length - 1].timestamp,
    formationType: segStart.formationType,
    rotation: segStart.rotation,
    spacing: segStart.spacing,
    transition: 'cut',
    slots: segStart.slots,
  });

  const keyframes: FormationKeyframe[] = snapshots.map((snap, i) => {
    const prevSnap = snapshots[i - 1];
    let transition: FormationTransition = 'cut';
    if (prevSnap) {
      transition = snap.formationType !== prevSnap.formationType ? 'morph' : 'step';
    }
    return {
      timestamp: snap.timestamp,
      formationType: snap.formationType,
      rotation: snap.rotation,
      spacing: snap.spacing,
      transition,
      slots: snap.slots,
    };
  });

  if (import.meta.env?.DEV) {
    console.debug(
      '[FormationTimelineEngine]',
      segments.map((s) => `${s.startTime.toFixed(1)}s ${s.formationType}`).join(' → '),
    );
  }

  return {
    groupId,
    songId,
    userMemberId,
    defaultFormation,
    segments,
    keyframes,
  };
}

/** timestamp에 해당하는 대형 keyframe 조회 */
export function resolveFormationAtTime(
  timeline: FormationTimeline,
  timestamp: number,
): FormationKeyframe | null {
  const kfs = timeline.keyframes || [];
  if (!kfs.length) return null;
  let active = kfs[0];
  for (let i = 0; i < kfs.length; i += 1) {
    if (kfs[i].timestamp <= timestamp) active = kfs[i];
    else break;
  }
  return active;
}

export default analyzeFormationTimeline;
