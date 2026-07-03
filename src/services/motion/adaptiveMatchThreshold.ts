// @ts-nocheck
import { POSE_MATCH_JOINTS } from '../skeleton/poseSimilarity';
import { computeMemberPoseConfidence, resolveJointScore } from '../../utils/jointConfidenceFilter';

/** 기본 매칭 임계값 — 곡/속도에 따라 adaptive로 조정 */
export const BASE_MATCH_COST_THRESHOLD = 0.72;
export const MIN_MATCH_COST_THRESHOLD = 0.52;
export const MAX_MATCH_COST_THRESHOLD = 1.18;

type JointRecord = Record<string, { x?: number; y?: number; z?: number; confidence?: number; visibility?: number }>;

export interface AdaptiveThresholdInput {
  /** 관절 평균 속도 (정규화 좌표/초) */
  motionVelocity?: number;
  /** 0~1 프레임 평균 pose confidence */
  poseConfidence?: number;
  bpm?: number;
  sampleFps?: number;
  /** 연속 가려짐 프레임 수 — 재등장 시 임계값 완화 */
  occlusionFrames?: number;
}

/**
 * Motion Velocity · Pose Confidence · BPM 기반 Adaptive Threshold.
 * 빠른 안무(HIPHOP) → threshold 증가 · 느린 안무(BALLET) → threshold 감소.
 */
export function computeAdaptiveMatchThreshold({
  motionVelocity = 0,
  poseConfidence = 0.8,
  bpm = 120,
  sampleFps = 30,
  occlusionFrames = 0,
}: AdaptiveThresholdInput = {}): number {
  const vel = Math.max(0, Number(motionVelocity) || 0);
  const conf = Math.min(1, Math.max(0, Number(poseConfidence) || 0.5));
  const tempo = Math.max(60, Math.min(200, Number(bpm) || 120));

  // 속도 0~3 norm/s — HIPHOP 상단 ~2.5, BALLET 하단 ~0.4
  const velocityFactor = Math.min(1, vel / 2.2);
  const tempoFactor = Math.min(1, Math.max(0, (tempo - 80) / 100));

  // 빠른 동작·높은 BPM → 임계값 상향 (관대한 매칭)
  let threshold = BASE_MATCH_COST_THRESHOLD;
  threshold += velocityFactor * 0.28;
  threshold += tempoFactor * 0.12;

  // 느린 동작 — 임계값 하향 (정밀 매칭)
  if (vel < 0.35) threshold -= 0.14;
  if (tempo < 95) threshold -= 0.06;

  // 낮은 confidence — 약간 관대
  if (conf < 0.55) threshold += 0.08;
  if (conf > 0.85) threshold -= 0.04;

  // 가려짐 후 재등장 — Kalman prediction 매칭 완화
  if (occlusionFrames > 0) {
    threshold += Math.min(0.22, occlusionFrames * 0.04);
  }

  const fpsNorm = Math.max(24, Math.min(60, Number(sampleFps) || 30));
  if (fpsNorm >= 50) threshold += 0.03;

  return Math.min(MAX_MATCH_COST_THRESHOLD, Math.max(MIN_MATCH_COST_THRESHOLD, threshold));
}

/** 두 관절 세트 간 평균 관절 속도 (정규화 좌표/초) */
export function computeJointMotionVelocity(
  prev: JointRecord | null | undefined,
  curr: JointRecord | null | undefined,
  dtSec: number,
): number {
  if (!prev || !curr || !Number.isFinite(dtSec) || dtSec <= 1e-4) return 0;

  let sum = 0;
  let count = 0;
  POSE_MATCH_JOINTS.forEach((key) => {
    const a = prev[key];
    const b = curr[key];
    if (!a || !b) return;
    if (!Number.isFinite(a.x) || !Number.isFinite(b.x)) return;
    const w = Math.min(resolveJointScore(a), resolveJointScore(b));
    if (w < 0.2) return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0));
    sum += (dist / dtSec) * w;
    count += w;
  });

  return count ? sum / count : 0;
}

/** 프레임 감지 목록 평균 confidence — joints visibility·presence·confidence 통합 */
export function averageDetectionConfidence(
  detections: Array<{ confidence?: number; joints?: JointRecord }>,
): number {
  if (!detections?.length) return 0.5;
  const scores = detections.map((d) => computeMemberPoseConfidence(d, POSE_MATCH_JOINTS));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function computeForcedMatchThreshold(adaptiveThreshold: number): number {
  return Math.min(MAX_MATCH_COST_THRESHOLD + 0.08, adaptiveThreshold + 0.22);
}
