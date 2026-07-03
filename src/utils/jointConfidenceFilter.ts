// @ts-nocheck
import type { JointPoint, SkeletonFrameData, SkeletonMemberData, SkeletonWorldPoint } from '../types/groupPractice';

/** visibility·presence ≤ 0.6 → temporal interpolation 대상 */
export const JOINT_CONFIDENCE_INTERPOLATE_MAX = 0.6;

/** visibility·presence ≤ 0.3 → 폐기 (저장·보간 모두 안 함) */
export const JOINT_CONFIDENCE_DISCARD_MAX = 0.3;

export type JointConfidenceAction = 'keep' | 'interpolate' | 'discard';

export interface MediaPipeJointInput {
  x?: number;
  y?: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

/** visibility·presence 중 보수적(낮은) 값을 joint confidence로 사용 */
export function resolveJointConfidence(visibility?: number, presence?: number): number {
  const vis = Number.isFinite(visibility) ? Number(visibility) : 1;
  const pres = Number.isFinite(presence) ? Number(presence) : vis;
  return Math.min(vis, pres);
}

/** confidence · visibility · presence 통합 관절 신뢰도 */
export function resolveJointScore(joint?: {
  confidence?: number;
  visibility?: number;
  presence?: number;
} | null): number {
  if (!joint) return 0;
  const fromFields = resolveJointConfidence(joint.visibility, joint.presence);
  const explicit = Number.isFinite(joint.confidence) ? Number(joint.confidence) : fromFields;
  return Math.min(1, Math.max(0, Math.min(explicit, fromFields)));
}

/** 멤버 포즈 평균 신뢰도 — 핵심 관절 confidence·visibility·presence 가중 */
export function computeMemberPoseConfidence(
  member?: { confidence?: number; joints?: Record<string, { confidence?: number; visibility?: number; presence?: number }> } | null,
  jointNames?: readonly string[],
): number {
  if (!member) return 0.5;

  const names = jointNames ?? [
    'nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
    'left_elbow', 'right_elbow', 'left_knee', 'right_knee',
  ];

  let sum = 0;
  let count = 0;
  names.forEach((key) => {
    const score = resolveJointScore(member.joints?.[key]);
    if (score > 0) {
      sum += score;
      count += 1;
    }
  });

  if (count) return sum / count;
  return Number.isFinite(member.confidence) ? Math.min(1, Math.max(0, member.confidence)) : 0.5;
}

export function classifyJointConfidence(score: number): JointConfidenceAction {
  if (score <= JOINT_CONFIDENCE_DISCARD_MAX) return 'discard';
  if (score <= JOINT_CONFIDENCE_INTERPOLATE_MAX) return 'interpolate';
  return 'keep';
}

export function toJointPoint(lm: MediaPipeJointInput): JointPoint {
  const visibility = lm.visibility;
  const presence = lm.presence;
  const confidence = resolveJointConfidence(visibility, presence);
  return {
    x: lm.x ?? 0,
    y: lm.y ?? 0,
    z: lm.z ?? 0,
    visibility,
    presence,
    confidence,
  };
}

export interface FilteredJointMaps {
  joints: Record<string, JointPoint>;
  worldJoints: Record<string, JointPoint>;
  /** 0.3 < score ≤ 0.6 — temporal interpolation 대상 */
  jointsNeedingInterpolation: string[];
  discardedJointCount: number;
}

/**
 * Joint Confidence Filter — 추출 직후 적용.
 * keep(>0.6): 저장 · interpolate(0.3~0.6): 제거 후 나중에 보간 · discard(≤0.3): 폐기
 */
export function applyJointConfidenceFilter(
  joints: Record<string, JointPoint>,
  worldJoints: Record<string, JointPoint> = {},
): FilteredJointMaps {
  const outJoints: Record<string, JointPoint> = {};
  const outWorld: Record<string, JointPoint> = {};
  const jointsNeedingInterpolation: string[] = [];
  let discardedJointCount = 0;

  const names = new Set([...Object.keys(joints), ...Object.keys(worldJoints)]);

  names.forEach((name) => {
    const joint = joints[name];
    const world = worldJoints[name];
    const score = resolveJointConfidence(
      joint?.visibility ?? world?.visibility,
      joint?.presence ?? world?.presence,
    );
    const action = classifyJointConfidence(score);

    if (action === 'discard') {
      discardedJointCount += 1;
      return;
    }
    if (action === 'interpolate') {
      jointsNeedingInterpolation.push(name);
      return;
    }

    if (joint) {
      outJoints[name] = { ...joint, confidence: score };
    }
    if (world) {
      outWorld[name] = { ...world, confidence: score };
    } else if (joint) {
      outWorld[name] = {
        x: joint.x,
        y: joint.y,
        z: joint.z ?? 0,
        visibility: joint.visibility,
        presence: joint.presence,
        confidence: score,
      };
    }
  });

  return {
    joints: outJoints,
    worldJoints: outWorld,
    jointsNeedingInterpolation,
    discardedJointCount,
  };
}

function interpolateJointPoint(a: JointPoint, b: JointPoint, ratio: number): JointPoint {
  const score = resolveJointConfidence(
    (a.visibility ?? 1) * (1 - ratio) + (b.visibility ?? 1) * ratio,
    (a.presence ?? 1) * (1 - ratio) + (b.presence ?? 1) * ratio,
  ) * 0.85;
  return {
    x: a.x + (b.x - a.x) * ratio,
    y: a.y + (b.y - a.y) * ratio,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * ratio,
    visibility: score,
    presence: score,
    confidence: score,
  };
}

function memberKey(member: SkeletonMemberData): string {
  return String(member.estimatedMemberId ?? member.trackId ?? member.personIndex ?? '');
}

function findMemberInFrame(
  frame: SkeletonFrameData | undefined,
  key: string,
): SkeletonMemberData | null {
  if (!frame || !key) return null;
  return (
    frame.members.find((m) => memberKey(m) === key)
    ?? frame.members.find((m) => String(m.trackId) === key)
    ?? null
  );
}

function findNeighborJoint(
  frames: SkeletonFrameData[],
  fromIndex: number,
  memberKeyStr: string,
  jointName: string,
  direction: -1 | 1,
): { index: number; joint: JointPoint; world?: SkeletonWorldPoint } | null {
  let i = fromIndex + direction;
  while (i >= 0 && i < frames.length) {
    const member = findMemberInFrame(frames[i], memberKeyStr);
    const joint = member?.joints?.[jointName];
    if (joint) {
      const score = resolveJointConfidence(joint.visibility, joint.presence);
      if (score > JOINT_CONFIDENCE_INTERPOLATE_MAX && !member?.isEstimated) {
        return {
          index: i,
          joint,
          world: member?.worldCoordinates?.[jointName],
        };
      }
    }
    i += direction;
  }
  return null;
}

/**
 * confidence filter로 제거된 관절(0.3~0.6)을 앞뒤 프레임에서 linear interpolation.
 */
export function interpolateLowConfidenceJoints(frames: SkeletonFrameData[]): SkeletonFrameData[] {
  if (!frames.length) return frames;

  const result = frames.map((frame) => ({
    ...frame,
    members: frame.members.map((m) => ({
      ...m,
      joints: { ...m.joints },
      worldCoordinates: m.worldCoordinates ? { ...m.worldCoordinates } : undefined,
    })),
  }));

  const jointNames = new Set<string>();
  result.forEach((frame) => {
    frame.members.forEach((m) => {
      Object.keys(m.joints || {}).forEach((n) => jointNames.add(n));
    });
  });

  let filledCount = 0;

  result.forEach((frame, frameIndex) => {
    frame.members.forEach((member) => {
      const key = memberKey(member);
      jointNames.forEach((jointName) => {
        if (member.joints[jointName]) return;

        const prev = findNeighborJoint(result, frameIndex, key, jointName, -1);
        const next = findNeighborJoint(result, frameIndex, key, jointName, 1);

        if (prev && next) {
          const t0 = result[prev.index].timestamp;
          const t1 = result[next.index].timestamp;
          const t = frame.timestamp;
          const ratio = t1 > t0 ? (t - t0) / (t1 - t0) : 0.5;
          const joint = interpolateJointPoint(prev.joint, next.joint, Math.min(1, Math.max(0, ratio)));

          let world: SkeletonWorldPoint | undefined;
          if (prev.world && next.world) {
            world = interpolateJointPoint(prev.world as JointPoint, next.world as JointPoint, ratio);
          } else if (next.world) {
            world = { ...next.world };
          } else if (prev.world) {
            world = { ...prev.world };
          }

          member.joints[jointName] = joint;
          if (world) {
            member.worldCoordinates = member.worldCoordinates || {};
            member.worldCoordinates[jointName] = world;
          }
          filledCount += 1;
          return;
        }

        if (prev) {
          member.joints[jointName] = { ...prev.joint, confidence: (prev.joint.confidence ?? 1) * 0.75 };
          if (prev.world) {
            member.worldCoordinates = member.worldCoordinates || {};
            member.worldCoordinates[jointName] = { ...prev.world };
          }
          filledCount += 1;
        } else if (next) {
          member.joints[jointName] = { ...next.joint, confidence: (next.joint.confidence ?? 1) * 0.65 };
          if (next.world) {
            member.worldCoordinates = member.worldCoordinates || {};
            member.worldCoordinates[jointName] = { ...next.world };
          }
          filledCount += 1;
        }
      });
    });
  });

  if (import.meta.env?.DEV && filledCount > 0) {
    console.debug('[JointConfidenceFilter] temporal interpolated joints:', filledCount);
  }

  return result;
}

export function worldJointsToSkeletonWorldPoints(
  worldJoints: Record<string, JointPoint>,
): Record<string, SkeletonWorldPoint> {
  const out: Record<string, SkeletonWorldPoint> = {};
  Object.entries(worldJoints).forEach(([name, pt]) => {
    out[name] = {
      x: pt.x,
      y: pt.y,
      z: pt.z ?? 0,
      visibility: pt.visibility,
      confidence: pt.confidence ?? resolveJointConfidence(pt.visibility, pt.presence),
    };
  });
  return out;
}
