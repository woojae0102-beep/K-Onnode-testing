// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';
import { seekVideoTo } from '../utils/choreoVideoUtils';

export interface JointPosition extends JointPoint {
  confidence?: number;
}

export interface TrackedPerson {
  trackId: number;
  joints: Record<string, JointPosition>;
  lastSeenTimestamp: number;
  confidence: number;
}

export interface DetectionFrame {
  timestamp: number;
  detectedPeople: TrackedPerson[];
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

export class MultiPersonTracker {
  private nextTrackId = 0;

  private activeTracksLastPosition = new Map<
    number,
    { x: number; y: number; lastSeen: number; lastJoints?: Record<string, JointPosition> }
  >();

  private readonly MAX_OCCLUSION_TIME = 0.5;

  private readonly MATCH_DISTANCE_THRESHOLD = 0.15;

  private readonly POSE_KEYS = [
    'left_shoulder',
    'right_shoulder',
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
  ] as const;

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
    lastPos: { x: number; y: number; lastJoints?: Record<string, JointPosition> },
  ): number {
    const dist = Math.hypot(detection.centerPos.x - lastPos.x, detection.centerPos.y - lastPos.y);
    const poseDist = lastPos.lastJoints
      ? this.poseSimilarity(detection.joints, lastPos.lastJoints)
      : dist;
    return dist * 0.55 + poseDist * 0.45;
  }

  async detectMemberCount(
    video: HTMLVideoElement,
    detector: { detectForVideo: (video: HTMLVideoElement, ms: number) => { landmarks?: unknown[] } },
    sampleCount = 20,
  ): Promise<number> {
    const duration = video.duration || 0;
    if (!duration) return 0;

    const counts: number[] = [];

    for (let i = 0; i < sampleCount; i += 1) {
      const t = (duration / sampleCount) * i;
      await seekVideoTo(video, t);

      const results = detector.detectForVideo(video, t * 1000);
      const validCount =
        results.landmarks?.filter((lm: unknown[]) => {
          if (!Array.isArray(lm) || !lm.length) return false;
          const avgVisibility =
            lm.reduce((sum: number, j: { visibility?: number }) => sum + (j?.visibility || 0), 0) /
            lm.length;
          return avgVisibility > 0.5;
        }).length || 0;

      if (validCount > 0) counts.push(validCount);
    }

    if (counts.length === 0) return 0;

    const frequency: Record<number, number> = {};
    counts.forEach((c) => {
      frequency[c] = (frequency[c] || 0) + 1;
    });

    const mostCommon = Object.entries(frequency).sort(([, a], [, b]) => b - a)[0];
    return parseInt(mostCommon[0], 10);
  }

  trackFrame(detectedLandmarks: unknown[], timestamp: number): TrackedPerson[] {
    const currentDetections = (detectedLandmarks || []).map((landmarks) => ({
      joints: this.extractJoints(landmarks as unknown[]),
      centerPos: this.calculateCenter(landmarks as unknown[]),
    }));

    const trackedPeople: TrackedPerson[] = [];
    const usedTrackIds = new Set<number>();

    currentDetections.forEach((detection) => {
      let bestMatchId: number | null = null;
      let bestMatchScore = Infinity;

      this.activeTracksLastPosition.forEach((lastPos, trackId) => {
        if (usedTrackIds.has(trackId)) return;
        if (timestamp - lastPos.lastSeen > this.MAX_OCCLUSION_TIME) return;

        const score = this.matchScore(detection, trackId, lastPos);
        if (score < this.MATCH_DISTANCE_THRESHOLD && score < bestMatchScore) {
          bestMatchScore = score;
          bestMatchId = trackId;
        }
      });

      const trackId = bestMatchId !== null ? bestMatchId : this.nextTrackId;
      if (bestMatchId === null) this.nextTrackId += 1;
      usedTrackIds.add(trackId);

      this.activeTracksLastPosition.set(trackId, {
        x: detection.centerPos.x,
        y: detection.centerPos.y,
        lastSeen: timestamp,
        lastJoints: detection.joints,
      });

      trackedPeople.push({
        trackId,
        joints: detection.joints,
        lastSeenTimestamp: timestamp,
        confidence: this.calculateConfidence(detection.joints),
      });
    });

    return trackedPeople;
  }

  buildInitialPositions(frames: DetectionFrame[], sampleLimit = 30): Map<number, { x: number; y: number }> {
    const trackPositions = new Map<number, { x: number; y: number; count: number }>();

    frames.slice(0, Math.min(sampleLimit, frames.length)).forEach((frame) => {
      frame.detectedPeople.forEach((person) => {
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

  private calculateConfidence(joints: Record<string, JointPosition>): number {
    const values = Object.values(joints);
    if (!values.length) return 0;
    return values.reduce((sum, j) => sum + (j.confidence ?? j.visibility ?? 0), 0) / values.length;
  }

  reset() {
    this.nextTrackId = 0;
    this.activeTracksLastPosition.clear();
  }
}

export default MultiPersonTracker;
