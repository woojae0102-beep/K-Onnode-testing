// @ts-nocheck
/**
 * TrackID 풀 — 프레임마다 새 ID를 발급하지 않고 해제된 슬롯을 재사용.
 * Frame200 Track9 → Frame201 매칭 실패 → Track10 증가 방지.
 */
export class TrackPool {
  private active = new Set<number>();

  private released: number[] = [];

  private nextId = 0;

  private maxSlots: number;

  constructor(maxSlots = 9) {
    this.maxSlots = Math.max(1, maxSlots);
  }

  setMaxSlots(maxSlots: number) {
    this.maxSlots = Math.max(1, maxSlots);
  }

  /** 활성 슬롯 수 */
  get activeCount(): number {
    return this.active.size;
  }

  /** 풀에서 trackId 획득 — 해제된 ID 우선 재사용 */
  acquire(preferred?: number): number | null {
    if (preferred != null && Number.isFinite(preferred) && preferred >= 0 && !this.active.has(preferred)) {
      this.active.add(preferred);
      this.released = this.released.filter((id) => id !== preferred);
      return preferred;
    }

    if (this.released.length) {
      this.released.sort((a, b) => a - b);
      const id = this.released.shift()!;
      this.active.add(id);
      return id;
    }

    let candidate = this.nextId;
    while (candidate < this.maxSlots) {
      if (!this.active.has(candidate)) {
        this.active.add(candidate);
        this.nextId = Math.max(this.nextId, candidate + 1);
        return candidate;
      }
      candidate += 1;
    }

    return null;
  }

  /** 트랙 종료 시 ID 반환 — 이후 acquire에서 재사용 */
  release(trackId: number) {
    if (!Number.isFinite(trackId) || trackId < 0) return;
    if (!this.active.has(trackId)) return;
    this.active.delete(trackId);
    if (!this.released.includes(trackId)) {
      this.released.push(trackId);
    }
  }

  isActive(trackId: number): boolean {
    return this.active.has(trackId);
  }

  reset() {
    this.active.clear();
    this.released = [];
    this.nextId = 0;
  }
}

export default TrackPool;
