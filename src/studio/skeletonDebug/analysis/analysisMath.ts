// @ts-nocheck
import type { DetectionFrame, TrackedPerson } from '../../../services/MultiPersonTracker';
import { POSE_MATCH_JOINTS } from '../../../services/skeleton/poseSimilarity';
import { computeMemberPoseConfidence } from '../../../utils/jointConfidenceFilter';

export function frameDt(
  frames: DetectionFrame[],
  frameIndex: number,
  sampleFps: number,
): number {
  if (frameIndex <= 0) return 1 / sampleFps;
  const t0 = frames[frameIndex - 1]?.timestamp ?? (frameIndex - 1) / sampleFps;
  const t1 = frames[frameIndex]?.timestamp ?? frameIndex / sampleFps;
  return Math.max(1 / sampleFps, t1 - t0);
}

export function personCenter(person: TrackedPerson): { x: number; y: number } | null {
  const lh = person.joints?.left_hip;
  const rh = person.joints?.right_hip;
  if (lh && rh) return { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const ls = person.joints?.left_shoulder;
  const rs = person.joints?.right_shoulder;
  if (ls && rs) return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const nose = person.joints?.nose;
  return nose ? { x: nose.x, y: nose.y } : null;
}

export function computeBBox(joints: TrackedPerson['joints']) {
  const pts = Object.values(joints || {}).filter(
    (j) => Number.isFinite(j.x) && Number.isFinite(j.y),
  );
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 0.02;
  return {
    minX: Math.max(0, Math.min(...xs) - pad),
    minY: Math.max(0, Math.min(...ys) - pad),
    maxX: Math.min(1, Math.max(...xs) + pad),
    maxY: Math.min(1, Math.max(...ys) + pad),
  };
}

export function bboxOverlap(
  a: ReturnType<typeof computeBBox>,
  b: ReturnType<typeof computeBBox>,
): number {
  if (!a || !b) return 0;
  const x0 = Math.max(a.minX, b.minX);
  const y0 = Math.max(a.minY, b.minY);
  const x1 = Math.min(a.maxX, b.maxX);
  const y1 = Math.min(a.maxY, b.maxY);
  if (x1 <= x0 || y1 <= y0) return 0;
  const inter = (x1 - x0) * (y1 - y0);
  const areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
  const areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

export function avgJointVisibility(person: TrackedPerson): number {
  const joints = Object.values(person.joints || {});
  if (!joints.length) return 0;
  const vals = joints.map((j) => j.visibility ?? j.confidence ?? 0).filter(Number.isFinite);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export function jointCompleteness(person: TrackedPerson): number {
  let present = 0;
  POSE_MATCH_JOINTS.forEach((key) => {
    const j = person.joints?.[key];
    if (j && Number.isFinite(j.x) && Number.isFinite(j.y)) {
      const vis = j.visibility ?? j.confidence ?? 0;
      if (vis >= 0.2) present += 1;
    }
  });
  return present / POSE_MATCH_JOINTS.length;
}

export function personVelocity(
  prev: TrackedPerson | null,
  curr: TrackedPerson,
  dtSec: number,
): number {
  if (!prev || dtSec <= 0) return 0;
  const p0 = personCenter(prev);
  const p1 = personCenter(curr);
  if (!p0 || !p1) return 0;
  return Math.hypot(p1.x - p0.x, p1.y - p0.y) / dtSec;
}

export function personPoseConfidence(person: TrackedPerson): number {
  return computeMemberPoseConfidence(person, POSE_MATCH_JOINTS);
}

export function isOutsideScreen(person: TrackedPerson): boolean {
  const box = computeBBox(person.joints);
  if (!box) return true;
  return box.maxX < 0.02 || box.minX > 0.98 || box.maxY < 0.02 || box.minY > 0.98;
}

export function findPrevPerson(
  prevFrame: DetectionFrame | null,
  trackId: number,
): TrackedPerson | null {
  return prevFrame?.detectedPeople?.find((p) => p.trackId === trackId) ?? null;
}

export function findClosestPrevTrack(
  prevFrame: DetectionFrame | null,
  curr: TrackedPerson,
): { trackId: number; distance: number } | null {
  if (!prevFrame?.detectedPeople?.length) return null;
  const c = personCenter(curr);
  if (!c) return null;
  let best: { trackId: number; distance: number } | null = null;
  prevFrame.detectedPeople.forEach((p) => {
    const pc = personCenter(p);
    if (!pc) return;
    const d = Math.hypot(pc.x - c.x, pc.y - c.y);
    if (!best || d < best.distance) best = { trackId: p.trackId, distance: d };
  });
  return best;
}
