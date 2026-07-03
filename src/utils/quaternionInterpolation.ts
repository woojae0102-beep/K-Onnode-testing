// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';

/** 뼈대 방향 보간용 세그먼트 (parent → child) */
export const SKELETON_BONE_SEGMENTS: [string, string][] = [
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['left_shoulder', 'right_shoulder'],
  ['left_hip', 'right_hip'],
];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function normalizeVec3(v: Vec3): Vec3 | null {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-8) return null;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function boneDirection(
  joints: Record<string, JointPoint>,
  parent: string,
  child: string,
): Vec3 | null {
  const a = joints[parent];
  const b = joints[child];
  if (!a || !b) return null;
  return normalizeVec3({
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z ?? 0) - (a.z ?? 0),
  });
}

export function boneLength(
  joints: Record<string, JointPoint>,
  parent: string,
  child: string,
): number | null {
  const a = joints[parent];
  const b = joints[child];
  if (!a || !b) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));
  return len > 1e-8 ? len : null;
}

/** 단위 방향 벡터 Quaternion SLERP (짧은 호) */
export function slerpDirection(a: Vec3, b: Vec3, t: number): Vec3 {
  const va = normalizeVec3(a) || a;
  const vb = normalizeVec3(b) || b;
  let dot = va.x * vb.x + va.y * vb.y + va.z * vb.z;
  dot = Math.max(-1, Math.min(1, dot));

  if (dot > 0.9995) {
    return normalizeVec3({
      x: va.x + (vb.x - va.x) * t,
      y: va.y + (vb.y - va.y) * t,
      z: va.z + (vb.z - va.z) * t,
    }) || va;
  }

  if (dot < -0.9995) {
    const ortho = Math.abs(va.x) < 0.9
      ? { x: 1, y: 0, z: 0 }
      : { x: 0, y: 1, z: 0 };
    const axis = normalizeVec3({
      x: va.y * ortho.z - va.z * ortho.y,
      y: va.z * ortho.x - va.x * ortho.z,
      z: va.x * ortho.y - va.y * ortho.x,
    }) || { x: 0, y: 0, z: 1 };
    const theta = Math.PI * t;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    return {
      x: va.x * cosTheta + axis.x * sinTheta,
      y: va.y * cosTheta + axis.y * sinTheta,
      z: va.z * cosTheta + axis.z * sinTheta,
    };
  }

  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const w0 = Math.sin((1 - t) * omega) / sinOmega;
  const w1 = Math.sin(t * omega) / sinOmega;
  return normalizeVec3({
    x: va.x * w0 + vb.x * w1,
    y: va.y * w0 + vb.y * w1,
    z: va.z * w0 + vb.z * w1,
  }) || va;
}

export interface BoneQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** GLB 리타겟용 본 세그먼트 → [parentJoint, childJoint] */
export const RETARGET_BONE_SEGMENTS: Record<string, [string, string]> = {
  leftArm: ['left_shoulder', 'left_elbow'],
  leftForeArm: ['left_elbow', 'left_wrist'],
  rightArm: ['right_shoulder', 'right_elbow'],
  rightForeArm: ['right_elbow', 'right_wrist'],
  leftUpLeg: ['left_hip', 'left_knee'],
  leftLeg: ['left_knee', 'left_ankle'],
  rightUpLeg: ['right_hip', 'right_knee'],
  rightLeg: ['right_knee', 'right_ankle'],
  spine: ['left_hip', 'left_shoulder'],
  head: ['left_shoulder', 'nose'],
};

export function quaternionFromUnitVectors(from: Vec3, to: Vec3): BoneQuaternion {
  const fa = normalizeVec3(from) || { x: 0, y: 1, z: 0 };
  const tb = normalizeVec3(to) || { x: 0, y: 1, z: 0 };
  let dot = fa.x * tb.x + fa.y * tb.y + fa.z * tb.z;
  dot = Math.max(-1, Math.min(1, dot));

  if (dot > 0.999999) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  if (dot < -0.999999) {
    const axis = Math.abs(fa.x) < 0.9
      ? normalizeVec3({ x: 1, y: 0, z: 0 })
      : normalizeVec3({ x: 0, y: 1, z: 0 });
    return { x: axis?.x ?? 0, y: axis?.y ?? 0, z: axis?.z ?? 1, w: 0 };
  }

  const cross = {
    x: fa.y * tb.z - fa.z * tb.y,
    y: fa.z * tb.x - fa.x * tb.z,
    z: fa.x * tb.y - fa.y * tb.x,
  };
  const s = Math.sqrt((1 + dot) * 2);
  const inv = 1 / s;
  return {
    x: cross.x * inv,
    y: cross.y * inv,
    z: cross.z * inv,
    w: s * 0.5,
  };
}

export function slerpQuaternion(a: BoneQuaternion, b: BoneQuaternion, t: number): BoneQuaternion {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (dot > 0.9995) {
    return normalizeQuaternion({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    });
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinTheta = Math.sin(theta);
  const w0 = Math.sin((1 - t) * theta) / sinTheta;
  const w1 = Math.sin(t * theta) / sinTheta;
  return normalizeQuaternion({
    x: a.x * w0 + bx * w1,
    y: a.y * w0 + by * w1,
    z: a.z * w0 + bz * w1,
    w: a.w * w0 + bw * w1,
  });
}

export function normalizeQuaternion(q: BoneQuaternion): BoneQuaternion {
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  if (len < 1e-8) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/** 관절 좌표 → 본별 Quaternion (GLB 리타겟 입력) */
export function computeBoneRotationsFromJoints(
  joints: Record<string, JointPoint>,
  worldJoints?: Record<string, JointPoint>,
): Record<string, BoneQuaternion> {
  const source = worldJoints && Object.keys(worldJoints).length >= 4 ? worldJoints : joints;
  const refUp = { x: 0, y: -1, z: 0 };
  const out: Record<string, BoneQuaternion> = {};

  Object.entries(RETARGET_BONE_SEGMENTS).forEach(([boneName, [parent, child]]) => {
    const dir = boneDirection(source, parent, child);
    if (!dir) return;
    out[boneName] = quaternionFromUnitVectors(refUp, dir);
  });

  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear(위치) + Quaternion SLERP(뼈 방향) 혼합 관절 보간.
 * Avatar 깜빡임·관절 꺾임 완화.
 */
export function interpolateJointsHybrid(
  prev: Record<string, JointPoint>,
  next: Record<string, JointPoint>,
  ratio: number,
): Record<string, JointPoint> {
  const jointNames = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const joints: Record<string, JointPoint> = {};

  jointNames.forEach((name) => {
    const ja = prev[name];
    const jb = next[name];
    if (ja && jb) {
      joints[name] = {
        x: lerp(ja.x, jb.x, ratio),
        y: lerp(ja.y, jb.y, ratio),
        z: lerp(ja.z ?? 0, jb.z ?? 0, ratio),
        visibility: ja.visibility ?? jb.visibility,
        presence: ja.presence ?? jb.presence,
        confidence: lerp(ja.confidence ?? 1, jb.confidence ?? 1, ratio) * 0.9,
      };
    } else if (jb) {
      joints[name] = { ...jb };
    } else if (ja) {
      joints[name] = { ...ja };
    }
  });

  SKELETON_BONE_SEGMENTS.forEach(([parent, child]) => {
    const dirPrev = boneDirection(prev, parent, child);
    const dirNext = boneDirection(next, parent, child);
    const lenPrev = boneLength(prev, parent, child);
    const lenNext = boneLength(next, parent, child);
    const parentJoint = joints[parent];
    if (!dirPrev || !dirNext || !parentJoint || lenPrev == null || lenNext == null) return;

    const dir = slerpDirection(dirPrev, dirNext, ratio);
    const len = lerp(lenPrev, lenNext, ratio);
    const existing = joints[child];
    joints[child] = {
      ...(existing || {}),
      x: parentJoint.x + dir.x * len,
      y: parentJoint.y + dir.y * len,
      z: (parentJoint.z ?? 0) + dir.z * len,
      visibility: existing?.visibility ?? parentJoint.visibility,
      presence: existing?.presence ?? parentJoint.presence,
      confidence: (existing?.confidence ?? 0.7) * 0.9,
    };
  });

  return joints;
}
