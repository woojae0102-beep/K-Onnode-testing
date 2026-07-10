// @ts-nocheck
/**
 * Skeleton Formation Render Pipeline
 *
 * HipCenter → Member Default Formation → Timeline Position → Formation Offset
 * → Joint Offset → (overlap separation) → Canvas Draw
 *
 * MediaPipe 좌표만으로는 그룹 대형을 재현할 수 없음 — 타임라인·기본 대형 기반 배치.
 */
import { GROUP_DATA } from '../../data/groupPracticeData';
import type { FormationKeyframe, FormationTimeline } from '../../types/danceDatabase';
import type { JointPoint, SkeletonMemberData } from '../../types/groupPractice';
import { computeRoot, FORMATION_SPREAD_SCALE } from '../group/FormationPositioning';

export interface StageAnchor {
  x: number;
  y: number;
  z: number;
}

export interface FormationRenderMemberInput {
  memberId: string;
  joints: Record<string, JointPoint>;
  isEstimated?: boolean;
}

export interface SkeletonFormationRenderInput {
  members: FormationRenderMemberInput[];
  groupId: string;
  userMemberId: string;
  userAnchor: StageAnchor;
  timestamp?: number;
  formationTimeline?: FormationTimeline | null;
  frameFormation?: FormationKeyframe | null;
  referenceUserSlot?: StageAnchor;
  frameMembers?: SkeletonMemberData[];
  scale?: number;
}

export interface FormationRenderMemberOutput {
  memberId: string;
  joints: Record<string, JointPoint>;
  stageAnchor: StageAnchor;
  isEstimated?: boolean;
}

/** 5명 그룹 기준 화면 비율 0.12 미만이면 육안으로 겹쳐 보인다 — 최소 분리 거리 */
const MIN_MEMBER_DISTANCE = 0.12;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** Step 1 — HipCenter */
export function computeMemberHipCenter(
  joints: Record<string, JointPoint> | null | undefined,
): StageAnchor | null {
  if (!joints || !Object.keys(joints).length) return null;
  const root = computeRoot(joints);
  return { x: root.x, y: root.y, z: root.z ?? 0 };
}

/** Step 2 — Member Default Formation */
export function resolveMemberDefaultFormation(
  groupId: string,
  memberId: string,
): StageAnchor {
  const group = GROUP_DATA[groupId];
  const member = group?.members.find((m) => m.id === memberId);
  return {
    x: member?.defaultX ?? 0.5,
    y: member?.defaultY ?? 0.5,
    z: 0,
  };
}

function slotFromKeyframe(
  keyframe: FormationKeyframe,
  memberId: string,
  fallback: StageAnchor,
): StageAnchor {
  const slot = keyframe.slots?.find((s) => s.memberId === memberId);
  if (!slot) return fallback;
  return { x: slot.x, y: slot.y, z: slot.z ?? 0 };
}

/** Step 3 — Timeline Position (키프레임 보간) */
export function resolveTimelinePosition(
  formationTimeline: FormationTimeline | null | undefined,
  frameFormation: FormationKeyframe | null | undefined,
  timestamp: number,
  memberId: string,
  defaultFormation: StageAnchor,
): StageAnchor {
  const keyframes = formationTimeline?.keyframes || [];
  if (keyframes.length) {
    let prev = keyframes[0];
    let next = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length; i += 1) {
      if (keyframes[i].timestamp <= timestamp) prev = keyframes[i];
      if (keyframes[i].timestamp >= timestamp) {
        next = keyframes[i];
        break;
      }
    }

    const span = next.timestamp - prev.timestamp;
    const ratio = span > 1e-6 ? clamp01((timestamp - prev.timestamp) / span) : 0;
    const prevSlot = slotFromKeyframe(prev, memberId, defaultFormation);
    const nextSlot = slotFromKeyframe(next, memberId, defaultFormation);

    return {
      x: lerp(prevSlot.x, nextSlot.x, ratio),
      y: lerp(prevSlot.y, nextSlot.y, ratio),
      z: lerp(prevSlot.z, nextSlot.z, ratio),
    };
  }

  if (frameFormation?.slots?.length) {
    return slotFromKeyframe(frameFormation, memberId, defaultFormation);
  }

  return defaultFormation;
}

/** Step 4 — Formation Offset (사용자 기준 상대 이동량) */
export function computeFormationOffset(
  memberTimeline: StageAnchor,
  userTimeline: StageAnchor,
  memberDefault: StageAnchor,
  userDefault: StageAnchor,
  scale: number,
): StageAnchor {
  const timelineSpread = {
    x: (memberTimeline.x - userTimeline.x) * scale,
    y: (memberTimeline.y - userTimeline.y) * scale,
    z: (memberTimeline.z - userTimeline.z) * scale,
  };

  const defaultSpread = {
    x: (memberDefault.x - userDefault.x) * scale,
    y: (memberDefault.y - userDefault.y) * scale,
    z: (memberDefault.z - userDefault.z) * scale,
  };

  const hasTimelineMotion =
    Math.abs(timelineSpread.x - defaultSpread.x) > 1e-4
    || Math.abs(timelineSpread.y - defaultSpread.y) > 1e-4;

  return hasTimelineMotion ? timelineSpread : defaultSpread;
}

/** Step 5 — Joint Offset */
export function applyJointOffset(
  joints: Record<string, JointPoint>,
  hipCenter: StageAnchor,
  targetAnchor: StageAnchor,
): Record<string, JointPoint> {
  const offset = {
    x: targetAnchor.x - hipCenter.x,
    y: targetAnchor.y - hipCenter.y,
    z: targetAnchor.z - hipCenter.z,
  };

  const out: Record<string, JointPoint> = {};
  Object.entries(joints).forEach(([name, j]) => {
    if (!j) return;
    out[name] = {
      ...j,
      x: j.x + offset.x,
      y: j.y + offset.y,
      z: (j.z ?? 0) + offset.z,
    };
  });
  return out;
}

function resolveUserFrameHip(
  frameMembers: SkeletonMemberData[] | undefined,
  userMemberId: string,
  userTimeline: StageAnchor,
): StageAnchor {
  const userFrame = frameMembers?.find((m) => m.estimatedMemberId === userMemberId);
  if (!userFrame?.joints) return userTimeline;
  return computeMemberHipCenter(userFrame.joints) || userTimeline;
}

function resolveChoreographyDelta(
  hipCenter: StageAnchor,
  userFrameHip: StageAnchor,
  scale: number,
  isEstimated: boolean,
  frameMembers: SkeletonMemberData[] | undefined,
  groupId: string,
  memberId: string,
  userMemberId: string,
): StageAnchor {
  if (isEstimated || !frameMembers?.length) {
    return { x: 0, y: 0, z: 0 };
  }

  const distinctHips = new Set(
    frameMembers
      .map((m) => computeMemberHipCenter(m.joints))
      .filter(Boolean)
      .map((h) => `${h.x.toFixed(3)},${h.y.toFixed(3)}`),
  );
  if (distinctHips.size < 2) {
    // hip 데이터가 부족할 때(추출된 실제 좌표가 서로 겹치거나 1명뿐일 때)도 0을 반환하지
    // 않고 default formation 기반 분산값을 유지해 겹침을 방지한다.
    return resolveDefaultFormationDelta(groupId, memberId, userMemberId, scale);
  }

  return {
    x: (hipCenter.x - userFrameHip.x) * scale,
    y: (hipCenter.y - userFrameHip.y) * scale,
    z: (hipCenter.z - userFrameHip.z) * scale,
  };
}

/** hip 데이터가 부족할 때의 폴백 — default formation 좌표 차이를 분산값으로 사용 */
function resolveDefaultFormationDelta(
  groupId: string,
  memberId: string,
  userMemberId: string,
  scale: number,
): StageAnchor {
  const memberDefault = resolveMemberDefaultFormation(groupId, memberId);
  const userDefault = resolveMemberDefaultFormation(groupId, userMemberId);
  return {
    x: (memberDefault.x - userDefault.x) * scale,
    y: (memberDefault.y - userDefault.y) * scale,
    z: 0,
  };
}

/** 멤버 간 겹침 방지 — 프레임마다 재계산 */
export function separateOverlappingAnchors(
  anchors: Array<{ memberId: string; anchor: StageAnchor }>,
  minDistance = MIN_MEMBER_DISTANCE,
): Array<{ memberId: string; anchor: StageAnchor }> {
  if (anchors.length < 2) return anchors;

  const result = anchors.map((a) => ({
    memberId: a.memberId,
    anchor: { ...a.anchor },
  }));

  for (let iter = 0; iter < 10; iter += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i].anchor;
        const b = result[j].anchor;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist < minDistance) {
          const push = (minDistance - dist) / 2 + 0.002;
          const angle = dist < 1e-6 ? (i + j + 1) * 1.17 : Math.atan2(dy, dx);
          a.x -= Math.cos(angle) * push;
          a.y -= Math.sin(angle) * push;
          b.x += Math.cos(angle) * push;
          b.y += Math.sin(angle) * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return result;
}

/**
 * 전체 Formation Render 파이프라인 — 프레임마다 호출.
 */
export function applySkeletonFormationPipeline(
  input: SkeletonFormationRenderInput,
): FormationRenderMemberOutput[] {
  const {
    members,
    groupId,
    userMemberId,
    userAnchor,
    timestamp = 0,
    formationTimeline,
    frameFormation,
    referenceUserSlot,
    frameMembers,
    scale = FORMATION_SPREAD_SCALE,
  } = input;

  const group = GROUP_DATA[groupId];
  if (!group || !members.length) return [];

  const userDefault = resolveMemberDefaultFormation(groupId, userMemberId);
  const userTimeline = resolveTimelinePosition(
    formationTimeline,
    frameFormation,
    timestamp,
    userMemberId,
    referenceUserSlot || userDefault,
  );
  const userFrameHip = resolveUserFrameHip(frameMembers, userMemberId, userTimeline);

  const staged: Array<{
    memberId: string;
    joints: Record<string, JointPoint>;
    hipCenter: StageAnchor;
    targetAnchor: StageAnchor;
    isEstimated?: boolean;
  }> = [];

  members.forEach((member) => {
    if (!member.joints || !Object.keys(member.joints).length) return;

    const hipCenter = computeMemberHipCenter(member.joints);
    if (!hipCenter) return;

    if (import.meta.env?.DEV) {
      // hipCenter가 모든 멤버에서 동일하면 스켈레톤 추출 단계(useVideoAnalysis 등)에서
      // joints 좌표가 공유되고 있다는 신호 — 렌더러가 아니라 추출 단계를 확인해야 한다.
      console.log(
        '[Formation] memberId:', member.memberId,
        'hipCenter:', hipCenter,
        'joints keys:', Object.keys(member.joints).length,
      );
    }

    const memberDefault = resolveMemberDefaultFormation(groupId, member.memberId);
    const memberTimeline = resolveTimelinePosition(
      formationTimeline,
      frameFormation,
      timestamp,
      member.memberId,
      memberDefault,
    );

    const formationOffset = computeFormationOffset(
      memberTimeline,
      userTimeline,
      memberDefault,
      userDefault,
      scale,
    );

    const choreoDelta = resolveChoreographyDelta(
      hipCenter,
      userFrameHip,
      scale,
      member.isEstimated ?? false,
      frameMembers,
      groupId,
      member.memberId,
      userMemberId,
    );

    const targetAnchor: StageAnchor = {
      x: userAnchor.x + formationOffset.x + choreoDelta.x,
      y: userAnchor.y + formationOffset.y + choreoDelta.y,
      z: userAnchor.z + formationOffset.z + choreoDelta.z,
    };

    staged.push({
      memberId: member.memberId,
      joints: member.joints,
      hipCenter,
      targetAnchor,
      isEstimated: member.isEstimated,
    });
  });

  const separated = separateOverlappingAnchors(
    staged.map((s) => ({ memberId: s.memberId, anchor: s.targetAnchor })),
  );
  const anchorById = new Map(separated.map((s) => [s.memberId, s.anchor]));

  return staged.map((s) => {
    const targetAnchor = anchorById.get(s.memberId) || s.targetAnchor;
    return {
      memberId: s.memberId,
      joints: applyJointOffset(s.joints, s.hipCenter, targetAnchor),
      stageAnchor: targetAnchor,
      isEstimated: s.isEstimated,
    };
  });
}

export default applySkeletonFormationPipeline;
