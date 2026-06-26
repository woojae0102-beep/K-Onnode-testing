// @ts-nocheck
import type { SkeletonFrameData } from '../../types/groupPractice';

/** 1D Kalman — GPU 불필요, 관절 좌표 스무딩용 */
class Kalman1D {
  private x = 0;
  private p = 1;
  private initialized = false;

  constructor(
    private q = 0.008,
    private r = 0.12,
  ) {}

  filter(measurement: number): number {
    if (!this.initialized) {
      this.x = measurement;
      this.initialized = true;
      return measurement;
    }
    this.p += this.q;
    const k = this.p / (this.p + this.r);
    this.x += k * (measurement - this.x);
    this.p *= 1 - k;
    return this.x;
  }

  reset() {
    this.initialized = false;
    this.p = 1;
  }
}

type JointRecord = Record<string, { x: number; y: number; z?: number; visibility?: number }>;

/** 멤버별 관절 칼만 필터 (오프라인 시퀀스 / 실시간 공용) */
export class JointKalmanFilter {
  private jointFilters = new Map<string, { x: Kalman1D; y: Kalman1D; z: Kalman1D }>();

  private getFilters(jointName: string) {
    let f = this.jointFilters.get(jointName);
    if (!f) {
      f = { x: new Kalman1D(), y: new Kalman1D(), z: new Kalman1D(0.008, 0.15) };
      this.jointFilters.set(jointName, f);
    }
    return f;
  }

  smoothJoints(joints: JointRecord | null): JointRecord {
    if (!joints) return {};
    const out: JointRecord = {};
    Object.entries(joints).forEach(([name, j]) => {
      if (!j) return;
      const f = this.getFilters(name);
      out[name] = {
        x: f.x.filter(j.x),
        y: f.y.filter(j.y),
        z: f.z.filter(j.z ?? 0),
        visibility: j.visibility,
      };
    });
    return out;
  }

  reset() {
    this.jointFilters.forEach((f) => {
      f.x.reset();
      f.y.reset();
      f.z.reset();
    });
    this.jointFilters.clear();
  }
}

/** 추출된 스켈레톤 시퀀스 전체 스무딩 (브라우저 내, Web Worker 불필요) */
export function smoothSkeletonFrames(frames: SkeletonFrameData[]): SkeletonFrameData[] {
  if (!frames?.length) return frames;

  const filtersByMember = new Map<string, JointKalmanFilter>();

  return frames.map((frame) => ({
    ...frame,
    members: frame.members.map((member) => {
      let filter = filtersByMember.get(member.estimatedMemberId);
      if (!filter) {
        filter = new JointKalmanFilter();
        filtersByMember.set(member.estimatedMemberId, filter);
      }
      return {
        ...member,
        joints: filter.smoothJoints(member.joints),
      };
    }),
  }));
}

export default JointKalmanFilter;
