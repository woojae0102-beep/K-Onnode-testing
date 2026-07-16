// @ts-nocheck
/**
 * MediaPipe Raw Debug — read-only landmark parsing (Pipeline 알고리즘 미변경).
 */
import {
  applyJointConfidenceFilter,
  classifyJointConfidence,
  computeMemberPoseConfidence,
  resolveJointConfidence,
  toJointPoint,
  JOINT_CONFIDENCE_DISCARD_MAX,
  type MediaPipeJointInput,
} from '../../../utils/jointConfidenceFilter';
import { CHOREO_MIN_PERSON_CONFIDENCE } from '../../../config/choreoExtractConfig';

/** BlazePose 33 landmarks */
export const POSE_LANDMARK_COUNT = 33;

export const POSE_LANDMARK_NAMES: string[] = [
  'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner', 'right_eye', 'right_eye_outer',
  'left_ear', 'right_ear', 'mouth_left', 'mouth_right', 'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky',
  'left_index', 'right_index', 'left_thumb', 'right_thumb', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index',
];

/** Pipeline JOINT_MAP subset (MultiPersonTracker와 동일 인덱스) */
export const TRACKER_JOINT_MAP: Record<string, number> = {
  nose: 0,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};

const CORE_JOINTS = ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] as const;
const VISIBILITY_FILTER_MIN = 0.2;

export type JointDebugRow = {
  name: string;
  index: number;
  visibility: number;
  confidence: number;
  presence: number;
  action: 'keep' | 'interpolate' | 'discard' | 'missing';
  x: number;
  y: number;
};

export type RawPersonDebug = {
  detectionIndex: number;
  rawLandmarkCount: number;
  worldLandmarkCount: number;
  poseConfidence: number;
  visibilityAverage: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  jointComplete33: boolean;
  missingJointCount: number;
  joints: JointDebugRow[];
  jointDropHeatmap: Record<string, number>;
};

export function extractTrackerJoints(landmarks: unknown[]): Record<string, ReturnType<typeof toJointPoint>> {
  const joints: Record<string, ReturnType<typeof toJointPoint>> = {};
  const arr = landmarks as MediaPipeJointInput[];
  Object.entries(TRACKER_JOINT_MAP).forEach(([name, idx]) => {
    const lm = arr[idx];
    if (lm) joints[name] = toJointPoint(lm);
  });
  return joints;
}

export function calculateRawPoseConfidence(joints: Record<string, ReturnType<typeof toJointPoint>>): number {
  const coreValues = CORE_JOINTS.map((name) => joints[name]).filter(Boolean);
  if (coreValues.length >= 3) {
    const avg = coreValues.reduce((sum, j) => sum + resolveJointConfidence(j.visibility, j.presence), 0) / coreValues.length;
    return Math.max(0.4, avg);
  }
  const values = Object.values(joints);
  if (!values.length) return 0;
  return values.reduce((sum, j) => sum + resolveJointConfidence(j.visibility, j.presence), 0) / values.length;
}

export function computeBBoxFromLandmarks(landmarks: unknown[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts = (landmarks as MediaPipeJointInput[]).filter((lm) => Number.isFinite(lm?.x) && Number.isFinite(lm?.y));
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x as number);
  const ys = pts.map((p) => p.y as number);
  const pad = 0.01;
  return {
    minX: Math.max(0, Math.min(...xs) - pad),
    minY: Math.max(0, Math.min(...ys) - pad),
    maxX: Math.min(1, Math.max(...xs) + pad),
    maxY: Math.min(1, Math.max(...ys) + pad),
  };
}

export function isBboxOutside(bbox: { minX: number; minY: number; maxX: number; maxY: number } | null): boolean {
  if (!bbox) return true;
  return bbox.maxX < 0.02 || bbox.minX > 0.98 || bbox.maxY < 0.02 || bbox.minY > 0.98;
}

export function buildJointRows(landmarks: unknown[]): JointDebugRow[] {
  const arr = landmarks as MediaPipeJointInput[];
  const rows: JointDebugRow[] = [];
  for (let i = 0; i < POSE_LANDMARK_COUNT; i += 1) {
    const lm = arr[i];
    const name = POSE_LANDMARK_NAMES[i] ?? `lm_${i}`;
    if (!lm) {
      rows.push({
        name, index: i, visibility: 0, confidence: 0, presence: 0, action: 'missing', x: 0, y: 0,
      });
      continue;
    }
    const vis = resolveJointConfidence(lm.visibility, lm.presence);
    rows.push({
      name,
      index: i,
      visibility: lm.visibility ?? vis,
      confidence: vis,
      presence: lm.presence ?? vis,
      action: classifyJointConfidence(vis),
      x: lm.x ?? 0,
      y: lm.y ?? 0,
    });
  }
  return rows;
}

export function buildJointDropHeatmap(joints: JointDebugRow[]): Record<string, number> {
  const heat: Record<string, number> = {};
  joints.forEach((j) => {
    if (j.action === 'discard' || j.action === 'missing') {
      heat[j.name] = j.action === 'missing' ? 1 : 0.7;
    } else if (j.action === 'interpolate') {
      heat[j.name] = 0.4;
    }
  });
  return heat;
}

export function parseRawPerson(
  landmarks: unknown[],
  worldLandmarks: unknown[] | undefined,
  detectionIndex: number,
): RawPersonDebug {
  const arr = landmarks as MediaPipeJointInput[];
  const rawLandmarkCount = arr.length;
  const worldArr = worldLandmarks?.[detectionIndex] as MediaPipeJointInput[] | undefined;
  const worldLandmarkCount = worldArr?.length ?? 0;
  const joints = extractTrackerJoints(landmarks);
  const filtered = applyJointConfidenceFilter(joints, worldArr ? extractTrackerJoints(worldArr) : {});
  const poseConfidence = computeMemberPoseConfidence({
    joints: filtered.joints,
    confidence: calculateRawPoseConfidence(joints),
  });
  const jointRows = buildJointRows(landmarks);
  const visibilityAverage = jointRows.length
    ? jointRows.reduce((s, j) => s + j.confidence, 0) / jointRows.length
    : 0;
  const missingJointCount = jointRows.filter((j) => j.action === 'missing' || j.confidence <= JOINT_CONFIDENCE_DISCARD_MAX).length;

  return {
    detectionIndex,
    rawLandmarkCount,
    worldLandmarkCount,
    poseConfidence,
    visibilityAverage,
    bbox: computeBBoxFromLandmarks(landmarks),
    jointComplete33: rawLandmarkCount >= POSE_LANDMARK_COUNT,
    missingJointCount,
    joints: jointRows,
    jointDropHeatmap: buildJointDropHeatmap(jointRows),
  };
}

export function passesConfidenceFilter(person: RawPersonDebug): boolean {
  return person.poseConfidence > CHOREO_MIN_PERSON_CONFIDENCE;
}

export function passesVisibilityFilter(person: RawPersonDebug): boolean {
  const core = person.joints.filter((j) => CORE_JOINTS.includes(j.name as typeof CORE_JOINTS[number]));
  if (!core.length) return person.visibilityAverage >= VISIBILITY_FILTER_MIN;
  const avg = core.reduce((s, j) => s + j.confidence, 0) / core.length;
  return avg >= VISIBILITY_FILTER_MIN;
}

export function countValidPosesMirror(landmarksList: unknown[][]): number {
  return landmarksList.filter((lm) => {
    const joints = extractTrackerJoints(lm);
    return calculateRawPoseConfidence(joints) > CHOREO_MIN_PERSON_CONFIDENCE;
  }).length;
}

export const CONFIDENCE_THRESHOLD = CHOREO_MIN_PERSON_CONFIDENCE;
export const VISIBILITY_THRESHOLD = VISIBILITY_FILTER_MIN;
