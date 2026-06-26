// @ts-nocheck
import type { ChoreographyFrame, ChoreographyJoint } from '../../types/groupChoreography';

export interface StageAnchor {
  x: number;
  y: number;
  z: number;
}

/** AI-only 추출 데이터 기준 기본 대형 스케일 (1.0 = 원본, 1.25 = 약간 넓게) */
export const FORMATION_SPREAD_SCALE = 1.25;

export interface FormationPositioningInput {
  frame: ChoreographyFrame | null;
  userMemberId: string;
  /** MediaPipe 실시간 앵커 (현재 사용자 위치) */
  userAnchor: StageAnchor;
  /** 원본 안무에서 사용자 슬롯 (defaultX/Y — AI-only 프레임일 때 필수) */
  referenceUserSlot?: StageAnchor;
  aiMemberIds: string[];
  /** 대형 스케일 (카메라 거리/무대 크기) */
  scale?: number;
}

export interface PositionedMemberJoints {
  memberId: string;
  joints: Record<string, ChoreographyJoint>;
  worldOffset: StageAnchor;
}

const ROOT_JOINTS = ['left_hip', 'right_hip'];

/**
 * 선택된 사용자 위치를 중심으로 AI 아바타를 안무 대형에 맞게 재배치합니다.
 *
 * 원리:
 * 1) 안무 프레임에서 userMember의 root(골반 중심) 계산
 * 2) 각 AI 멤버 root와 user root의 delta 유지
 * 3) userAnchor + delta 로 관절 전체 이동
 */
export function applyFormationPositioning({
  frame,
  userMemberId,
  userAnchor,
  referenceUserSlot,
  aiMemberIds,
  scale = FORMATION_SPREAD_SCALE,
}: FormationPositioningInput): PositionedMemberJoints[] {
  if (!frame?.members?.length) {
    return aiMemberIds.map((memberId) => ({
      memberId,
      joints: {},
      worldOffset: { x: userAnchor.x, y: userAnchor.y, z: userAnchor.z },
    }));
  }

  const byId = new Map(frame.members.map((m) => [m.memberId, m]));
  const userFrame = byId.get(userMemberId);
  /** 원본 영상에서 사용자 기준점 — AI-only 추출 시 referenceUserSlot 사용 */
  const refRoot = userFrame
    ? computeRoot(userFrame.joints)
    : referenceUserSlot || userAnchor;

  return aiMemberIds.map((memberId) => {
    const memberFrame = byId.get(memberId);
    if (!memberFrame) {
      return { memberId, joints: {}, worldOffset: userAnchor };
    }

    const memberRoot = computeRoot(memberFrame.joints);
    const spread = {
      x: (memberRoot.x - refRoot.x) * scale,
      y: (memberRoot.y - refRoot.y) * scale,
      z: (memberRoot.z - refRoot.z) * scale,
    };

    const targetRoot = {
      x: userAnchor.x + spread.x,
      y: userAnchor.y + spread.y,
      z: userAnchor.z + spread.z,
    };

    const offset = {
      x: targetRoot.x - memberRoot.x,
      y: targetRoot.y - memberRoot.y,
      z: targetRoot.z - memberRoot.z,
    };

    return {
      memberId,
      joints: translateJoints(memberFrame.joints, offset),
      worldOffset: targetRoot,
    };
  });
}

/** MediaPipe joints → stage anchor (0~1 정규화 + z) */
export function computeLiveUserAnchor(
  joints: Record<string, ChoreographyJoint> | null,
  fallback: StageAnchor,
): StageAnchor {
  if (!joints) return fallback;
  const root = computeRoot(joints);
  return { x: root.x, y: root.y, z: root.z ?? 0 };
}

export function computeRoot(joints: Record<string, ChoreographyJoint>): StageAnchor {
  const hips = ROOT_JOINTS.map((k) => joints[k]).filter(Boolean);
  if (!hips.length) {
    const nose = joints.nose;
    return nose ? { x: nose.x, y: nose.y, z: nose.z ?? 0 } : { x: 0.5, y: 0.5, z: 0 };
  }
  const sum = hips.reduce(
    (acc, j) => ({ x: acc.x + j.x, y: acc.y + j.y, z: acc.z + (j.z ?? 0) }),
    { x: 0, y: 0, z: 0 },
  );
  return { x: sum.x / hips.length, y: sum.y / hips.length, z: sum.z / hips.length };
}

function translateJoints(
  joints: Record<string, ChoreographyJoint>,
  offset: StageAnchor,
): Record<string, ChoreographyJoint> {
  return Object.fromEntries(
    Object.entries(joints).map(([name, j]) => [
      name,
      { ...j, x: j.x + offset.x, y: j.y + offset.y, z: (j.z ?? 0) + offset.z },
    ]),
  );
}

/** 3D 무대 좌표 변환: 정규화(0~1) → Three.js world (-width/2 ~ width/2) */
export function normalizedToStage(
  joint: ChoreographyJoint,
  stageWidth = 4,
  stageHeight = 3,
  stageDepth = 2,
): [number, number, number] {
  const x = (joint.x - 0.5) * stageWidth;
  const y = (0.5 - joint.y) * stageHeight;
  const z = (joint.z ?? 0) * stageDepth;
  return [x, y, z];
}

export default applyFormationPositioning;
