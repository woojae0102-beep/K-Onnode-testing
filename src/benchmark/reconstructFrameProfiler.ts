// @ts-nocheck
/**
 * reconstructFrame() 전용 프로파일러 — __RECONSTRUCT_FRAME_PROFILE__ 활성 시에만 계측.
 */

export type ProfileStep =
  | 'memberMatching'
  | 'hungarianMatching'
  | 'formation'
  | 'missingMemberFill'
  | 'poseMerge'
  | 'timeline'
  | 'finalSkeleton'
  | 'trackingTotal'
  | 'generateAI';

export type FrameProfileRow = {
  frameIndex: number;
  timestamp: number;
  totalMs: number;
  memberMatchingMs: number;
  hungarianMatchingMs: number;
  formationMs: number;
  missingMemberFillMs: number;
  poseMergeMs: number;
  timelineMs: number;
  finalSkeletonMs: number;
  trackingTotalMs: number;
  membersOutBytes: number;
  timelineOutBytes: number;
  finalOutBytes: number;
  heapBytes: number | null;
};

export type FunctionTiming = {
  name: string;
  totalMs: number;
  calls: number;
  avgMs: number;
};

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function isProfileEnabled(): boolean {
  return typeof globalThis !== 'undefined' && globalThis.__RECONSTRUCT_FRAME_PROFILE__ === true;
}

export function jsonByteSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    if (textEncoder) return textEncoder.encode(json).byteLength;
    return json.length;
  } catch {
    return -1;
  }
}

export function readHeapBytes(): number | null {
  const perf = typeof performance !== 'undefined' ? performance : null;
  const mem = perf ? (perf as { memory?: { usedJSHeapSize?: number } }).memory : null;
  return mem && Number.isFinite(mem.usedJSHeapSize) ? mem.usedJSHeapSize : null;
}

class ReconstructFrameProfiler {
  frameRows: FrameProfileRow[] = [];

  functionTimings = new Map<string, { totalMs: number; calls: number }>();

  currentFrame: Partial<FrameProfileRow> | null = null;

  stepStack: { step: ProfileStep; t0: number }[] = [];

  hungarianMsThisFrame = 0;

  reset() {
    this.frameRows = [];
    this.functionTimings.clear();
    this.currentFrame = null;
    this.stepStack = [];
    this.hungarianMsThisFrame = 0;
  }

  beginFrame(frameIndex: number, timestamp: number) {
    this.currentFrame = {
      frameIndex,
      timestamp,
      totalMs: 0,
      memberMatchingMs: 0,
      hungarianMatchingMs: 0,
      formationMs: 0,
      missingMemberFillMs: 0,
      poseMergeMs: 0,
      timelineMs: 0,
      finalSkeletonMs: 0,
      trackingTotalMs: 0,
      membersOutBytes: 0,
      timelineOutBytes: 0,
      finalOutBytes: 0,
      heapBytes: readHeapBytes(),
    };
    this.hungarianMsThisFrame = 0;
  }

  beginStep(step: ProfileStep) {
    if (!this.currentFrame) return;
    this.stepStack.push({ step, t0: performance.now() });
  }

  endStep(step: ProfileStep) {
    if (!this.currentFrame || !this.stepStack.length) return;
    const top = this.stepStack[this.stepStack.length - 1];
    if (top.step !== step) return;
    this.stepStack.pop();
    const ms = performance.now() - top.t0;
    const key = `${step}Ms` as keyof FrameProfileRow;
    if (key in this.currentFrame && typeof this.currentFrame[key] === 'number') {
      (this.currentFrame[key] as number) += ms;
    }
    this.recordFunction(step, ms);
  }

  addHungarianMs(ms: number) {
    if (!this.currentFrame) return;
    this.currentFrame.hungarianMatchingMs = (this.currentFrame.hungarianMatchingMs || 0) + ms;
    this.hungarianMsThisFrame += ms;
    this.recordFunction('hungarianAssign', ms);
  }

  recordFunction(name: string, ms: number) {
    const prev = this.functionTimings.get(name) || { totalMs: 0, calls: 0 };
    prev.totalMs += ms;
    prev.calls += 1;
    this.functionTimings.set(name, prev);
  }

  setOutputBytes(kind: 'members' | 'timeline' | 'final', bytes: number) {
    if (!this.currentFrame) return;
    if (kind === 'members') this.currentFrame.membersOutBytes = bytes;
    if (kind === 'timeline') this.currentFrame.timelineOutBytes = bytes;
    if (kind === 'final') this.currentFrame.finalOutBytes = bytes;
  }

  endFrame(totalMs: number) {
    if (!this.currentFrame) return;
    this.currentFrame.totalMs = totalMs;
    this.currentFrame.heapBytes = readHeapBytes();
    this.frameRows.push(this.currentFrame as FrameProfileRow);
    this.currentFrame = null;
  }

  getTopFunctions(limit = 10): FunctionTiming[] {
    return [...this.functionTimings.entries()]
      .map(([name, v]) => ({
        name,
        totalMs: v.totalMs,
        calls: v.calls,
        avgMs: v.calls ? v.totalMs / v.calls : 0,
      }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, limit);
  }
}

export const reconstructFrameProfiler = new ReconstructFrameProfiler();

export function profileBeginFrame(frameIndex: number, timestamp: number) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.beginFrame(frameIndex, timestamp);
}

export function profileEndFrame(totalMs: number) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.endFrame(totalMs);
}

export function profileStep(step: ProfileStep, fn: () => unknown) {
  if (!isProfileEnabled()) return fn();
  reconstructFrameProfiler.beginStep(step);
  try {
    return fn();
  } finally {
    reconstructFrameProfiler.endStep(step);
  }
}

export async function profileStepAsync(step: ProfileStep, fn: () => Promise<unknown>) {
  if (!isProfileEnabled()) return fn();
  reconstructFrameProfiler.beginStep(step);
  try {
    return await fn();
  } finally {
    reconstructFrameProfiler.endStep(step);
  }
}

export function profileRecordBytes(kind: 'members' | 'timeline' | 'final', value: unknown) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.setOutputBytes(kind, jsonByteSize(value));
}

export function profileRecordFunction(name: string, ms: number) {
  if (!isProfileEnabled()) return;
  reconstructFrameProfiler.recordFunction(name, ms);
}
