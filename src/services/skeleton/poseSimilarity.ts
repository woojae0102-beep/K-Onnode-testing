// @ts-nocheck
import type { SkeletonMemberData } from '../../types/groupPractice';
import { resolveJointScore } from '../../utils/jointConfidenceFilter';

/** 포즈 매칭용 핵심 관절 (X좌표 정렬 사용 금지) */
export const POSE_MATCH_JOINTS = [
  'nose',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;

const MAX_POSE_DISTANCE = 2.5;

type JointRecord = Record<string, {
  x?: number;
  y?: number;
  z?: number;
  confidence?: number;
  visibility?: number;
  presence?: number;
}>;

export interface PoseDistanceOptions {
  /** 이 값 미만 관절은 매칭에서 제외 */
  minJointWeight?: number;
}

function jointMatchWeight(
  ja: JointRecord[string],
  jb: JointRecord[string],
): number {
  return Math.min(resolveJointScore(ja), resolveJointScore(jb));
}

/**
 * confidence · visibility · presence 가중 포즈 거리.
 * 신뢰도 낮은 관절은 기여도↓ — 매칭 정확도 향상.
 */
export function jointsPoseDistance(
  a: JointRecord | null | undefined,
  b: JointRecord | null | undefined,
  options: PoseDistanceOptions = {},
): number {
  if (!a || !b) return MAX_POSE_DISTANCE;

  const minWeight = options.minJointWeight ?? 0.2;
  let weightedSum = 0;
  let weightSum = 0;

  POSE_MATCH_JOINTS.forEach((key) => {
    const ja = a[key];
    const jb = b[key];
    if (!ja || !jb) return;
    if (!Number.isFinite(ja.x) || !Number.isFinite(jb.x)) return;

    const w = jointMatchWeight(ja, jb);
    if (w < minWeight) return;

    const dist = Math.hypot(ja.x - jb.x, ja.y - jb.y, (ja.z ?? 0) - (jb.z ?? 0));
    weightedSum += dist * w;
    weightSum += w;
  });

  if (!weightSum) return MAX_POSE_DISTANCE;
  return Math.min(MAX_POSE_DISTANCE, weightedSum / weightSum);
}

export function poseDistance(
  a: SkeletonMemberData | null | undefined,
  b: SkeletonMemberData | null | undefined,
  options?: PoseDistanceOptions,
): number {
  if (!a?.joints || !b?.joints) return MAX_POSE_DISTANCE;
  return jointsPoseDistance(a.joints, b.joints, options);
}

/** Hungarian Algorithm — 최소 비용 할당 (rows → cols) */
export function hungarianAssign(costMatrix: number[][]): number[] {
  const nRows = costMatrix.length;
  if (!nRows) return [];
  const nCols = costMatrix[0]?.length ?? 0;
  if (!nCols) return Array(nRows).fill(-1);

  const n = Math.max(nRows, nCols);
  const LARGE = 1e9;
  const cost: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i < nRows && j < nCols) return costMatrix[i][j];
      return LARGE;
    }),
  );

  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = Array(nRows).fill(-1);
  for (let j = 1; j <= n; j += 1) {
    const row = p[j] - 1;
    const col = j - 1;
    if (row >= 0 && row < nRows && col >= 0 && col < nCols) {
      assignment[row] = col;
    }
  }
  return assignment;
}
