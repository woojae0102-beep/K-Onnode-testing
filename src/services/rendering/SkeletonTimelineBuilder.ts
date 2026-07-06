// @ts-nocheck
/**
 * Rendering Layer — sparse 추출 프레임 → 60fps Practice Timeline.
 * 추출 파이프라인은 변경하지 않음.
 */

import type { JointPoint, SkeletonFrameData, SkeletonMemberData } from '../../types/groupPractice';
import { PRACTICE_RENDER_FPS } from '../../config/practiceRenderConfig';
import { logSkeletonRenderVerification } from '../../utils/skeletonRenderVerify';

export interface SkeletonRenderTimeline {
  fps: number;
  duration: number;
  totalFrames: number;
  /** timeline[frameIndex] — findNearestFrame 금지 */
  frames: Array<SkeletonFrameData | null>;
  sourceFrameCount: number;
  sourceFpsEstimate: number;
  coverageEndSec: number;
  builtAt: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpJoint(a: JointPoint, b: JointPoint, t: number): JointPoint {
  const va = a.visibility ?? a.confidence ?? 1;
  const vb = b.visibility ?? b.confidence ?? 1;
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z ?? 0, b.z ?? 0, t),
    visibility: lerp(va, vb, t),
    confidence: lerp(a.confidence ?? va, b.confidence ?? vb, t),
  };
}

function memberKey(m: SkeletonMemberData): string {
  return String(m.estimatedMemberId ?? m.trackId ?? '');
}

function interpolateMembers(
  prev: SkeletonFrameData,
  next: SkeletonFrameData,
  ratio: number,
): SkeletonMemberData[] {
  const prevMap = new Map(prev.members.map((m) => [memberKey(m), m]));
  const keys = new Set<string>();
  prev.members.forEach((m) => keys.add(memberKey(m)));
  next.members.forEach((m) => keys.add(memberKey(m)));

  const members: SkeletonMemberData[] = [];
  keys.forEach((key) => {
    if (!key) return;
    const a = prevMap.get(key) || prev.members.find((m) => memberKey(m) === key);
    const b = next.members.find((m) => memberKey(m) === key);
    if (a && b) {
      const jointNames = new Set([...Object.keys(a.joints || {}), ...Object.keys(b.joints || {})]);
      const joints: Record<string, JointPoint> = {};
      jointNames.forEach((name) => {
        const ja = a.joints?.[name];
        const jb = b.joints?.[name];
        if (ja && jb) joints[name] = lerpJoint(ja, jb, ratio);
        else if (jb) joints[name] = { ...jb };
        else if (ja) joints[name] = { ...ja };
      });
      members.push({
        ...b,
        trackId: b.trackId ?? a.trackId,
        personIndex: b.trackId ?? a.trackId,
        joints,
        isEstimated: a.isEstimated || b.isEstimated,
        confidence: lerp(a.confidence ?? 1, b.confidence ?? 1, ratio),
      });
    } else if (b) {
      members.push({ ...b, joints: { ...b.joints } });
    } else if (a) {
      members.push({ ...a, joints: { ...a.joints }, isEstimated: true });
    }
  });
  return members;
}

function findSourceSegment(
  sourceFrames: SkeletonFrameData[],
  timeSec: number,
): { prev: SkeletonFrameData; next: SkeletonFrameData; ratio: number } | null {
  if (!sourceFrames.length) return null;
  const first = sourceFrames[0];
  const last = sourceFrames[sourceFrames.length - 1];

  if (timeSec <= first.timestamp) {
    return { prev: first, next: first, ratio: 0 };
  }
  if (timeSec >= last.timestamp) {
    return null;
  }

  let lo = 0;
  let hi = sourceFrames.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (sourceFrames[mid].timestamp <= timeSec) lo = mid;
    else hi = mid;
  }

  const prev = sourceFrames[lo];
  const next = sourceFrames[hi];
  const delta = next.timestamp - prev.timestamp;
  const ratio = delta > 1e-6 ? (timeSec - prev.timestamp) / delta : 0;
  return { prev, next, ratio: Math.min(1, Math.max(0, ratio)) };
}

/** 단일 시각의 보간 프레임 — coverage 밖이면 null (Freeze 금지) */
export function interpolateSkeletonAtTime(
  sourceFrames: SkeletonFrameData[],
  timeSec: number,
): SkeletonFrameData | null {
  const seg = findSourceSegment(sourceFrames, timeSec);
  if (!seg) return null;

  const { prev, next, ratio } = seg;
  if (ratio <= 0 && prev === next) return { ...prev, timestamp: timeSec, timestampMs: Math.round(timeSec * 1000) };

  const members = ratio <= 0 ? prev.members : ratio >= 1 ? next.members : interpolateMembers(prev, next, ratio);

  return {
    ...next,
    frameIndex: Math.round(timeSec * PRACTICE_RENDER_FPS),
    timestamp: timeSec,
    timestampMs: Math.round(timeSec * 1000),
    members,
    videoWidth: next.videoWidth ?? prev.videoWidth,
    videoHeight: next.videoHeight ?? prev.videoHeight,
  };
}

/**
 * 10fps(또는 sparse) 추출 → 60fps Render Timeline.
 * Practice는 timeline.frames[frameIndex] 직접 접근.
 */
export function buildSkeletonRenderTimeline(
  sourceFrames: SkeletonFrameData[],
  durationSec: number,
  targetFps = PRACTICE_RENDER_FPS,
): SkeletonRenderTimeline {
  const duration = Math.max(0, Number(durationSec) || 0);
  const fps = Math.max(1, targetFps);
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const coverageEndSec = sourceFrames.length
    ? sourceFrames[sourceFrames.length - 1].timestamp
    : 0;

  const span = sourceFrames.length > 1
    ? sourceFrames[sourceFrames.length - 1].timestamp - sourceFrames[0].timestamp
    : 0;
  const sourceFpsEstimate = span > 0 && sourceFrames.length > 1
    ? (sourceFrames.length - 1) / span
    : sourceFrames.length;

  const frames: Array<SkeletonFrameData | null> = new Array(totalFrames);
  for (let i = 0; i < totalFrames; i += 1) {
    const t = i / fps;
    frames[i] = interpolateSkeletonAtTime(sourceFrames, t);
  }

  const timeline: SkeletonRenderTimeline = {
    fps,
    duration,
    totalFrames,
    frames,
    sourceFrameCount: sourceFrames.length,
    sourceFpsEstimate,
    coverageEndSec,
    builtAt: new Date().toISOString(),
  };

  logSkeletonRenderVerification(timeline, sourceFrames);
  return timeline;
}

/** frameIndex → frame (범위 밖 null) */
export function getRenderTimelineFrame(
  timeline: SkeletonRenderTimeline | null | undefined,
  frameIndex: number,
): SkeletonFrameData | null {
  if (!timeline?.frames?.length) return null;
  const idx = Math.max(0, Math.min(timeline.totalFrames - 1, Math.floor(frameIndex)));
  return timeline.frames[idx] ?? null;
}

export default buildSkeletonRenderTimeline;
