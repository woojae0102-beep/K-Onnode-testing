// @ts-nocheck
import { POSE_MATCH_JOINTS } from '../skeleton/poseSimilarity';

type JointRecord = Record<string, { x?: number; y?: number; z?: number; visibility?: number; confidence?: number }>;

/** 관절별 Constant-Velocity Kalman — Motion Prediction */
class JointCVPredictor {
  private x = 0;
  private y = 0;
  private z = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private lastT = 0;
  private initialized = false;

  update(j: { x: number; y: number; z?: number }, t: number) {
    if (this.initialized && this.lastT > 0) {
      const dt = Math.max(1e-4, t - this.lastT);
      const ax = (j.x - this.x) / dt;
      const ay = (j.y - this.y) / dt;
      const az = ((j.z ?? 0) - this.z) / dt;
      this.vx = this.vx * 0.65 + ax * 0.35;
      this.vy = this.vy * 0.65 + ay * 0.35;
      this.vz = this.vz * 0.65 + az * 0.35;
    }
    this.x = j.x;
    this.y = j.y;
    this.z = j.z ?? 0;
    this.lastT = t;
    this.initialized = true;
  }

  predict(t: number): { x: number; y: number; z: number } {
    if (!this.initialized) return { x: this.x, y: this.y, z: this.z };
    const dt = Math.max(0, t - this.lastT);
    return {
      x: this.x + this.vx * dt,
      y: this.y + this.vy * dt,
      z: this.z + this.vz * dt,
    };
  }

  velocity(): number {
    return Math.hypot(this.vx, this.vy, this.vz);
  }

  reset() {
    this.initialized = false;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.lastT = 0;
  }
}

/**
 * 트랙별 Motion Prediction — Hungarian 매칭 전 예측 포즈 제공.
 * Frame100 → Frame101(가려짐) → Frame102 재등장 시 동일 trackId 유지.
 */
export class TrackMotionPredictor {
  private joints = new Map<string, JointCVPredictor>();

  private getJoint(name: string) {
    let j = this.joints.get(name);
    if (!j) {
      j = new JointCVPredictor();
      this.joints.set(name, j);
    }
    return j;
  }

  update(joints: JointRecord, timestamp: number) {
    if (!joints) return;
    POSE_MATCH_JOINTS.forEach((name) => {
      const j = joints[name];
      if (
        !j ||
        !Number.isFinite(j.x) ||
        !Number.isFinite(j.y) ||
        (j.z != null && !Number.isFinite(j.z))
      ) return;
      this.getJoint(name).update({ x: j.x, y: j.y, z: j.z ?? 0 }, timestamp);
    });
  }

  predict(timestamp: number): JointRecord {
    const out: JointRecord = {};
    POSE_MATCH_JOINTS.forEach((name) => {
      const pred = this.getJoint(name).predict(timestamp);
      out[name] = { x: pred.x, y: pred.y, z: pred.z, confidence: 0.55 };
    });
    return out;
  }

  /** 관절 평균 속도 (정규화/초) */
  averageVelocity(): number {
    const vels = POSE_MATCH_JOINTS.map((name) => this.getJoint(name).velocity()).filter((v) => v > 0);
    if (!vels.length) return 0;
    return vels.reduce((a, b) => a + b, 0) / vels.length;
  }

  reset() {
    this.joints.forEach((j) => j.reset());
    this.joints.clear();
  }
}

export default TrackMotionPredictor;
