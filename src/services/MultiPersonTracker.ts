// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';
import { seekVideoTo } from '../utils/choreoVideoUtils';
import {
  CHOREO_MAX_OCCLUSION_SEC,
  CHOREO_MIN_PERSON_CONFIDENCE,
} from '../config/choreoExtractConfig';

export interface JointPosition extends JointPoint {
  confidence?: number;
}

export interface TrackedPerson {
  trackId: number;
  joints: Record<string, JointPosition>;
  lastSeenTimestamp: number;
  confidence: number;
  /** 실제 감지가 아닌 가려짐 보강 데이터 */
  isEstimated?: boolean;
}

export interface DetectionFrame {
  timestamp: number;
  detectedPeople: TrackedPerson[];
}

interface PersistentTrack {
  trackId: number;
  lastKnownPosition: { x: number; y: number };
  lastSeenTimestamp: number;
  lastKnownJoints: Record<string, JointPosition>;
  consecutiveMissedFrames: number;
  isCurrentlyVisible: boolean;
}

const JOINT_MAP: Record<string, number> = {
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

export class MultiPersonTracker {
  private nextTrackId = 0;

  private persistentTracks = new Map<number, PersistentTrack>();

  private readonly MATCH_DISTANCE_THRESHOLD = 0.2;

  private maxTracksSeen = 0;

  private allTrackIdsEver = new Set<number>();

  private sampleFps = 10;

  private maxMissedFrames = Math.ceil(CHOREO_MAX_OCCLUSION_SEC * 10);

  private readonly POSE_KEYS = [
    'left_shoulder',
    'right_shoulder',
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
  ] as const;

  /** 분석 샘플 fps에 맞춰 가려짐 허용 프레임 수 조정 */
  setSampleFps(fps: number) {
    this.sampleFps = fps || 10;
    this.maxMissedFrames = Math.ceil(CHOREO_MAX_OCCLUSION_SEC * this.sampleFps);
  }

  private poseSimilarity(
    a: Record<string, JointPosition>,
    b: Record<string, JointPosition>,
  ): number {
    let sum = 0;
    let count = 0;
    this.POSE_KEYS.forEach((key) => {
      const ja = a[key];
      const jb = b[key];
      if (!ja || !jb) return;
      sum += Math.hypot(ja.x - jb.x, ja.y - jb.y);
      count += 1;
    });
    if (!count) return 1;
    return sum / count;
  }

  private matchScore(
    detection: { centerPos: { x: number; y: number }; joints: Record<string, JointPosition> },
    trackId: number,
    lastPos: PersistentTrack,
  ): number {
    const dist = Math.hypot(
      detection.centerPos.x - lastPos.lastKnownPosition.x,
      detection.centerPos.y - lastPos.lastKnownPosition.y,
    );
    const poseDist = lastPos.lastKnownJoints
      ? this.poseSimilarity(detection.joints, lastPos.lastKnownJoints)
      : dist;
    return dist * 0.55 + poseDist * 0.45;
  }

  /** MediaPipe landmarks 배열 → 유효 인원 수 (관대한 필터) */
  countValidPoses(landmarks: unknown[] | undefined): number {
    if (!landmarks?.length) return 0;
    return landmarks.filter((lm) => {
      const joints = this.extractJoints(lm as unknown[]);
      return this.calculateConfidence(joints) > CHOREO_MIN_PERSON_CONFIDENCE;
    }).length;
  }

  async detectMemberCount(
    video: HTMLVideoElement,
    detector: { detect: (video: HTMLVideoElement) => { landmarks?: unknown[] } },
    sampleCount = 12,
    detectFrame: (
      detector: { detect: (video: HTMLVideoElement) => { landmarks?: unknown[] } },
      video: HTMLVideoElement,
    ) => { landmarks?: unknown[] } = (d, v) => d.detect(v),
    expectedMemberCount = 5,
  ): Promise<number> {
    const rawDuration = video.duration || 0;
    const duration = Math.min(Math.max(rawDuration, 10), 180);
    if (!duration) return 0;

    const counts: number[] = [];

    for (let i = 0; i < sampleCount; i += 1) {
      const t = (duration / sampleCount) * i;
      await seekVideoTo(video, t);

      const results = detectFrame(detector, video);
      const validCount = this.countValidPoses(results.landmarks as unknown[]);

      if (import.meta.env.DEV && results.landmarks?.length) {
        console.debug(
          '[진단] 프레임 인원',
          validCount,
          '/ raw',
          results.landmarks.length,
          '신뢰도',
          (results.landmarks as unknown[][]).map((lm) => {
            const joints = this.extractJoints(lm);
            return this.calculateConfidence(joints).toFixed(2);
          }),
        );
      }

      if (validCount > 0) counts.push(validCount);
    }

    if (counts.length === 0) return 0;

    const frequency: Record<number, number> = {};
    counts.forEach((c) => {
      frequency[c] = (frequency[c] || 0) + 1;
    });

    const sorted = Object.entries(frequency).sort(([, a], [, b]) => b - a);
    const mostCommon = parseInt(sorted[0][0], 10);
    const peak = Math.max(...counts);

    /** 목표 정원에 가장 가까운 값 (과소/과다 방지) */
    if (expectedMemberCount > 0) {
      if (peak >= expectedMemberCount) return expectedMemberCount;
      if (mostCommon >= expectedMemberCount - 1) return mostCommon;
    }
    return mostCommon;
  }

  trackFrame(
    detectedLandmarks: unknown[],
    timestamp: number,
    expectedMemberCount = 5,
  ): TrackedPerson[] {
    const currentDetections = (detectedLandmarks || [])
      .map((landmarks) => ({
        joints: this.extractJoints(landmarks as unknown[]),
        centerPos: this.calculateCenter(landmarks as unknown[]),
        confidence: 0,
      }))
      .map((d) => ({ ...d, confidence: this.calculateConfidence(d.joints) }))
      .filter((d) => d.confidence > CHOREO_MIN_PERSON_CONFIDENCE);

    const matchedTrackIds = new Set<number>();
    const result: TrackedPerson[] = [];

    currentDetections.forEach((detection) => {
      let bestMatchId: number | null = null;
      let bestMatchScore = Infinity;

      this.persistentTracks.forEach((track, trackId) => {
        if (matchedTrackIds.has(trackId)) return;
        const score = this.matchScore(detection, trackId, track);
        if (score < this.MATCH_DISTANCE_THRESHOLD && score < bestMatchScore) {
          bestMatchScore = score;
          bestMatchId = trackId;
        }
      });

      if (bestMatchId === null) {
        if (this.persistentTracks.size < expectedMemberCount) {
          bestMatchId = this.nextTrackId;
          this.nextTrackId += 1;
        } else {
          let oldestMissedId: number | null = null;
          let maxMissed = -1;
          this.persistentTracks.forEach((track, trackId) => {
            if (matchedTrackIds.has(trackId)) return;
            if (track.consecutiveMissedFrames > maxMissed) {
              maxMissed = track.consecutiveMissedFrames;
              oldestMissedId = trackId;
            }
          });
          bestMatchId = oldestMissedId ?? this.nextTrackId;
          if (oldestMissedId === null) {
            this.nextTrackId += 1;
          }
        }
      }

      matchedTrackIds.add(bestMatchId);
      this.allTrackIdsEver.add(bestMatchId);

      this.persistentTracks.set(bestMatchId, {
        trackId: bestMatchId,
        lastKnownPosition: detection.centerPos,
        lastSeenTimestamp: timestamp,
        lastKnownJoints: detection.joints,
        consecutiveMissedFrames: 0,
        isCurrentlyVisible: true,
      });

      result.push({
        trackId: bestMatchId,
        joints: detection.joints,
        lastSeenTimestamp: timestamp,
        confidence: detection.confidence,
        isEstimated: false,
      });
    });

    this.persistentTracks.forEach((track, trackId) => {
      if (matchedTrackIds.has(trackId)) return;

      track.consecutiveMissedFrames += 1;
      track.isCurrentlyVisible = false;

      if (track.consecutiveMissedFrames > this.maxMissedFrames) {
        this.persistentTracks.delete(trackId);
        return;
      }

      result.push({
        trackId,
        joints: track.lastKnownJoints,
        lastSeenTimestamp: track.lastSeenTimestamp,
        confidence: 0.2,
        isEstimated: true,
      });
    });

    this.maxTracksSeen = Math.max(this.maxTracksSeen, this.allTrackIdsEver.size, result.length);

    return result;
  }

  getFinalTrackCount(): number {
    return this.allTrackIdsEver.size;
  }

  getPeakTrackCount(): number {
    return Math.max(this.maxTracksSeen, this.allTrackIdsEver.size);
  }

  buildInitialPositions(frames: DetectionFrame[], sampleLimit = 30): Map<number, { x: number; y: number }> {
    const trackPositions = new Map<number, { x: number; y: number; count: number }>();

    frames.slice(0, Math.min(sampleLimit, frames.length)).forEach((frame) => {
      frame.detectedPeople.forEach((person) => {
        if (person.isEstimated) return;
        const nose = person.joints.nose;
        if (!nose) return;
        const existing = trackPositions.get(person.trackId) || { x: 0, y: 0, count: 0 };
        trackPositions.set(person.trackId, {
          x: existing.x + nose.x,
          y: existing.y + nose.y,
          count: existing.count + 1,
        });
      });
    });

    const result = new Map<number, { x: number; y: number }>();
    trackPositions.forEach((val, trackId) => {
      result.set(trackId, { x: val.x / val.count, y: val.y / val.count });
    });
    return result;
  }

  private extractJoints(landmarks: unknown[]): Record<string, JointPosition> {
    const joints: Record<string, JointPosition> = {};
    Object.entries(JOINT_MAP).forEach(([name, idx]) => {
      const lm = landmarks[idx] as { x?: number; y?: number; z?: number; visibility?: number } | undefined;
      if (lm) {
        joints[name] = {
          x: lm.x ?? 0,
          y: lm.y ?? 0,
          z: lm.z ?? 0,
          visibility: lm.visibility,
          confidence: lm.visibility ?? 0,
        };
      }
    });
    return joints;
  }

  private calculateCenter(landmarks: unknown[]): { x: number; y: number } {
    const lm = landmarks as Array<{ x?: number; y?: number } | undefined>;
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const leftHip = lm[23];
    const rightHip = lm[24];
    const points = [leftShoulder, rightShoulder, leftHip, rightHip].filter(Boolean) as Array<{
      x: number;
      y: number;
    }>;
    if (!points.length) return { x: 0.5, y: 0.5 };
    const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x: avgX, y: avgY };
  }

  /** 상체 핵심 관절 기준 — 화면 가장자리 부분 가림 허용 */
  private calculateConfidence(joints: Record<string, JointPosition>): number {
    const coreValues = CORE_JOINTS.map((name) => joints[name]).filter(Boolean);
    if (coreValues.length >= 3) {
      const avg =
        coreValues.reduce((sum, j) => sum + (j.confidence ?? j.visibility ?? 0), 0) / coreValues.length;
      return Math.max(0.4, avg);
    }
    const values = Object.values(joints);
    if (!values.length) return 0;
    return values.reduce((sum, j) => sum + (j.confidence ?? j.visibility ?? 0), 0) / values.length;
  }

  reset() {
    this.nextTrackId = 0;
    this.persistentTracks.clear();
    this.maxTracksSeen = 0;
    this.allTrackIdsEver.clear();
  }
}

export default MultiPersonTracker;
