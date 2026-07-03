// @ts-nocheck
/**
 * Orientation Engine — 멤버별 body facing (앞/뒤/45°/90°).
 */
import type { SkeletonMemberData } from '../../types/groupPractice';

export type OrientationLabel =
  | 'front'
  | 'back'
  | 'left_45'
  | 'right_45'
  | 'left_90'
  | 'right_90'
  | 'unknown';

export interface BodyOrientation {
  /** 라디안 — 0=정면(카메라), π=뒤 */
  yaw: number;
  /** 라디안 — 상하 기울기 */
  pitch: number;
  label: OrientationLabel;
  confidence: number;
}

const RAD = Math.PI / 180;

function classifyYaw(yawRad: number): OrientationLabel {
  const deg = ((yawRad * 180) / Math.PI + 360) % 360;
  if (deg < 30 || deg >= 330) return 'front';
  if (deg >= 150 && deg < 210) return 'back';
  if (deg >= 30 && deg < 60) return 'right_45';
  if (deg >= 300 && deg < 330) return 'left_45';
  if (deg >= 60 && deg < 120) return 'right_90';
  if (deg >= 240 && deg < 300) return 'left_90';
  return 'unknown';
}

/**
 * Shoulder·Hip·Nose·world Z 기반 body orientation.
 * MediaPipe 정규화 좌표 + worldLandmarks 깊이 활용.
 */
export function computeMemberOrientation(member: SkeletonMemberData): BodyOrientation {
  const joints = member.joints || {};
  const world = member.worldCoordinates || {};
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  const lh = joints.left_hip;
  const rh = joints.right_hip;
  const nose = joints.nose;

  if (!ls || !rs) {
    return { yaw: 0, pitch: 0, label: 'unknown', confidence: 0 };
  }

  const shoulderMid = {
    x: (ls.x + rs.x) / 2,
    y: (ls.y + rs.y) / 2,
    z: ((ls.z ?? 0) + (rs.z ?? 0)) / 2,
  };

  const wls = world.left_shoulder;
  const wrs = world.right_shoulder;
  const wnose = world.nose;

  let yaw = 0;
  let confidence = 0.5;

  if (wls && wrs && Number.isFinite(wls.z) && Number.isFinite(wrs.z)) {
    const shoulderWidth = wrs.x - wls.x;
    const depthAsym = (wls.z ?? 0) - (wrs.z ?? 0);
    yaw = Math.atan2(depthAsym, Math.abs(shoulderWidth) + 1e-4);
    confidence = 0.85;
  } else if (nose) {
    const noseOffsetX = nose.x - shoulderMid.x;
    const shoulderWidth = Math.abs(rs.x - ls.x);
    yaw = Math.atan2(noseOffsetX, Math.max(0.05, shoulderWidth));
    confidence = 0.6;
  } else {
    yaw = Math.atan2(rs.y - ls.y, rs.x - ls.x) - Math.PI / 2;
    confidence = 0.45;
  }

  if (wnose && wls && wrs) {
    const facingCamera = (wls.z ?? 0) + (wrs.z ?? 0) > (wnose.z ?? 0) * 2;
    if (facingCamera && Math.abs(yaw) > 120 * RAD) {
      yaw = Math.PI;
    }
  }

  let pitch = 0;
  if (lh && rh) {
    const hipMid = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
    pitch = Math.atan2(shoulderMid.y - hipMid.y, Math.hypot(shoulderMid.x - hipMid.x, 0.05));
  }

  return {
    yaw,
    pitch,
    label: classifyYaw(yaw),
    confidence,
  };
}

export function applyOrientationToMember(member: SkeletonMemberData): SkeletonMemberData {
  const orientation = computeMemberOrientation(member);
  return { ...member, orientation };
}

export function applyOrientationToFrames<T extends { members?: SkeletonMemberData[] }>(
  frames: T[],
): T[] {
  return frames.map((frame) => ({
    ...frame,
    members: (frame.members || []).map(applyOrientationToMember),
  }));
}

export default computeMemberOrientation;
