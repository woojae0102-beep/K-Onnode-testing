// @ts-nocheck

export interface PracticeTimeline {
  /** HTMLVideoElement.duration (초) */
  duration: number;
  /** 샘플 FPS */
  fps: number;
  /** duration × fps — 타임라인 프레임 수 */
  totalFrames: number;
}

/**
 * 연습 타임라인: Video.duration → FPS → Frame
 * lastFrameTimestamp / song.duration / 180 폴백 사용 금지.
 */
export function computePracticeTimeline(
  videoDurationSec: number | null | undefined,
  fps: number | null | undefined,
): PracticeTimeline | null {
  const duration = Number(videoDurationSec);
  const sampleFps = Number(fps);

  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!Number.isFinite(sampleFps) || sampleFps <= 0) return null;

  const totalFrames = Math.max(1, Math.round(duration * sampleFps));
  return { duration, fps: sampleFps, totalFrames };
}

/** 프레임 인덱스 → 타임라인 시각(초) */
export function frameIndexToTimeSec(frameIndex: number, fps: number): number {
  const idx = Number(frameIndex);
  const rate = Number(fps);
  if (!Number.isFinite(idx) || idx < 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return idx / rate;
}

/** 타임라인 시각(초) → 프레임 인덱스 */
export function timeSecToFrameIndex(timeSec: number, fps: number, totalFrames: number): number {
  const t = Number(timeSec);
  const rate = Number(fps);
  const maxIdx = Math.max(0, Number(totalFrames) - 1);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.min(maxIdx, Math.max(0, Math.round(t * rate)));
}

export function practiceTimelineFrameCountMatches(
  timeline: PracticeTimeline | null | undefined,
  totalFrames: number,
): boolean {
  if (!timeline) return false;
  return timeline.totalFrames === totalFrames;
}

/**
 * 추출 프레임 timestamp를 FPS 그리드에 맞춤: frameIndex / fps
 * (Video.duration → FPS → Frame — 프레임 시각은 인덱스 기반)
 */
export function normalizeFrameTimestampsToFpsGrid(
  frames: import('../types/groupPractice').SkeletonFrameData[],
  fps: number,
): import('../types/groupPractice').SkeletonFrameData[] {
  const rate = Number(fps);
  if (!frames?.length || !Number.isFinite(rate) || rate <= 0) return frames ?? [];

  return frames.map((frame, frameIndex) => ({
    ...frame,
    frameIndex,
    timestamp: frameIndex / rate,
    timestampMs: Math.round((frameIndex / rate) * 1000),
  }));
}

export default computePracticeTimeline;
