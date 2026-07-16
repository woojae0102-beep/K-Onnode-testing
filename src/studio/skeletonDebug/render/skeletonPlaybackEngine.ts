// @ts-nocheck
/**
 * Skeleton Playback Engine — 저장된 SkeletonFrame[] + previewVideo.currentTime 기준 재생.
 * Analysis pipeline과 완전 분리. extractionVideo / lastAnalysisTime 미사용.
 */
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugOverlayOptions } from '../types';

export type SkeletonPlaybackMode = 'ANALYZING' | 'ANALYSIS_COMPLETE' | 'PLAYBACK';

export type PlaybackRenderStatus =
  | 'ANALYZING_DISABLED'
  | 'NO_DATA'
  | 'OUT_OF_RANGE'
  | 'HOLDING'
  | 'INTERPOLATING'
  | 'LOW_DATA_GAP';

export type SkeletonPlaybackState = {
  playbackTime: number;
  previousFrame: DetectionFrame | null;
  nextFrame: DetectionFrame | null;
  previousFrameTime: number;
  nextFrameTime: number;
  interpolationAlpha: number;
  frameGapSec: number;
  renderStatus: PlaybackRenderStatus;
  skeletonDataFps: number;
  playbackSource: 'STORED_SKELETON_TIMELINE' | 'NONE';
};

export type PlaybackPerson = {
  trackId: number;
  joints: Record<string, JointPt>;
  confidence: number;
  isEstimated: boolean;
};

type JointPt = { x: number; y: number; z?: number; visibility?: number; confidence?: number };

export type PlaybackDrawSnapshot = {
  people: PlaybackPerson[];
  frameIndex: number;
  renderStatus: PlaybackRenderStatus;
  interpolationActive: boolean;
  alpha: number;
  playbackTime: number;
  prevJointsByTrack: Map<number, Record<string, JointPt>>;
  state: SkeletonPlaybackState;
};

export type SkeletonTimeline = {
  frames: DetectionFrame[];
  times: number[];
  skeletonDataFps: number;
  maxGapSec: number;
  medianGapSec: number;
  isValid: boolean;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function frameSourceTime(frame: DetectionFrame, fallbackIndex: number, sampleFps: number): number {
  const t = frame.sourceVideoTime ?? frame.timestamp;
  if (Number.isFinite(t) && t >= 0) return t;
  return fallbackIndex / Math.max(1, sampleFps);
}

export function buildSkeletonTimeline(frames: DetectionFrame[], sampleFps: number): SkeletonTimeline {
  const withTime = frames
    .map((frame, frameIndex) => ({ frame, frameIndex }))
    .filter(({ frame }) => (frame.detectedPeople?.length ?? 0) > 0)
    .map(({ frame, frameIndex }) => ({
      frame,
      t: frameSourceTime(frame, frameIndex, sampleFps),
    }))
    .sort((a, b) => a.t - b.t);

  const deduped: typeof withTime = [];
  withTime.forEach((entry) => {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.t - entry.t) < 0.001) {
      deduped[deduped.length - 1] = entry;
      return;
    }
    deduped.push(entry);
  });

  const times = deduped.map((x) => x.t);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push(times[i] - times[i - 1]);
  }

  const medianGapSec = gaps.length
    ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    : 1 / Math.max(1, sampleFps);
  const maxGapSec = gaps.length ? Math.max(...gaps) : medianGapSec;
  const skeletonDataFps = medianGapSec > 0 ? 1 / medianGapSec : sampleFps;

  let isValid = deduped.length >= 2;
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] < times[i - 1] - 0.0001) isValid = false;
  }

  return {
    frames: deduped.map((x) => x.frame),
    times,
    skeletonDataFps,
    maxGapSec,
    medianGapSec,
    isValid,
  };
}

export type BracketResult = {
  prevIndex: number | null;
  nextIndex: number | null;
  prevTime: number;
  nextTime: number;
  alpha: number;
  frameGapSec: number;
};

export function findBracket(times: number[], playbackTime: number): BracketResult | null {
  if (!times.length) return null;

  const t = Math.max(0, playbackTime);
  const n = times.length;

  if (t <= times[0]) {
    return {
      prevIndex: null,
      nextIndex: 0,
      prevTime: times[0],
      nextTime: times[0],
      alpha: 0,
      frameGapSec: 0,
    };
  }

  if (t >= times[n - 1]) {
    return {
      prevIndex: n - 1,
      nextIndex: null,
      prevTime: times[n - 1],
      nextTime: times[n - 1],
      alpha: 1,
      frameGapSec: 0,
    };
  }

  let lo = 0;
  let hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }

  const prevTime = times[lo];
  const nextTime = times[hi];
  const denom = nextTime - prevTime;
  const alpha = denom > 0.000001 ? clamp01((t - prevTime) / denom) : 0;

  return {
    prevIndex: lo,
    nextIndex: hi,
    prevTime,
    nextTime,
    alpha,
    frameGapSec: denom,
  };
}

function smoothStep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function interpolateJointsCatmull(
  frames: DetectionFrame[],
  indices: [number, number, number, number],
  trackId: number,
  alpha: number,
): Record<string, JointPt> | null {
  const people = indices.map((idx) => {
    const frame = frames[idx];
    return (frame?.detectedPeople || []).find((p) => p.trackId === trackId) ?? null;
  });
  if (!people[1] && !people[2]) return null;
  const ref = people[1] ?? people[2];
  if (!ref) return null;

  const smoothAlpha = smoothStep01(alpha);
  const jointNames = new Set<string>();
  people.forEach((person) => {
    if (!person) return;
    Object.keys(person.joints || {}).forEach((name) => jointNames.add(name));
  });

  const out: Record<string, JointPt> = {};
  jointNames.forEach((name) => {
    const pts = people.map((person) => person?.joints?.[name] ?? null);
    const hasMid = pts[1] || pts[2];
    if (!hasMid) return;

    const fallback = pts[1] ?? pts[2]!;
    const p0 = pts[0] ?? pts[1] ?? fallback;
    const p1 = pts[1] ?? pts[2] ?? fallback;
    const p2 = pts[2] ?? pts[1] ?? fallback;
    const p3 = pts[3] ?? pts[2] ?? fallback;

    const x = catmullRom1D(p0.x, p1.x, p2.x, p3.x, smoothAlpha);
    const y = catmullRom1D(p0.y, p1.y, p2.y, p3.y, smoothAlpha);
    const z = catmullRom1D(p0.z ?? 0, p1.z ?? 0, p2.z ?? 0, p3.z ?? 0, smoothAlpha);
    const visibility = catmullRom1D(
      p0.visibility ?? 1,
      p1.visibility ?? 1,
      p2.visibility ?? 1,
      p3.visibility ?? 1,
      smoothAlpha,
    );
    const confidence = catmullRom1D(
      p0.confidence ?? 1,
      p1.confidence ?? 1,
      p2.confidence ?? 1,
      p3.confidence ?? 1,
      smoothAlpha,
    );
    out[name] = { x, y, z, visibility, confidence };
  });
  return out;
}

export type SplineBracket = BracketResult & {
  splineIndices: [number, number, number, number];
  smoothAlpha: number;
};

export function findSplineBracket(times: number[], playbackTime: number): SplineBracket | null {
  const bracket = findBracket(times, playbackTime);
  if (!bracket) return null;

  const centerA = bracket.prevIndex ?? bracket.nextIndex ?? 0;
  const centerB = bracket.nextIndex ?? bracket.prevIndex ?? centerA;
  const i0 = Math.max(0, Math.min(centerA, centerB) - 1);
  const i1 = Math.min(centerA, centerB);
  const i2 = Math.max(centerA, centerB);
  const i3 = Math.min(times.length - 1, Math.max(centerA, centerB) + 1);

  return {
    ...bracket,
    splineIndices: [i0, i1, i2, i3],
    smoothAlpha: smoothStep01(bracket.alpha),
  };
}

function interpolateJoints(
  a: Record<string, JointPt>,
  b: Record<string, JointPt>,
  alpha: number,
): Record<string, JointPt> {
  const out: Record<string, JointPt> = {};
  const names = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  names.forEach((name) => {
    const ja = a?.[name];
    const jb = b?.[name];
    if (!ja && !jb) return;
    if (!ja) {
      out[name] = { ...jb, confidence: (jb.confidence ?? 1) * 0.85 };
      return;
    }
    if (!jb) {
      out[name] = { ...ja, confidence: (ja.confidence ?? 1) * 0.85 };
      return;
    }
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

function shouldRenderPerson(
  person: { isEstimated?: boolean },
  overlay: SkeletonDebugOverlayOptions,
): boolean {
  if (!overlay.showEstimated && person.isEstimated) return false;
  return true;
}

const scratchPeople: PlaybackPerson[] = [];

export function buildPlaybackSnapshot(
  timeline: SkeletonTimeline | null,
  playbackTime: number,
  overlay: SkeletonDebugOverlayOptions,
  mode: SkeletonPlaybackMode,
): PlaybackDrawSnapshot {
  const emptyState: SkeletonPlaybackState = {
    playbackTime,
    previousFrame: null,
    nextFrame: null,
    previousFrameTime: 0,
    nextFrameTime: 0,
    interpolationAlpha: 0,
    frameGapSec: 0,
    renderStatus: mode === 'ANALYZING' ? 'ANALYZING_DISABLED' : 'NO_DATA',
    skeletonDataFps: timeline?.skeletonDataFps ?? 0,
    playbackSource: 'NONE',
  };

  if (mode === 'ANALYZING') {
    return {
      people: scratchPeople,
      frameIndex: 0,
      renderStatus: 'ANALYZING_DISABLED',
      interpolationActive: false,
      alpha: 0,
      playbackTime,
      prevJointsByTrack: new Map(),
      state: emptyState,
    };
  }

  if (!timeline?.frames.length) {
    return {
      people: scratchPeople,
      frameIndex: 0,
      renderStatus: 'NO_DATA',
      interpolationActive: false,
      alpha: 0,
      playbackTime,
      prevJointsByTrack: new Map(),
      state: emptyState,
    };
  }

  const bracket = findBracket(timeline.times, playbackTime);
  if (!bracket) {
    return {
      people: scratchPeople,
      frameIndex: 0,
      renderStatus: 'NO_DATA',
      interpolationActive: false,
      alpha: 0,
      playbackTime,
      prevJointsByTrack: new Map(),
      state: { ...emptyState, skeletonDataFps: timeline.skeletonDataFps, playbackSource: 'STORED_SKELETON_TIMELINE' },
    };
  }

  const { prevIndex, nextIndex, prevTime, nextTime, alpha, frameGapSec } = bracket;
  const lastTime = timeline.times[timeline.times.length - 1];

  let renderStatus: PlaybackRenderStatus = 'HOLDING';
  if (playbackTime > lastTime + 0.05 || playbackTime < timeline.times[0] - 0.05) {
    renderStatus = 'OUT_OF_RANGE';
  } else if (prevIndex != null && nextIndex != null && prevIndex !== nextIndex) {
    renderStatus = frameGapSec > 1.0 ? 'LOW_DATA_GAP' : 'INTERPOLATING';
  }

  scratchPeople.length = 0;
  const prevJointsByTrack = new Map<number, Record<string, JointPt>>();

  const prevFrame = prevIndex != null ? timeline.frames[prevIndex] : null;
  const nextFrame = nextIndex != null ? timeline.frames[nextIndex] : null;

  if (prevFrame) {
    (prevFrame.detectedPeople || []).forEach((p) => prevJointsByTrack.set(p.trackId, p.joints));
  }

  if (prevIndex != null && nextIndex != null && prevIndex !== nextIndex && prevFrame && nextFrame) {
    const mapA = new Map((prevFrame.detectedPeople || []).map((p) => [p.trackId, p]));
    const mapB = new Map((nextFrame.detectedPeople || []).map((p) => [p.trackId, p]));
    const sharedTrackIds = [...mapA.keys()].filter((id) => mapB.has(id));
    const spline = findSplineBracket(timeline.times, playbackTime);
    const useSpline = Boolean(
      spline
      && spline.splineIndices[0] !== spline.splineIndices[3]
      && frameGapSec <= 2.5,
    );

    sharedTrackIds.forEach((trackId) => {
      const personA = mapA.get(trackId);
      const personB = mapB.get(trackId);
      if (!personA || !personB) return;
      if (!shouldRenderPerson(personA, overlay) && !shouldRenderPerson(personB, overlay)) return;

      let joints: Record<string, JointPt>;
      if (useSpline && spline) {
        joints = interpolateJointsCatmull(
          timeline.frames,
          spline.splineIndices,
          trackId,
          bracket.alpha,
        ) ?? interpolateJoints(personA.joints, personB.joints, smoothStep01(alpha));
      } else {
        joints = alpha > 0.001 && alpha < 0.999
          ? interpolateJoints(personA.joints, personB.joints, smoothStep01(alpha))
          : (alpha >= 0.999 ? personB.joints : personA.joints);
      }

      const isEstimated = Boolean(personA.isEstimated || personB.isEstimated || alpha > 0.001);
      scratchPeople.push({
        trackId,
        joints,
        confidence: lerp(personA.confidence ?? 0, personB.confidence ?? 0, smoothStep01(alpha)),
        isEstimated,
      });
    });

    mapA.forEach((personA, trackId) => {
      if (mapB.has(trackId)) return;
      if (!shouldRenderPerson(personA, overlay)) return;
      scratchPeople.push({
        trackId,
        joints: personA.joints,
        confidence: personA.confidence ?? 0,
        isEstimated: true,
      });
    });

    mapB.forEach((personB, trackId) => {
      if (mapA.has(trackId)) return;
      if (!shouldRenderPerson(personB, overlay)) return;
      scratchPeople.push({
        trackId,
        joints: personB.joints,
        confidence: personB.confidence ?? 0,
        isEstimated: true,
      });
    });
  } else {
    const refFrame = nextFrame ?? prevFrame;
    (refFrame?.detectedPeople || []).forEach((person) => {
      if (!shouldRenderPerson(person, overlay)) return;
      scratchPeople.push({
        trackId: person.trackId,
        joints: person.joints,
        confidence: person.confidence ?? 0,
        isEstimated: Boolean(person.isEstimated),
      });
    });
  }

  const state: SkeletonPlaybackState = {
    playbackTime,
    previousFrame: prevFrame,
    nextFrame: nextFrame,
    previousFrameTime: prevTime,
    nextFrameTime: nextTime,
    interpolationAlpha: alpha,
    frameGapSec,
    renderStatus,
    skeletonDataFps: timeline.skeletonDataFps,
    playbackSource: 'STORED_SKELETON_TIMELINE',
  };

  return {
    people: scratchPeople,
    frameIndex: prevIndex ?? nextIndex ?? 0,
    renderStatus,
    interpolationActive: renderStatus === 'INTERPOLATING' || renderStatus === 'LOW_DATA_GAP',
    alpha,
    playbackTime,
    prevJointsByTrack,
    state,
  };
}
