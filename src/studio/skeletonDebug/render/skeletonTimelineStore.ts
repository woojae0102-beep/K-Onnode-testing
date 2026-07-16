// @ts-nocheck
/**
 * Skeleton Timeline Store — 분석 완료 후 저장된 SkeletonFrame[] 전용.
 */
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonPlaybackMode } from './skeletonPlaybackEngine';
import {
  buildSkeletonTimeline,
  type PlaybackRenderStatus,
  type SkeletonTimeline,
} from './skeletonPlaybackEngine';

export type PlaybackMetrics = {
  renderFps: number;
  renderFrameTimeMs: number;
  playbackTime: number;
  videoTime: number;
  previousFrameTime: number;
  nextFrameTime: number;
  interpolationAlpha: number;
  frameGapSec: number;
  renderStatus: PlaybackRenderStatus;
  skeletonDataFps: number;
  videoFps: number;
  playbackSource: 'STORED_SKELETON_TIMELINE' | 'NONE';
  playbackMode: SkeletonPlaybackMode;
  timelineFrameCount: number;
  maxGapSec: number;
  timelineValid: boolean;
};

const EMPTY_METRICS: PlaybackMetrics = {
  renderFps: 0,
  renderFrameTimeMs: 0,
  playbackTime: 0,
  videoTime: 0,
  previousFrameTime: 0,
  nextFrameTime: 0,
  interpolationAlpha: 0,
  frameGapSec: 0,
  renderStatus: 'NO_DATA',
  skeletonDataFps: 0,
  videoFps: 0,
  playbackSource: 'NONE',
  playbackMode: 'ANALYZING',
  timelineFrameCount: 0,
  maxGapSec: 0,
  timelineValid: false,
};

export class SkeletonTimelineStore {
  private timeline: SkeletonTimeline | null = null;
  private timelineFrames: DetectionFrame[] = [];
  private metrics: PlaybackMetrics = { ...EMPTY_METRICS };
  private _videoWidth = 1280;
  private _videoHeight = 720;
  private _sampleFps = 5;

  get videoWidth() { return this._videoWidth; }
  get videoHeight() { return this._videoHeight; }
  get sampleFps() { return this._sampleFps; }
  getTimeline(): SkeletonTimeline | null { return this.timeline; }
  getMetrics(): PlaybackMetrics { return { ...this.metrics }; }

  reset(): void {
    this.timeline = null;
    this.timelineFrames = [];
    this.metrics = { ...EMPTY_METRICS };
    this._videoWidth = 1280;
    this._videoHeight = 720;
  }

  /** 분석 완료 후 전체 timeline 로드 — live append 금지 */
  loadTimeline(frames: DetectionFrame[], sampleFps: number): void {
    this.reset();
    this._sampleFps = Math.max(1, sampleFps);
    this.timelineFrames = [...frames];
    this.timeline = buildSkeletonTimeline(frames, this._sampleFps);

    const last = frames[frames.length - 1];
    if (last?.videoWidth) this._videoWidth = last.videoWidth;
    if (last?.videoHeight) this._videoHeight = last.videoHeight;
  }

  getFrame(index: number): DetectionFrame | null {
    return this.timelineFrames[index] ?? null;
  }

  getFrames(): readonly DetectionFrame[] {
    return this.timelineFrames;
  }

  get frameCount() {
    return this.timelineFrames.length;
  }

  recordPlaybackTick(opts: {
    frameTimeMs: number;
    playbackTime: number;
    videoTime: number;
    videoFps: number;
    playbackMode: SkeletonPlaybackMode;
    renderStatus: PlaybackRenderStatus;
    previousFrameTime: number;
    nextFrameTime: number;
    interpolationAlpha: number;
    frameGapSec: number;
    skeletonDataFps: number;
    playbackSource: 'STORED_SKELETON_TIMELINE' | 'NONE';
  }): void {
    const m = this.metrics;
    m.renderFrameTimeMs = m.renderFrameTimeMs > 0
      ? m.renderFrameTimeMs * 0.9 + opts.frameTimeMs * 0.1
      : opts.frameTimeMs;
    m.playbackTime = opts.playbackTime;
    m.videoTime = opts.videoTime;
    m.previousFrameTime = opts.previousFrameTime;
    m.nextFrameTime = opts.nextFrameTime;
    m.interpolationAlpha = opts.interpolationAlpha;
    m.frameGapSec = opts.frameGapSec;
    m.renderStatus = opts.renderStatus;
    m.skeletonDataFps = opts.skeletonDataFps;
    m.videoFps = opts.videoFps;
    m.playbackSource = opts.playbackSource;
    m.playbackMode = opts.playbackMode;
    m.timelineFrameCount = this.timeline?.frames.length ?? 0;
    m.maxGapSec = this.timeline?.maxGapSec ?? 0;
    m.timelineValid = this.timeline?.isValid ?? false;
    if (opts.frameTimeMs > 0) {
      const instantFps = 1000 / opts.frameTimeMs;
      m.renderFps = m.renderFps > 0 ? m.renderFps * 0.92 + instantFps * 0.08 : instantFps;
    }
  }
}

export function createSkeletonTimelineStore(): SkeletonTimelineStore {
  return new SkeletonTimelineStore();
}
