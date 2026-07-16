// @ts-nocheck
/**
 * Temporal Pose Interpolation / Extrapolation — renderTime(sourceVideoTime) 기준.
 * Analysis samples read-only. frameIndex 보간 금지.
 *
 * 핵심: 분석이 뒤처져도 per-RAF velocity integration으로 절대 freeze 하지 않음.
 */
import type { SkeletonDebugOverlayOptions } from '../types';
import type { RenderStatus, SkeletonRenderStore } from './skeletonRenderStore';

const STALE_SAMPLE_AGE_MS = 500;
const MIN_VELOCITY_SCALE = 0.18;

type PersonLike = {
  trackId: number;
  joints: Record<string, JointPt>;
  confidence?: number;
  isEstimated?: boolean;
};

type JointPt = { x: number; y: number; z?: number; visibility?: number; confidence?: number };
type VelocityPt = { x: number; y: number; z: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateJoints(a: Record<string, JointPt>, b: Record<string, JointPt>, alpha: number) {
  const out: Record<string, JointPt> = {};
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

function computeVelocities(
  prevPrev: PersonLike | undefined,
  prev: PersonLike,
  dt: number,
): Map<string, VelocityPt> {
  const velocities = new Map<string, VelocityPt>();
  if (!prevPrev || dt <= 0.0001) return velocities;

  const names = new Set([...Object.keys(prev.joints || {}), ...Object.keys(prevPrev.joints || {})]);
  names.forEach((name) => {
    const p0 = prevPrev.joints?.[name];
    const p1 = prev.joints?.[name];
    if (!p0 || !p1) return;
    velocities.set(name, {
      x: (p1.x - p0.x) / dt,
      y: (p1.y - p0.y) / dt,
      z: ((p1.z ?? 0) - (p0.z ?? 0)) / dt,
    });
  });
  return velocities;
}

function extrapolateJoints(
  base: Record<string, JointPt>,
  velocities: Map<string, VelocityPt>,
  deltaSec: number,
  scale: number,
): Record<string, JointPt> {
  const out: Record<string, JointPt> = {};
  Object.keys(base).forEach((name) => {
    const j = base[name];
    const v = velocities.get(name);
    if (!v) {
      out[name] = { ...j };
      return;
    }
    const s = scale * deltaSec;
    out[name] = {
      ...j,
      x: j.x + v.x * s,
      y: j.y + v.y * s,
      z: (j.z ?? 0) + v.z * s,
    };
  });
  return out;
}

function velocityScaleFromAge(sampleAgeMs: number): number {
  if (sampleAgeMs < STALE_SAMPLE_AGE_MS) return 1;
  const t = (sampleAgeMs - STALE_SAMPLE_AGE_MS) / 2500;
  return Math.max(MIN_VELOCITY_SCALE, Math.exp(-t));
}

const scratchPeople: Array<{
  trackId: number;
  joints: Record<string, JointPt>;
  confidence: number;
  isEstimated: boolean;
}> = [];

/** keyframe 동기화용 */
const trackKeyframeIndex = new Map<number, number>();

export type RenderInterpolatedSnapshot = {
  people: typeof scratchPeople;
  frameIndex: number;
  renderStatus: RenderStatus;
  interpolationActive: boolean;
  alpha: number;
  renderTime: number;
  prevJointsByTrack: Map<number, Record<string, JointPt>>;
};

function shouldRenderPerson(
  person: PersonLike,
  overlay: SkeletonDebugOverlayOptions,
  isExtracting: boolean,
): boolean {
  if (isExtracting) return true;
  if (!overlay.showEstimated && person.isEstimated) return false;
  return true;
}

function pickPerson(personA?: PersonLike, personB?: PersonLike): PersonLike | null {
  if (!personA && !personB) return null;
  if (!personA) return personB ?? null;
  if (!personB) return personA;
  if (!personA.isEstimated && personB.isEstimated) return personA;
  if (personA.isEstimated && !personB.isEstimated) return personB;
  return personB;
}

function syncTrackFromJoints(trackId: number, joints: Record<string, JointPt>, keyframeIndex: number) {
  trackKeyframeIndex.set(trackId, keyframeIndex);
}

function buildInterpolatedPeople(
  prevFrame: ReturnType<SkeletonRenderStore['getSample']>,
  nextFrame: ReturnType<SkeletonRenderStore['getSample']>,
  alpha: number,
  prevIndex: number,
  overlay: SkeletonDebugOverlayOptions,
  isExtracting: boolean,
): { people: typeof scratchPeople; interpolationActive: boolean } {
  scratchPeople.length = 0;
  const interpolationActive = alpha > 0.001 && alpha < 0.999;

  const mapA = new Map<number, PersonLike>(
    (prevFrame?.detectedPeople || []).map((p) => [p.trackId, p]),
  );
  const mapB = new Map<number, PersonLike>(
    (nextFrame?.detectedPeople || []).map((p) => [p.trackId, p]),
  );
  const allTrackIds = new Set([...mapA.keys(), ...mapB.keys()]);

  allTrackIds.forEach((trackId) => {
    const personA = mapA.get(trackId);
    const personB = mapB.get(trackId);
    const ref = pickPerson(personA, personB);
    if (!ref || !shouldRenderPerson(ref, overlay, isExtracting)) return;

    let joints = ref.joints;
    let confidence = ref.confidence ?? 0;
    let isEstimated = Boolean(ref.isEstimated);

    if (personA && personB && interpolationActive) {
      joints = interpolateJoints(personA.joints, personB.joints, alpha);
      confidence = lerp(personA.confidence ?? 0, personB.confidence ?? 0, alpha);
      isEstimated = Boolean(personA.isEstimated || personB.isEstimated);
    }

    syncTrackFromJoints(trackId, joints, prevIndex);

    scratchPeople.push({ trackId, joints, confidence, isEstimated });
  });

  return { people: scratchPeople, interpolationActive };
}

function buildExtrapolatedPeople(
  store: SkeletonRenderStore,
  prevIndex: number,
  renderTime: number,
  overlay: SkeletonDebugOverlayOptions,
  isExtracting: boolean,
  sampleAgeMs: number,
): { people: typeof scratchPeople; renderStatus: RenderStatus; interpolationActive: boolean } {
  scratchPeople.length = 0;

  const prevFrame = store.getSample(prevIndex);
  const prevPrevFrame = prevIndex > 0 ? store.getSample(prevIndex - 1) : null;
  const prevTime = store.getSampleTimeAt(prevIndex);
  const prevPrevTime = prevIndex > 0 ? store.getSampleTimeAt(prevIndex - 1) : prevTime;
  const gapSec = Math.max(0, renderTime - prevTime);
  const dtPrev = prevIndex > 0 && prevTime > prevPrevTime ? prevTime - prevPrevTime : 0.5;

  let renderStatus: RenderStatus = gapSec > 0.001 ? 'EXTRAPOLATING' : 'HOLD_DECAY';
  if (sampleAgeMs >= STALE_SAMPLE_AGE_MS) renderStatus = 'STALE';

  const ageScale = velocityScaleFromAge(sampleAgeMs);

  (prevFrame?.detectedPeople || []).forEach((person) => {
    if (!shouldRenderPerson(person, overlay, isExtracting)) return;

    const velocities = computeVelocities(
      prevPrevFrame?.detectedPeople?.find((p) => p.trackId === person.trackId),
      person,
      dtPrev,
    );

    let joints = person.joints;
    if (gapSec > 0.0001) {
      joints = extrapolateJoints(person.joints, velocities, gapSec, ageScale);
    }

    scratchPeople.push({
      trackId: person.trackId,
      joints,
      confidence: person.confidence ?? 0,
      isEstimated: Boolean(person.isEstimated),
    });
  });

  return { people: scratchPeople, renderStatus, interpolationActive: false };
}

export function buildRenderSnapshotAtRenderTime(
  store: SkeletonRenderStore,
  renderTime: number,
  overlay: SkeletonDebugOverlayOptions,
  opts?: { isExtracting?: boolean; rafDeltaSec?: number },
): RenderInterpolatedSnapshot {
  const isExtracting = opts?.isExtracting ?? false;
  const sampleAgeMs = store.getLastSampleArrivalAgeMs();
  const bracket = store.findSamplesByTime(renderTime);

  if (!bracket) {
    return {
      people: scratchPeople,
      frameIndex: 0,
      renderStatus: 'IDLE',
      interpolationActive: false,
      alpha: 0,
      renderTime,
      prevJointsByTrack: new Map(),
    };
  }

  const { prevIndex, nextIndex, alpha } = bracket;
  const prevJointsByTrack = new Map<number, Record<string, JointPt>>();

  if (prevIndex != null) {
    const pf = store.getSample(prevIndex);
    (pf?.detectedPeople || []).forEach((p) => prevJointsByTrack.set(p.trackId, p.joints));
  }

  if (prevIndex != null && nextIndex != null && nextIndex !== prevIndex) {
    const prevFrame = store.getSample(prevIndex);
    const nextFrame = store.getSample(nextIndex);
    const { people, interpolationActive } = buildInterpolatedPeople(
      prevFrame,
      nextFrame,
      alpha,
      prevIndex,
      overlay,
      isExtracting,
    );
    return {
      people,
      frameIndex: prevIndex,
      renderStatus: 'INTERPOLATING',
      interpolationActive,
      alpha,
      renderTime,
      prevJointsByTrack,
    };
  }

  if (prevIndex != null && (nextIndex == null || nextIndex === prevIndex)) {
    const { people, renderStatus, interpolationActive } = buildExtrapolatedPeople(
      store,
      prevIndex,
      renderTime,
      overlay,
      isExtracting,
      sampleAgeMs,
    );
    return {
      people,
      frameIndex: prevIndex,
      renderStatus,
      interpolationActive,
      alpha: 0,
      renderTime,
      prevJointsByTrack,
    };
  }

  if (nextIndex != null && prevIndex == null) {
    const nextFrame = store.getSample(nextIndex);
    scratchPeople.length = 0;
    (nextFrame?.detectedPeople || []).forEach((person) => {
      if (!shouldRenderPerson(person, overlay, isExtracting)) return;
      syncTrackFromJoints(person.trackId, person.joints, nextIndex);
      scratchPeople.push({
        trackId: person.trackId,
        joints: person.joints,
        confidence: person.confidence ?? 0,
        isEstimated: Boolean(person.isEstimated),
      });
    });
    return {
      people: scratchPeople,
      frameIndex: nextIndex,
      renderStatus: 'HOLD_DECAY',
      interpolationActive: false,
      alpha: 0,
      renderTime,
      prevJointsByTrack,
    };
  }

  return {
    people: scratchPeople,
    frameIndex: 0,
    renderStatus: 'IDLE',
    interpolationActive: false,
    alpha: 0,
    renderTime,
    prevJointsByTrack: new Map(),
  };
}

/** @deprecated */
export function buildRenderSnapshotAtVideoTime(
  store: SkeletonRenderStore,
  videoTime: number,
  overlay: SkeletonDebugOverlayOptions,
  opts?: { isExtracting?: boolean },
): RenderInterpolatedSnapshot {
  return buildRenderSnapshotAtRenderTime(store, videoTime, overlay, opts);
}

export function resetRenderSmoothing(): void {
  trackKeyframeIndex.clear();
}
