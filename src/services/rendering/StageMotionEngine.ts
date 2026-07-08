// @ts-nocheck
/**
 * Stage Motion Engine — 렌더 단계 전용.
 *
 * 추출 프레임(30fps sparse) → Interpolation → Velocity Smoothing → Frame Blending
 * Practice 재생은 timestamp 기준 (frameCount 종료 금지).
 */
import type { SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { PRACTICE_RENDER_FPS } from '../../config/practiceRenderConfig';
import { JointKalmanFilter } from '../motion/JointKalmanFilter';
import {
  interpolateSkeletonFrame,
  resolvePracticeFrameAtTime,
} from '../../utils/skeletonTimelineUtils';

export interface StageMotionEngineOptions {
  renderFps?: number;
  enableSmoothing?: boolean;
  enableBlending?: boolean;
  blendAlpha?: number;
}

const DEFAULT_OPTIONS: Required<StageMotionEngineOptions> = {
  renderFps: PRACTICE_RENDER_FPS,
  enableSmoothing: true,
  enableBlending: true,
  blendAlpha: 0.38,
};

function memberKey(m: SkeletonMemberData): string {
  return String(m.estimatedMemberId ?? m.trackId ?? '');
}

function smoothMemberJoints(
  member: SkeletonMemberData,
  filters: Map<string, JointKalmanFilter>,
): SkeletonMemberData {
  const key = memberKey(member);
  if (!key) return member;

  let filter = filters.get(key);
  if (!filter) {
    filter = new JointKalmanFilter();
    filters.set(key, filter);
  }

  const joints = filter.smoothJoints(member.joints || {});
  return { ...member, joints };
}

function smoothFrameMembers(
  frame: SkeletonFrameData,
  filters: Map<string, JointKalmanFilter>,
): SkeletonFrameData {
  return {
    ...frame,
    members: (frame.members || []).map((m) => smoothMemberJoints(m, filters)),
  };
}

/**
 * 렌더 타임라인용 Motion Engine — 세션당 1인스턴스.
 */
export class StageMotionEngine {
  private options: Required<StageMotionEngineOptions>;
  private memberFilters = new Map<string, JointKalmanFilter>();
  private lastFrame: SkeletonFrameData | null = null;
  private lastTimeSec = -1;

  constructor(options: StageMotionEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  reset() {
    this.memberFilters.forEach((f) => f.reset());
    this.memberFilters.clear();
    this.lastFrame = null;
    this.lastTimeSec = -1;
  }

  /**
   * timestamp → 보간·스무딩·블렌딩된 Practice 프레임.
   * coverage 밖이면 null (freeze 금지).
   */
  resolveFrameAtTime(
    sourceFrames: SkeletonFrameData[] | null | undefined,
    timeSec: number,
  ): SkeletonFrameData | null {
    if (!sourceFrames?.length) return null;

    const t = Math.max(0, Number(timeSec));
    if (!Number.isFinite(t)) return null;

    let frame = resolvePracticeFrameAtTime(sourceFrames, t);
    if (!frame) {
      this.lastFrame = null;
      this.lastTimeSec = -1;
      return null;
    }

    if (this.options.enableSmoothing) {
      frame = smoothFrameMembers(frame, this.memberFilters);
    }

    if (
      this.options.enableBlending
      && this.lastFrame
      && this.lastTimeSec >= 0
      && t >= this.lastTimeSec
      && t - this.lastTimeSec < 1 / this.options.renderFps
    ) {
      const span = Math.max(1e-6, t - this.lastTimeSec);
      const step = 1 / this.options.renderFps;
      const alpha = Math.min(this.options.blendAlpha, span / step);
      frame = interpolateSkeletonFrame(this.lastFrame, frame, alpha);
      frame = { ...frame, timestamp: t, timestampMs: Math.round(t * 1000) };
    }

    this.lastFrame = frame;
    this.lastTimeSec = t;
    return frame;
  }
}

let sharedEngine: StageMotionEngine | null = null;

export function getSharedStageMotionEngine(options?: StageMotionEngineOptions): StageMotionEngine {
  if (!sharedEngine) {
    sharedEngine = new StageMotionEngine(options);
  }
  return sharedEngine;
}

export function resetSharedStageMotionEngine() {
  sharedEngine?.reset();
}

export default StageMotionEngine;
