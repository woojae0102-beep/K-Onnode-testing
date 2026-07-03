// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';

const HIP_KEYS = ['left_hip', 'right_hip'] as const;
const SHOULDER_KEYS = ['left_shoulder', 'right_shoulder'] as const;
const HEIGHT_TOP = 'nose';
const HEIGHT_BOTTOM = ['left_ankle', 'right_ankle'] as const;
const DEPTH_KEYS = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'nose'] as const;

const MIN_SCALE = 1e-4;

function midpoint(a: JointPoint, b: JointPoint): JointPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: a.visibility ?? b.visibility,
    presence: a.presence ?? b.presence,
    confidence: a.confidence ?? b.confidence,
  };
}

function dist2d(a: JointPoint, b: JointPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dist3d(a: JointPoint, b: JointPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function transformJoints(
  joints: Record<string, JointPoint>,
  fn: (j: JointPoint, name: string) => JointPoint,
): Record<string, JointPoint> {
  const out: Record<string, JointPoint> = {};
  Object.entries(joints).forEach(([name, j]) => {
    if (j) out[name] = fn(j, name);
  });
  return out;
}

function resolveHipCenter(joints: Record<string, JointPoint>): JointPoint | null {
  const left = joints.left_hip;
  const right = joints.right_hip;
  if (left && right) return midpoint(left, right);
  if (left) return left;
  if (right) return right;
  const nose = joints.nose;
  return nose ? { ...nose, z: nose.z ?? 0 } : null;
}

function resolveShoulderWidth(joints: Record<string, JointPoint>): number {
  const left = joints.left_shoulder;
  const right = joints.right_shoulder;
  if (left && right) return dist2d(left, right);
  return 0;
}

function resolveBodyHeight(joints: Record<string, JointPoint>, hipCenter: JointPoint): number {
  const top = joints[HEIGHT_TOP];
  const ankles = HEIGHT_BOTTOM.map((k) => joints[k]).filter(Boolean) as JointPoint[];
  if (top && ankles.length) {
    const ankleY = ankles.reduce((sum, a) => sum + a.y, 0) / ankles.length;
    return Math.abs(top.y - ankleY);
  }
  if (top) return Math.abs(top.y - hipCenter.y) * 2.2;
  return 0;
}

function resolveCameraDepthSpan(joints: Record<string, JointPoint>): number {
  const zs = DEPTH_KEYS.map((k) => joints[k]?.z).filter((z) => Number.isFinite(z)) as number[];
  if (zs.length < 2) return 0;
  return Math.max(...zs) - Math.min(...zs);
}

/**
 * Hip 기준 · Shoulder Width · Height · Camera Distance 정규화.
 * 기기/촬영 거리에 무관한 스켈레톤 스케일.
 */
export function normalizePoseJoints(
  joints: Record<string, JointPoint>,
  worldJoints: Record<string, JointPoint> = {},
): { joints: Record<string, JointPoint>; worldJoints: Record<string, JointPoint> } {
  if (!joints || !Object.keys(joints).length) {
    return { joints: {}, worldJoints: {} };
  }

  const hipCenter = resolveHipCenter(joints);
  if (!hipCenter) return { joints: { ...joints }, worldJoints: { ...worldJoints } };

  // 1) Hip 기준 원점
  let norm2d = transformJoints(joints, (j) => ({
    ...j,
    x: j.x - hipCenter.x,
    y: j.y - hipCenter.y,
    z: (j.z ?? 0) - (hipCenter.z ?? 0),
  }));

  const worldHip = resolveHipCenter(worldJoints) ?? hipCenter;
  let normWorld = Object.keys(worldJoints).length
    ? transformJoints(worldJoints, (j) => ({
        ...j,
        x: j.x - worldHip.x,
        y: j.y - worldHip.y,
        z: (j.z ?? 0) - (worldHip.z ?? 0),
      }))
    : {};

  // 2) Shoulder Width → 1.0
  const shoulderW = resolveShoulderWidth(norm2d);
  if (shoulderW > MIN_SCALE) {
    norm2d = transformJoints(norm2d, (j) => ({
      ...j,
      x: j.x / shoulderW,
      y: j.y / shoulderW,
      z: (j.z ?? 0) / shoulderW,
    }));
    if (Object.keys(normWorld).length) {
      const worldShoulderW = resolveShoulderWidth(normWorld) || shoulderW;
      if (worldShoulderW > MIN_SCALE) {
        normWorld = transformJoints(normWorld, (j) => ({
          ...j,
          x: j.x / worldShoulderW,
          y: j.y / worldShoulderW,
          z: (j.z ?? 0) / worldShoulderW,
        }));
      }
    }
  }

  // 3) Height → 1.0
  const height = resolveBodyHeight(norm2d, { x: 0, y: 0, z: 0 });
  if (height > MIN_SCALE) {
    norm2d = transformJoints(norm2d, (j) => ({
      ...j,
      x: j.x / height,
      y: j.y / height,
      z: (j.z ?? 0) / height,
    }));
    if (Object.keys(normWorld).length) {
      const worldHipCenter = resolveHipCenter(normWorld) ?? { x: 0, y: 0, z: 0 };
      const worldHeight = resolveBodyHeight(normWorld, worldHipCenter) || height;
      if (worldHeight > MIN_SCALE) {
        normWorld = transformJoints(normWorld, (j) => ({
          ...j,
          x: j.x / worldHeight,
          y: j.y / worldHeight,
          z: (j.z ?? 0) / worldHeight,
        }));
      }
    }
  }

  // 4) Camera Distance (z span) → 1.0
  const depthSpan = resolveCameraDepthSpan(norm2d);
  const depthScale = depthSpan > MIN_SCALE ? depthSpan : Math.abs(hipCenter.z ?? 0) || 1;
  if (depthScale > MIN_SCALE) {
    norm2d = transformJoints(norm2d, (j) => ({
      ...j,
      z: (j.z ?? 0) / depthScale,
    }));
    if (Object.keys(normWorld).length) {
      const worldDepth = resolveCameraDepthSpan(normWorld) || depthScale;
      if (worldDepth > MIN_SCALE) {
        normWorld = transformJoints(normWorld, (j) => ({
          ...j,
          z: (j.z ?? 0) / worldDepth,
        }));
      }
    }
  }

  return { joints: norm2d, worldJoints: normWorld };
}

/** 파이프라인 normalize 단계 — 멤버 단위 포즈 스케일 정규화 */
export function normalizeMemberPoseScale(member: {
  joints?: Record<string, JointPoint>;
  worldCoordinates?: Record<string, JointPoint>;
}) {
  const { joints, worldJoints } = normalizePoseJoints(
    member.joints || {},
    member.worldCoordinates || {},
  );
  return {
    ...member,
    joints,
    worldCoordinates: Object.keys(worldJoints).length ? worldJoints : member.worldCoordinates,
  };
}
