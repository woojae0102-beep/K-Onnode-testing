// @ts-nocheck
import type { SkeletonWorldPoint } from '../types/groupPractice';
import type { TrackedPerson } from '../services/MultiPersonTracker';
import type { MultiLandmarkerDetectResult } from '../services/motion/MultiLandmarkerDetector';

const HAND_WRIST_INDEX = 0;
const FACE_NOSE_TIP_INDEX = 1;

export interface HolisticHandData {
  landmarks: SkeletonWorldPoint[];
  worldLandmarks?: SkeletonWorldPoint[];
  handedness: 'Left' | 'Right';
  confidence: number;
}

export interface HolisticFaceData {
  landmarks: SkeletonWorldPoint[];
  confidence: number;
}

function toPoint(raw: { x?: number; y?: number; z?: number; visibility?: number; presence?: number } | null | undefined): SkeletonWorldPoint | null {
  if (!raw) return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x,
    y,
    z: Number(raw.z ?? 0),
    visibility: Number(raw.visibility ?? raw.presence ?? 1),
    presence: raw.presence != null ? Number(raw.presence) : undefined,
    confidence: Number(raw.visibility ?? raw.presence ?? 1),
  };
}

export function landmarksToPoints(landmarks: unknown[] | undefined): SkeletonWorldPoint[] {
  if (!Array.isArray(landmarks)) return [];
  return landmarks.map((lm) => toPoint(lm as { x?: number; y?: number; z?: number })).filter(Boolean) as SkeletonWorldPoint[];
}

function dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function wristJointForSide(person: TrackedPerson, side: 'Left' | 'Right') {
  const key = side === 'Left' ? 'left_wrist' : 'right_wrist';
  const j = person.joints?.[key];
  if (!j || !Number.isFinite(j.x) || !Number.isFinite(j.y)) return null;
  return { x: j.x, y: j.y };
}

function noseJoint(person: TrackedPerson) {
  const j = person.joints?.nose;
  if (!j || !Number.isFinite(j.x) || !Number.isFinite(j.y)) return null;
  return { x: j.x, y: j.y };
}

function faceCenter(faceLandmarks: unknown[]) {
  const nose = toPoint(faceLandmarks[FACE_NOSE_TIP_INDEX] as { x?: number; y?: number });
  if (nose) return { x: nose.x, y: nose.y };
  const pts = landmarksToPoints(faceLandmarks);
  if (!pts.length) return null;
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}

const HAND_MATCH_MAX_DIST = 0.14;
const FACE_MATCH_MAX_DIST = 0.18;

/**
 * Pose 트랙별 Hand/Face Landmarker 결과를 손목·코 근접도로 매칭.
 */
export function associateHolisticLandmarksToPeople(
  people: TrackedPerson[],
  detection: MultiLandmarkerDetectResult,
): TrackedPerson[] {
  if (!people?.length) return people;

  const usedHandIdx = new Set<number>();
  const usedFaceIdx = new Set<number>();

  return people.map((person) => {
    let leftHand: HolisticHandData | undefined;
    let rightHand: HolisticHandData | undefined;
    let face: HolisticFaceData | undefined;

    const leftWrist = wristJointForSide(person, 'Left');
    const rightWrist = wristJointForSide(person, 'Right');
    const nose = noseJoint(person);

    (detection.hands || []).forEach((hand, handIdx) => {
      if (usedHandIdx.has(handIdx)) return;
      const wristPt = toPoint(hand.landmarks?.[HAND_WRIST_INDEX] as { x?: number; y?: number });
      if (!wristPt) return;

      const targetWrist = hand.handedness === 'Right' ? rightWrist : leftWrist;
      if (!targetWrist) return;

      const dist = dist2d(wristPt, targetWrist);
      if (dist > HAND_MATCH_MAX_DIST) return;

      const payload: HolisticHandData = {
        landmarks: landmarksToPoints(hand.landmarks),
        worldLandmarks: hand.worldLandmarks?.length ? landmarksToPoints(hand.worldLandmarks) : undefined,
        handedness: hand.handedness,
        confidence: hand.score,
      };

      if (hand.handedness === 'Right' && !rightHand) {
        rightHand = payload;
        usedHandIdx.add(handIdx);
      } else if (hand.handedness === 'Left' && !leftHand) {
        leftHand = payload;
        usedHandIdx.add(handIdx);
      }
    });

    if (nose) {
      let bestFaceIdx = -1;
      let bestDist = Infinity;
      (detection.faces || []).forEach((f, faceIdx) => {
        if (usedFaceIdx.has(faceIdx)) return;
        const center = faceCenter(f.landmarks);
        if (!center) return;
        const dist = dist2d(center, nose);
        if (dist < bestDist) {
          bestDist = dist;
          bestFaceIdx = faceIdx;
        }
      });
      if (bestFaceIdx >= 0 && bestDist <= FACE_MATCH_MAX_DIST) {
        const f = detection.faces[bestFaceIdx];
        face = {
          landmarks: landmarksToPoints(f.landmarks),
          confidence: f.score,
        };
        usedFaceIdx.add(bestFaceIdx);
      }
    }

    return {
      ...person,
      leftHand: leftHand ?? person.leftHand,
      rightHand: rightHand ?? person.rightHand,
      face: face ?? person.face,
    };
  });
}

export function sanitizeHolisticHand(hand: HolisticHandData | undefined): HolisticHandData | undefined {
  if (!hand?.landmarks?.length) return undefined;
  return {
    landmarks: hand.landmarks.map((p) => ({ ...p })),
    worldLandmarks: hand.worldLandmarks?.map((p) => ({ ...p })),
    handedness: hand.handedness,
    confidence: hand.confidence,
  };
}

export function sanitizeHolisticFace(face: HolisticFaceData | undefined): HolisticFaceData | undefined {
  if (!face?.landmarks?.length) return undefined;
  return {
    landmarks: face.landmarks.map((p) => ({ ...p })),
    confidence: face.confidence,
  };
}
