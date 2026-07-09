// @ts-nocheck
import type { JointPoint } from '../types/groupPractice';
import type { HolisticFaceData, HolisticHandData } from '../utils/holisticLandmarkUtils';
import { seekVideoTo, getSeekableEnd } from '../utils/choreoVideoUtils';
import {
  CHOREO_MAX_OCCLUSION_SEC,
  CHOREO_MIN_PERSON_CONFIDENCE,
} from '../config/choreoExtractConfig';
import {
  applyJointConfidenceFilter,
  computeMemberPoseConfidence,
  resolveJointConfidence,
  toJointPoint,
  type MediaPipeJointInput,
} from '../utils/jointConfidenceFilter';
import { hungarianAssign, jointsPoseDistance } from './skeleton/poseSimilarity';
import { JointKalmanFilter } from './motion/JointKalmanFilter';
import { TrackMotionPredictor } from './motion/TrackMotionPredictor';
import { TrackPool } from './motion/TrackPool';
import {
  averageDetectionConfidence,
  computeAdaptiveMatchThreshold,
  computeForcedMatchThreshold,
  computeJointMotionVelocity,
} from './motion/adaptiveMatchThreshold';

export interface JointPosition extends JointPoint {
  confidence?: number;
}

export interface TrackedPerson {
  trackId: number;
  joints: Record<string, JointPosition>;
  /** MediaPipe worldLandmarks (미터 단위 3D) */
  worldJoints: Record<string, JointPosition>;
  /** Hand Landmarker 21점 (손목 매칭) */
  leftHand?: HolisticHandData;
  rightHand?: HolisticHandData;
  /** Face Landmarker 468점 (코 근접 매칭) */
  face?: HolisticFaceData;
  lastSeenTimestamp: number;
  confidence: number;
  /** 실제 감지가 아닌 가려짐 보강 데이터 */
  isEstimated?: boolean;
}

export interface DetectionFrame {
  timestamp: number;
  /** MediaPipe/재생 동기화용 ms 타임스탬프 */
  timestampMs?: number;
  /** RVFC 원본 영상 시각(초) — timestamp(30fps 그리드)와 분리 */
  sourceVideoTime?: number;
  /** 분석 당시 원본 영상 픽셀 크기 (좌표 변환용) */
  videoWidth?: number;
  videoHeight?: number;
  detectedPeople: TrackedPerson[];
}

interface PersistentTrack {
  trackId: number;
  lastKnownPosition: { x: number; y: number };
  lastSeenTimestamp: number;
  lastKnownJoints: Record<string, JointPosition>;
  lastKnownWorldJoints: Record<string, JointPosition>;
  lastKnownLeftHand?: HolisticHandData;
  lastKnownRightHand?: HolisticHandData;
  lastKnownFace?: HolisticFaceData;
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

export type { CanvasRenderConfig } from '../utils/canvasSkeletonUtils';
export { normalizedToCanvas, drawAccurateSkeleton } from '../utils/canvasSkeletonUtils';

export class MultiPersonTracker {
  private trackPool = new TrackPool(9);

  private persistentTracks = new Map<number, PersistentTrack>();

  private maxTracksSeen = 0;

  private allTrackIdsEver = new Set<number>();

  private sampleFps = 30;

  private maxMissedFrames = Math.ceil(CHOREO_MAX_OCCLUSION_SEC * 15);

  /** trackId별 Kalman — Temporal Matching 후 좌표 안정화 */
  private kalmanByTrackId = new Map<number, { joints: JointKalmanFilter; world: JointKalmanFilter }>();

  /** trackId별 Motion Prediction — 가려짐 후 재등장 매칭 */
  private predictorByTrackId = new Map<number, TrackMotionPredictor>();

  private lastFrameTimestamp = 0;

  private bpm = 120;

  /** 분석 샘플 fps에 맞춰 가려짐 허용 프레임 수 조정 */
  setSampleFps(fps: number) {
    this.sampleFps = fps || 30;
    this.maxMissedFrames = Math.ceil(CHOREO_MAX_OCCLUSION_SEC * this.sampleFps);
  }

  setBpm(bpm: number) {
    const raw = Number(bpm);
    if (Number.isFinite(raw) && raw > 0) this.bpm = raw;
  }

  /** 기대 멤버 수에 맞춰 TrackPool 슬롯 크기 조정 */
  setMaxTracks(maxTracks: number) {
    this.trackPool.setMaxSlots(Math.max(1, maxTracks));
  }

  private releaseTrack(trackId: number) {
    this.persistentTracks.delete(trackId);
    this.kalmanByTrackId.delete(trackId);
    const predictor = this.predictorByTrackId.get(trackId);
    if (predictor) {
      predictor.reset();
      this.predictorByTrackId.delete(trackId);
    }
    this.trackPool.release(trackId);
  }

  private acquireTrackId(preferred?: number): number | null {
    return this.trackPool.acquire(preferred);
  }

  private getPredictor(trackId: number) {
    let p = this.predictorByTrackId.get(trackId);
    if (!p) {
      p = new TrackMotionPredictor();
      this.predictorByTrackId.set(trackId, p);
    }
    return p;
  }

  /** Hungarian cost 기준 — 가려짐 시 Kalman 예측 포즈 우선 */
  private getMatchReferenceJoints(track: PersistentTrack, timestamp: number) {
    if (track.consecutiveMissedFrames > 0) {
      const predicted = this.getPredictor(track.trackId).predict(timestamp);
      if (Object.keys(predicted).length) {
        return predicted as Record<string, JointPosition>;
      }
    }
    return track.lastKnownJoints;
  }

  private getKalman(trackId: number) {
    let entry = this.kalmanByTrackId.get(trackId);
    if (!entry) {
      entry = { joints: new JointKalmanFilter(), world: new JointKalmanFilter() };
      this.kalmanByTrackId.set(trackId, entry);
    }
    return entry;
  }

  private smoothDetectionForTrack(
    trackId: number,
    joints: Record<string, JointPosition>,
    worldJoints: Record<string, JointPosition>,
  ) {
    const kalman = this.getKalman(trackId);
    return {
      joints: kalman.joints.smoothJoints(joints) as Record<string, JointPosition>,
      worldJoints: kalman.world.smoothJoints(worldJoints) as Record<string, JointPosition>,
    };
  }

  /** MediaPipe landmarks 배열 → 유효 인원 수 (관대한 필터) */
  countValidPoses(landmarks: unknown[] | undefined): number {
    if (!landmarks?.length) return 0;
    return landmarks.filter((lm) => {
      const joints = this.extractRawJoints(lm as unknown[]);
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
    const rawDuration = video.duration ?? getSeekableEnd(video) ?? 0;
    const duration = Number(rawDuration);
    if (!Number.isFinite(duration) || duration <= 0) return 0;

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

    if (expectedMemberCount > 0) {
      if (peak >= expectedMemberCount) return expectedMemberCount;
    }
    return mostCommon;
  }

  trackFrame(
    detectedLandmarks: unknown[],
    worldLandmarksOrTimestamp: unknown[] | number,
    timestampOrExpected?: number,
    expectedMemberCountArg = 5,
  ): TrackedPerson[] {
    let worldLandmarks: unknown[] | undefined;
    let timestamp: number;
    let expectedMemberCount: number;

    if (typeof worldLandmarksOrTimestamp === 'number') {
      timestamp = worldLandmarksOrTimestamp;
      expectedMemberCount = timestampOrExpected ?? 5;
      worldLandmarks = undefined;
    } else {
      worldLandmarks = worldLandmarksOrTimestamp;
      timestamp = timestampOrExpected as number;
      expectedMemberCount = expectedMemberCountArg;
    }

    const worldArr = worldLandmarks || [];

    this.trackPool.setMaxSlots(Math.max(expectedMemberCount, 1));

    const currentDetections = (detectedLandmarks || [])
      .map((landmarks, idx) => {
        const rawJoints = this.extractRawJoints(landmarks as unknown[]);
        const rawWorldJoints = worldArr[idx]
          ? this.extractRawWorldJoints(worldArr[idx] as unknown[])
          : {};
        const filtered = applyJointConfidenceFilter(rawJoints, rawWorldJoints);

        return {
          joints: filtered.joints,
          worldJoints: filtered.worldJoints,
          centerPos: this.calculateCenter(landmarks as unknown[]),
          confidence: 0,
        };
      })
      .map((d) => ({
        ...d,
        confidence: computeMemberPoseConfidence({ joints: d.joints, confidence: this.calculateConfidence(d.joints) }),
      }))
      .filter((d) => d.confidence > CHOREO_MIN_PERSON_CONFIDENCE);

    const matchedTrackIds = new Set<number>();
    const matchedDetectionIdx = new Set<number>();
    const result: TrackedPerson[] = [];

    const assignDetectionToTrack = (detection, trackId: number, isEstimated: boolean) => {
      matchedTrackIds.add(trackId);
      this.allTrackIdsEver.add(trackId);

      let joints = detection.joints;
      let worldJoints = detection.worldJoints;
      if (!isEstimated) {
        const smoothed = this.smoothDetectionForTrack(trackId, joints, worldJoints);
        joints = smoothed.joints;
        worldJoints = smoothed.worldJoints;
      }

      this.persistentTracks.set(trackId, {
        trackId,
        lastKnownPosition: detection.centerPos,
        lastSeenTimestamp: timestamp,
        lastKnownJoints: joints,
        lastKnownWorldJoints: worldJoints,
        lastKnownLeftHand: this.persistentTracks.get(trackId)?.lastKnownLeftHand,
        lastKnownRightHand: this.persistentTracks.get(trackId)?.lastKnownRightHand,
        lastKnownFace: this.persistentTracks.get(trackId)?.lastKnownFace,
        consecutiveMissedFrames: 0,
        isCurrentlyVisible: !isEstimated,
      });

      if (!isEstimated) {
        this.getPredictor(trackId).update(joints, timestamp);
      }

      result.push({
        trackId,
        joints,
        worldJoints,
        lastSeenTimestamp: timestamp,
        confidence: detection.confidence,
        isEstimated,
      });
    };

    // 1) Kalman Prediction → Pose Similarity → Hungarian (3단계)
    const dtSec = this.lastFrameTimestamp > 0 ? Math.max(1 / this.sampleFps, timestamp - this.lastFrameTimestamp) : 1 / this.sampleFps;
    this.lastFrameTimestamp = timestamp;

    let frameMotionVelocity = 0;
    this.persistentTracks.forEach((track) => {
      frameMotionVelocity = Math.max(frameMotionVelocity, this.getPredictor(track.trackId).averageVelocity());
    });

    const avgConfidence = averageDetectionConfidence(currentDetections);
    const baseThreshold = computeAdaptiveMatchThreshold({
      motionVelocity: frameMotionVelocity,
      poseConfidence: avgConfidence,
      bpm: this.bpm,
      sampleFps: this.sampleFps,
    });

    if (!this.persistentTracks.size) {
      currentDetections.forEach((detection) => {
        const newId = this.acquireTrackId();
        if (newId == null) return;
        assignDetectionToTrack(detection, newId, false);
      });
    } else {
      const trackEntries = [...this.persistentTracks.entries()];
      const nPrev = trackEntries.length;
      const nCurr = currentDetections.length;

      const costMatrix = Array.from({ length: nPrev }, (_, i) => {
        const [, track] = trackEntries[i];
        const refJoints = this.getMatchReferenceJoints(track, timestamp);
        const occlusionBoost = track.consecutiveMissedFrames > 0
          ? computeAdaptiveMatchThreshold({
              motionVelocity: frameMotionVelocity,
              poseConfidence: avgConfidence,
              bpm: this.bpm,
              sampleFps: this.sampleFps,
              occlusionFrames: track.consecutiveMissedFrames,
            }) - baseThreshold
          : 0;
        return Array.from({ length: nCurr }, (_, j) => {
          const raw = jointsPoseDistance(refJoints, currentDetections[j].joints);
          return Math.max(0, raw - occlusionBoost * 0.15);
        });
      });

      const assignment = hungarianAssign(costMatrix);

      assignment.forEach((currIdx, prevIdx) => {
        if (currIdx < 0 || currIdx >= nCurr) return;
        const [, track] = trackEntries[prevIdx];
        const cost = costMatrix[prevIdx]?.[currIdx] ?? Infinity;
        const threshold = computeAdaptiveMatchThreshold({
          motionVelocity: frameMotionVelocity,
          poseConfidence: avgConfidence,
          bpm: this.bpm,
          sampleFps: this.sampleFps,
          occlusionFrames: track.consecutiveMissedFrames,
        });
        if (cost > threshold) return;

        matchedDetectionIdx.add(currIdx);
        const [trackId] = trackEntries[prevIdx];
        assignDetectionToTrack(currentDetections[currIdx], trackId, false);
      });

      // 2) 가려짐 트랙 재등장 — Prediction 기반 Re-ID (새 사람 취급 방지)
      currentDetections.forEach((detection, currIdx) => {
        if (matchedDetectionIdx.has(currIdx)) return;

        let reIdTrackId: number | null = null;
        let reIdCost = Infinity;

        trackEntries.forEach(([trackId, track]) => {
          if (matchedTrackIds.has(trackId)) return;
          if (track.consecutiveMissedFrames <= 0) return;

          const predicted = this.getPredictor(trackId).predict(timestamp);
          const cost = jointsPoseDistance(predicted as Record<string, JointPosition>, detection.joints);
          const threshold = computeAdaptiveMatchThreshold({
            motionVelocity: frameMotionVelocity,
            poseConfidence: avgConfidence,
            bpm: this.bpm,
            sampleFps: this.sampleFps,
            occlusionFrames: track.consecutiveMissedFrames,
          });

          if (cost < reIdCost && cost <= threshold) {
            reIdCost = cost;
            reIdTrackId = trackId;
          }
        });

        if (reIdTrackId != null) {
          if (import.meta.env.DEV) {
            console.debug(
              `[Tracker] Kalman Re-ID trackId=${reIdTrackId} (cost=${reIdCost.toFixed(3)}, thresh adaptive)`,
            );
          }
          assignDetectionToTrack(detection, reIdTrackId, false);
          return;
        }

        if (this.trackPool.activeCount < expectedMemberCount) {
          const newId = this.acquireTrackId();
          if (newId != null) {
            assignDetectionToTrack(detection, newId, false);
          }
          return;
        }

        let forcedTrackId: number | null = null;
        let forcedCost = Infinity;
        const forcedThreshold = computeForcedMatchThreshold(baseThreshold);

        trackEntries.forEach(([trackId, track], prevIdx) => {
          if (matchedTrackIds.has(trackId)) return;
          const cost = costMatrix[prevIdx]?.[currIdx] ?? jointsPoseDistance(
            this.getMatchReferenceJoints(track, timestamp),
            detection.joints,
          );
          if (cost < forcedCost) {
            forcedCost = cost;
            forcedTrackId = trackId;
          }
        });

        if (forcedTrackId != null && forcedCost <= forcedThreshold) {
          if (import.meta.env.DEV) {
            console.debug(
              `[Tracker] trackId=${forcedTrackId} 강제 재매칭 (cost=${forcedCost.toFixed(3)}, forced=${forcedThreshold.toFixed(3)})`,
            );
          }
          assignDetectionToTrack(detection, forcedTrackId, false);
          return;
        }

        if (import.meta.env.DEV) {
          console.warn(
            `[Tracker] 감지 ${currentDetections.length}명 중 1명 슬롯 매칭 실패 (cost=${forcedCost.toFixed(3)})`,
          );
        }
      });
    }

    // 3) 미매칭 트랙 — Kalman hold (삭제 금지) · 초과 가려짐 시 TrackPool 반환
    const staleTrackIds: number[] = [];
    this.persistentTracks.forEach((track, trackId) => {
      if (matchedTrackIds.has(trackId)) return;

      track.consecutiveMissedFrames += 1;
      track.isCurrentlyVisible = false;

      if (track.consecutiveMissedFrames > this.maxMissedFrames) {
        staleTrackIds.push(trackId);
        return;
      }

      const predicted = this.getPredictor(trackId).predict(timestamp);
      const holdJoints = Object.keys(predicted).length
        ? (predicted as Record<string, JointPosition>)
        : track.lastKnownJoints;

      result.push({
        trackId,
        joints: holdJoints,
        worldJoints: track.lastKnownWorldJoints,
        leftHand: track.lastKnownLeftHand,
        rightHand: track.lastKnownRightHand,
        face: track.lastKnownFace,
        lastSeenTimestamp: track.lastSeenTimestamp,
        confidence: Math.max(0.15, 0.5 - track.consecutiveMissedFrames * 0.02),
        isEstimated: true,
      });
    });
    staleTrackIds.forEach((trackId) => {
      if (import.meta.env.DEV) {
        console.debug(`[Tracker] trackId=${trackId} TrackPool 반환 (max occlusion 초과)`);
      }
      this.releaseTrack(trackId);
    });

    this.maxTracksSeen = Math.max(
      this.maxTracksSeen,
      this.allTrackIdsEver.size,
      this.persistentTracks.size,
      result.length,
    );

    if (import.meta.env.DEV) {
      const visible = result.filter((p) => !p.isEstimated).length;
      const estimated = result.filter((p) => p.isEstimated).length;
      console.debug(
        `[Tracker] 슬롯 ${this.persistentTracks.size} (실감지 ${visible}, 보강 ${estimated}) / 기대 ${expectedMemberCount}`,
      );
    }

    return result;
  }

  /** Hand/Face 매칭 결과를 트랙에 저장하고 누락 시 마지막 known 값 유지 */
  enrichWithHolisticLandmarks(people: TrackedPerson[]): TrackedPerson[] {
    return (people || []).map((person) => {
      const track = this.persistentTracks.get(person.trackId);
      if (track && !person.isEstimated) {
        if (person.leftHand) track.lastKnownLeftHand = person.leftHand;
        if (person.rightHand) track.lastKnownRightHand = person.rightHand;
        if (person.face) track.lastKnownFace = person.face;
      }
      return {
        ...person,
        leftHand: person.leftHand ?? track?.lastKnownLeftHand,
        rightHand: person.rightHand ?? track?.lastKnownRightHand,
        face: person.face ?? track?.lastKnownFace,
      };
    });
  }

  getFinalTrackCount(): number {
    return this.allTrackIdsEver.size;
  }

  getPeakTrackCount(): number {
    return Math.max(this.maxTracksSeen, this.allTrackIdsEver.size, this.persistentTracks.size);
  }

  buildInitialPositions(frames: DetectionFrame[], sampleLimit = 60): Map<number, { x: number; y: number }> {
    const trackPositions = new Map<number, { x: number; y: number; count: number }>();

    frames.forEach((frame) => {
      frame.detectedPeople.forEach((person) => {
        if (person.isEstimated) return;
        const nose = person.joints.nose;
        if (!nose) return;
        const existing = trackPositions.get(person.trackId) || { x: 0, y: 0, count: 0 };
        if (existing.count >= sampleLimit) return;
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

  private extractRawJoints(landmarks: unknown[]): Record<string, JointPosition> {
    const joints: Record<string, JointPosition> = {};
    Object.entries(JOINT_MAP).forEach(([name, idx]) => {
      const lm = landmarks[idx] as MediaPipeJointInput | undefined;
      if (lm) {
        joints[name] = toJointPoint(lm);
      }
    });
    return joints;
  }

  private extractRawWorldJoints(worldLandmarks: unknown[]): Record<string, JointPosition> {
    const joints: Record<string, JointPosition> = {};
    Object.entries(JOINT_MAP).forEach(([name, idx]) => {
      const lm = worldLandmarks[idx] as MediaPipeJointInput | undefined;
      if (lm) {
        joints[name] = toJointPoint(lm);
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
    const coreValues = CORE_JOINTS.map((name) => joints[name]).filter(Boolean);
    if (coreValues.length >= 3) {
      const avg =
        coreValues.reduce(
          (sum, j) => sum + resolveJointConfidence(j.visibility, j.presence),
          0,
        ) / coreValues.length;
      return Math.max(0.4, avg);
    }
    const values = Object.values(joints);
    if (!values.length) return 0;
    return (
      values.reduce((sum, j) => sum + resolveJointConfidence(j.visibility, j.presence), 0)
      / values.length
    );
  }

  reset() {
    this.persistentTracks.clear();
    this.maxTracksSeen = 0;
    this.allTrackIdsEver.clear();
    this.kalmanByTrackId.clear();
    this.predictorByTrackId.clear();
    this.trackPool.reset();
    this.lastFrameTimestamp = 0;
  }
}

export default MultiPersonTracker;
