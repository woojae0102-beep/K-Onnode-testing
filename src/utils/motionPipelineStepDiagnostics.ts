// @ts-nocheck
/**
 * Motion Pipeline 단계별 실패 진단 — Worker crash 지점 특정용.
 * 예외를 삼키지 않고 로그 후 rethrow.
 */
import type { SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';

export type MotionPipelineStepContext = {
  frameIndex?: number;
  timestamp?: number;
  memberCount?: number;
  trackId?: number;
  estimatedMemberId?: string | null;
  prevIdx?: number;
  currIdx?: number;
  [key: string]: unknown;
};

export function memberJointDiag(
  member: SkeletonMemberData | null | undefined,
  jointsOverride?: Record<string, unknown> | null,
) {
  const joints = jointsOverride ?? member?.joints;
  const safeJoints = joints && typeof joints === 'object' ? joints : null;
  return {
    trackId: member?.trackId,
    estimatedMemberId: member?.estimatedMemberId ?? null,
    jointCount: safeJoints ? Object.keys(safeJoints).length : 0,
    hasLeftHip: !!(safeJoints?.left_hip),
    hasRightHip: !!(safeJoints?.right_hip),
    hasLeftShoulder: !!(safeJoints?.left_shoulder),
    hasRightShoulder: !!(safeJoints?.right_shoulder),
    jointsIsNull: joints == null,
    jointsType: joints == null ? String(joints) : typeof joints,
  };
}

export function jointsRefDiag(
  label: string,
  joints: Record<string, unknown> | null | undefined,
  member?: SkeletonMemberData | null,
) {
  return {
    label,
    ...memberJointDiag(member ?? undefined, joints as Record<string, unknown> | null),
  };
}

export function frameStepContext(frame: SkeletonFrameData | null | undefined): MotionPipelineStepContext {
  return {
    frameIndex: frame?.frameIndex,
    timestamp: frame?.timestamp,
    memberCount: frame?.members?.length ?? 0,
  };
}

export function logMotionPipelineStepFailure(
  step: string,
  error: unknown,
  context: MotionPipelineStepContext = {},
) {
  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    step,
    message: err.message,
    name: err.name,
    stack: err.stack,
    ...context,
  };
  console.error(`[MotionPipeline] STEP FAIL — ${step}`, payload);
  if (err && typeof err === 'object') {
    (err as Error & { motionPipelineStep?: string }).motionPipelineStep = step;
    (err as Error & { motionPipelineContext?: MotionPipelineStepContext }).motionPipelineContext = context;
  }
  return payload;
}

/** 단계 실행 + 실패 시 상세 로그 후 rethrow */
export function runMotionPipelineStep<T>(
  step: string,
  fn: () => T,
  context: MotionPipelineStepContext = {},
): T {
  try {
    return fn();
  } catch (error) {
    logMotionPipelineStepFailure(step, error, context);
    throw error;
  }
}

/** 멤버 배열 요약 — trackMembers 진입 시 */
export function summarizeMembers(members: SkeletonMemberData[] | null | undefined) {
  return (members || []).map((m, idx) => ({
    idx,
    ...memberJointDiag(m),
  }));
}
