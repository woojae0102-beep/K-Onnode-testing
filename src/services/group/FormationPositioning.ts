// @ts-nocheck
import type { ChoreographyFrame, ChoreographyJoint } from '../../types/groupChoreography';

export interface StageAnchor {
  x: number;
  y: number;
  z: number;
}

export interface FormationPositioningInput {
  frame: ChoreographyFrame | null;
  userMemberId: string;
  /** MediaPipe 실시간 앵커 또는 default 슬롯 */
  userAnchor: StageAnchor;
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
  aiMemberIds,
  scale = 1,
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
  const userRoot = userFrame ? computeRoot(userFrame.joints) : userAnchor;

  return aiMemberIds.map((memberId) => {
    const memberFrame = byId.get(memberId);
    if (!memberFrame) {
      return { memberId, joints: {}, worldOffset: userAnchor };
    }

    const memberRoot = computeRoot(memberFrame.joints);
    const delta = {
      x: (memberRoot.x - userRoot.x) * scale,
      y: (memberRoot.y - userRoot.y) * scale,
      z: (memberRoot.z - userRoot.z) * scale,
    };

    const worldOffset = {
      x: userAnchor.x + delta.x,
      y: userAnchor.y + delta.y,
      z: userAnchor.z + delta.z,
    };

    const joints = translateJoints(memberFrame.joints, {
      x: userAnchor.x - userRoot.x + delta.x,
      y: userAnchor.y - userRoot.y + delta.y,
      z: userAnchor.z - userRoot.z + delta.z,
    });

    return { memberId, joints, worldOffset };
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
