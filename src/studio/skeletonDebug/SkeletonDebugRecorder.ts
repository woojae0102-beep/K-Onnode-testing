// @ts-nocheck
import type { MotionExtractionDebugState } from '../../types/motionExtraction';
import type { DetectionFrame } from '../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from './types';

/**
 * 추출 중 onDebug / onFrameDetected 패치를 프레임별로 누적한다.
 * 파이프라인 동작은 변경하지 않으며, Studio에서만 인스턴스를 생성해 전달한다.
 */
export class SkeletonDebugRecorder {
  private debugByFrame = new Map<number, Partial<MotionExtractionDebugState>>();
  private frameDetectedByFrame = new Map<number, Record<string, unknown>>();
  private processingTimes: number[] = [];
  private lastDebug: Partial<MotionExtractionDebugState> = {};

  recordDebug(patch: Partial<MotionExtractionDebugState>): void {
    this.lastDebug = { ...this.lastDebug, ...patch };
    const idx = patch.frameIndex ?? patch.timelineFrameIndex;
    if (idx == null || !Number.isFinite(idx)) return;
    const frameIndex = Math.floor(idx);
    const prev = this.debugByFrame.get(frameIndex) || {};
    this.debugByFrame.set(frameIndex, { ...prev, ...patch, frameIndex });
    if (patch.processingDelay != null && patch.processingDelay > 0) {
      this.processingTimes.push(patch.processingDelay);
    }
  }

  recordFrameDetected(payload: Record<string, unknown>): void {
    const idx = payload.frameIndex ?? this.lastDebug.frameIndex;
    if (idx == null || !Number.isFinite(idx)) return;
    this.frameDetectedByFrame.set(Math.floor(idx as number), payload);
  }

  getAverageProcessingTimeMs(): number {
    if (!this.processingTimes.length) return 0;
    return this.processingTimes.reduce((s, v) => s + v, 0) / this.processingTimes.length;
  }

  getLastDebug(): Partial<MotionExtractionDebugState> {
    return { ...this.lastDebug };
  }

  /** AnalysisResult.frames와 병합해 완전한 프레임 통계 배열 생성 */
  buildFrameStats(frames: DetectionFrame[]): SkeletonDebugFrameStat[] {
    return frames.map((frame, frameIndex) => {
      const debug = this.debugByFrame.get(frameIndex) || {};
      const detected = frame.detectedPeople?.filter((p) => !p.isEstimated).length ?? 0;
      const tracked = frame.detectedPeople?.length ?? 0;
      const estimated = frame.detectedPeople?.filter((p) => p.isEstimated).length ?? 0;
      const confidences = (frame.detectedPeople || [])
        .map((p) => p.confidence)
        .filter((c) => Number.isFinite(c));
      const avgConf = confidences.length
        ? confidences.reduce((s, c) => s + c, 0) / confidences.length
        : (debug.avgConfidence ?? 0);

      return {
        frameIndex,
        timestamp: frame.timestamp ?? debug.timestamp ?? frameIndex / 30,
        sourceVideoTime: frame.sourceVideoTime ?? debug.sourceVideoTime ?? frame.timestamp ?? 0,
        detected: debug.rawPoseCount ?? detected,
        tracked: debug.trackedCount ?? tracked,
        visible: debug.visibleCount ?? detected,
        estimated: debug.estimatedCount ?? estimated,
        confidence: avgConf,
        coverage: debug.coverage ?? 0,
        processingMs: debug.processingDelay ?? 0,
        queueLength: debug.queueLength ?? 0,
        droppedFrames: debug.droppedFrames ?? 0,
        mediaPipeDelayMs: debug.mediaPipeDelay ?? 0,
        workerQueue: debug.workerQueue ?? 0,
        poseQuality: debug.poseQuality ?? null,
        trackingIds: debug.trackingIds ?? frame.detectedPeople?.map((p) => p.trackId) ?? [],
        pipelineStage: debug.pipelineStage ?? 'frame_detect',
      };
    });
  }

  reset(): void {
    this.debugByFrame.clear();
    this.frameDetectedByFrame.clear();
    this.processingTimes = [];
    this.lastDebug = {};
  }
}

export default SkeletonDebugRecorder;
