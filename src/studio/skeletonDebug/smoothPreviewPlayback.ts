// @ts-nocheck
import type { DetectionFrame } from '../../services/MultiPersonTracker';

/** 화면 미리보기 RAF 주기 (추출/재생 공통) */
export const PREVIEW_DISPLAY_FPS = 30;

function frameTimestamp(
  frame: DetectionFrame | null | undefined,
  index: number,
  sampleFps: number,
): number {
  if (!frame) return index / sampleFps;
  return frame.sourceVideoTime ?? frame.timestamp ?? index / sampleFps;
}

export function getInterpolatedVideoTime(
  frames: DetectionFrame[],
  floatIndex: number,
  sampleFps: number,
): number {
  if (!frames.length) return 0;
  const clamped = Math.max(0, Math.min(floatIndex, Math.max(0, frames.length - 1)));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(i0 + 1, frames.length - 1);
  const alpha = clamped - i0;
  const t0 = frameTimestamp(frames[i0], i0, sampleFps);
  const t1 = frameTimestamp(frames[i1], i1, sampleFps);
  return t0 + (t1 - t0) * alpha;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateJointRecords(
  a: Record<string, { x: number; y: number; z?: number; visibility?: number; confidence?: number }>,
  b: Record<string, { x: number; y: number; z?: number; visibility?: number; confidence?: number }>,
  alpha: number,
) {
  const out: Record<string, { x: number; y: number; z?: number; visibility?: number; confidence?: number }> = {};
  const names = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  names.forEach((name) => {
    const ja = a?.[name];
    const jb = b?.[name];
    if (!ja && !jb) return;
    if (!ja) { out[name] = { ...jb }; return; }
    if (!jb) { out[name] = { ...ja }; return; }
    out[name] = {
      x: lerp(ja.x, jb.x, alpha),
      y: lerp(ja.y, jb.y, alpha),
      z: lerp(ja.z ?? 0, jb.z ?? 0, alpha),
      visibility: lerp(ja.visibility ?? 1, jb.visibility ?? 1, alpha),
      confidence: lerp(ja.confidence ?? 1, jb.confidence ?? 1, alpha),
    };
  });
  return out;
}

function interpolatePeople(
  base: DetectionFrame,
  next: DetectionFrame,
  alpha: number,
): DetectionFrame['detectedPeople'] {
  const aPeople = base.detectedPeople || [];
  const bMap = new Map((next.detectedPeople || []).map((p) => [p.trackId, p]));
  return aPeople.map((person) => {
    const other = bMap.get(person.trackId);
    if (!other || alpha <= 0.001) return person;
    return {
      ...person,
      joints: interpolateJointRecords(person.joints, other.joints, alpha),
      confidence: lerp(person.confidence ?? 0, other.confidence ?? 0, alpha),
    };
  });
}

export type DisplayFrameSnapshot = {
  frame: DetectionFrame | null;
  prevFrame: DetectionFrame | null;
  frameIndex: number;
  floatIndex: number;
};

/** float 프레임 인덱스 → 보간된 스켈레톤 + 정수 프레임 인덱스 */
export function buildDisplayFrameSnapshot(
  frames: DetectionFrame[],
  floatIndex: number,
  sampleFps: number,
): DisplayFrameSnapshot {
  if (!frames.length) {
    return { frame: null, prevFrame: null, frameIndex: 0, floatIndex: 0 };
  }

  const clamped = Math.max(0, Math.min(floatIndex, Math.max(0, frames.length - 1)));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(i0 + 1, frames.length - 1);
  const alpha = i1 > i0 ? clamped - i0 : 0;
  const base = frames[i0];
  const next = frames[i1];

  if (!base || alpha <= 0.001 || i0 === i1) {
    return {
      frame: base ?? null,
      prevFrame: i0 > 0 ? frames[i0 - 1] : null,
      frameIndex: i0,
      floatIndex: clamped,
    };
  }

  return {
    frame: {
      ...base,
      detectedPeople: interpolatePeople(base, next, alpha),
    },
    prevFrame: base,
    frameIndex: i0,
    floatIndex: clamped,
  };
}
