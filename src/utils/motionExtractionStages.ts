// @ts-nocheck
/**
 * Motion Extraction Pipeline Stages — Frame → MediaPipe → Tracking → Worker/DanceDatabase
 * 각 Stage는 asyncPipelineQueue로 독립 큐·Backpressure·지연 계측을 가진다.
 */
import { createPipelineStage } from './asyncPipelineQueue';
import { associateHolisticLandmarksToPeople } from './holisticLandmarkUtils';
import { timeSecToBeat, timeSecToBeatIndex } from './frameMetadataUtils';
import {
  estimateBytesPerSkeletonFrame,
  estimateCanvasPoolMemoryBytes,
  estimateFrameBufferMemoryBytes,
  bytesToMb,
} from './memoryProfiler';
import { pipelineEventBus } from './pipelineEventBus';
import { recordQueueOverflow, recordCoverageFailure } from './pipelineTelemetry';
import { pipelineDiagnostics } from './pipelineDiagnostics';
import { calculateTimelineCoverage, SKELETON_MIN_TIMELINE_COVERAGE } from './skeletonDataUtils';
import type { MotionExtractionDebugState } from '../types/motionExtraction';

export type FrameIngressSample = {
  time: number;
  mediaTime: number;
  source: HTMLCanvasElement | OffscreenCanvas;
  queueDelayMs: number;
  queueLength: number;
  rvfcFps: number;
};

export type MediaPipeStageOutput = FrameIngressSample & {
  results: any;
  mediaPipeDelayMs: number;
};

export type TrackingStageOutput = MediaPipeStageOutput & {
  frameIndex: number;
  gridTimestamp: number;
  timestampMs: number;
  framePeople: any[];
  missingMemberIds: number[];
  rawCount: number;
  visibleCount: number;
  estimatedCount: number;
  avgConfidence: number;
  beat: number | null;
  beatIndex: number | null;
  timelineFrameIndex: number;
  runningCoverage: number;
  trackStability: number;
};

export type MotionPipelineContext = {
  detector: { detect: (s: unknown) => unknown; detectForVideo?: (s: unknown, ts: number) => unknown | Promise<unknown> };
  tracker: any;
  worker: Worker | null;
  frames: any[];
  groupId: string;
  expectedMemberCount: number;
  sampleFps: number;
  bpm: number;
  analysisDuration: number;
  timelineTotalFrames: number;
  videoWidth: number;
  videoHeight: number;
  sourceVideoNativeFps: number | null;
  minBufferedFrames: number;
  perfStats: any;
  heapTracker: ReturnType<typeof import('./memoryProfiler').createHeapTrendTracker>;
  workerMemory: ReturnType<typeof import('./memoryProfiler').createWorkerMemoryAggregator>;
  onDebug?: (patch: Partial<MotionExtractionDebugState>) => void;
  onFrameDetected?: (payload: Record<string, unknown>) => void;
  onProgress?: (pct: number, msg?: string) => void;
  abortRef?: { current: boolean };
  // mutable state
  lastDetectedPeopleById: Map<number, any>;
  prevFramePeopleById: Map<number, any>;
  memberCountSamples: number[];
  trackIdChangeCount: number;
  missingMemberFrameCount: number;
  maxMissingInFrame: number;
  workerSentCount: number;
  workerAckCount: number;
  workerDroppedCount: number;
  maxWorkerQueueObserved: number;
  workerSentAtByFrame: Map<number, number>;
  avgWorkerDelayMs: number;
  samplerQueueDroppedCount: number;
  nextCoverageCheckpointIdx: number;
  bytesPerSkeletonFrame: number;
  lastProcessingDelayMs: number;
  measuredFps: number;
  lastSampleAt: number;
  rvfcFpsSum: number;
  queueDelaySum: number;
  sampleCountForAvg: number;
  maxSamplerQueueObserved: number;
  COVERAGE_CHECKPOINTS: number[];
  COVERAGE_PROJECTION_MIN_PROGRESS: number;
  MAX_WORKER_QUEUE: number;
  SAMPLER_MAX_QUEUE_LENGTH: number;
  stabilizeTrackIds: (people: any[], prev: Map<number, any>) => { people: any[]; changes: number };
  fillMissingMembersFromLastDetected: (...args: any[]) => { people: any[]; missingTrackIds: number[] };
  detectHolistic: (detector: any, source: unknown, ts: number) => Promise<any> | any;
};

async function runDetect(ctx: MotionPipelineContext, source: unknown, timestampMs: number) {
  const r = ctx.detectHolistic(ctx.detector, source, timestampMs);
  return r instanceof Promise ? await r : r;
}

export function createMotionExtractionPipeline(ctx: MotionPipelineContext) {
  const stageDrop = (stageName: string) => (info: { queueLength: number; droppedCount: number; effectiveMaxQueueLength: number }) => {
    recordQueueOverflow(stageName, info);
  };

  const mediapipeStage = createPipelineStage<FrameIngressSample, MediaPipeStageOutput>({
    name: 'mediapipe',
    maxQueueLength: 20,
    targetFrameBudgetMs: 1000 / Math.max(1, ctx.sampleFps),
    onDrop: stageDrop('mediapipe'),
    handler: async (sample, meta) => {
      pipelineDiagnostics.setStageProcessing('mediapipe', sample.time);
      pipelineDiagnostics.markTimeline(sample.time, 'mediapipe-start');
      const detectStartedAt = performance.now();
      const timestampMsForDetector = Math.max(0, Math.round(sample.time * 1000));
      const results = await runDetect(ctx, sample.source, timestampMsForDetector);
      const mediaPipeDelayMs = performance.now() - detectStartedAt;
      pipelineDiagnostics.markTimeline(sample.time, 'mediapipe-end');
      pipelineDiagnostics.clearStageProcessing('mediapipe');
      ctx.perfStats.poseDetectionMs = (ctx.perfStats.poseDetectionMs || 0) + mediaPipeDelayMs;
      return { ...sample, results, mediaPipeDelayMs };
    },
  });

  const trackingStage = createPipelineStage<MediaPipeStageOutput, TrackingStageOutput>({
    name: 'tracking',
    maxQueueLength: 30,
    targetFrameBudgetMs: 1000 / Math.max(1, ctx.sampleFps),
    onDrop: stageDrop('tracking'),
    handler: async (item) => {
      pipelineDiagnostics.setStageProcessing('tracking', item.time);
      pipelineDiagnostics.markTimeline(item.time, 'tracking-start');
      const t = item.time;
      const frameIndex = ctx.frames.length;
      const gridTimestamp = frameIndex / ctx.sampleFps;
      const timestampMs = Math.round(gridTimestamp * 1000);
      const rawCount = item.results.landmarks?.length || 0;

      let trackedPeople = ctx.tracker.trackFrame(
        item.results.landmarks || [],
        item.results.worldLandmarks || [],
        t,
        ctx.expectedMemberCount,
      );
      trackedPeople = associateHolisticLandmarksToPeople(trackedPeople, item.results);
      trackedPeople = ctx.tracker.enrichWithHolisticLandmarks(trackedPeople);

      const stabilizeResult = ctx.stabilizeTrackIds(trackedPeople, ctx.prevFramePeopleById);
      trackedPeople = stabilizeResult.people;
      ctx.trackIdChangeCount += stabilizeResult.changes;

      const fillResult = ctx.fillMissingMembersFromLastDetected(
        trackedPeople,
        ctx.lastDetectedPeopleById,
        ctx.expectedMemberCount,
        t,
      );
      const framePeople = fillResult.people;
      const missingMemberIds = fillResult.missingTrackIds;
      if (missingMemberIds.length) {
        ctx.missingMemberFrameCount += 1;
        ctx.maxMissingInFrame = Math.max(ctx.maxMissingInFrame, missingMemberIds.length);
      }

      ctx.prevFramePeopleById = new Map(framePeople.map((p: any) => [p.trackId, p]));
      framePeople.forEach((person: any) => {
        if (!person.isEstimated) ctx.lastDetectedPeopleById.set(person.trackId, person);
      });

      const visibleCount = framePeople.filter((p: any) => !p.isEstimated).length;
      const estimatedCount = framePeople.filter((p: any) => p.isEstimated).length;
      if (ctx.memberCountSamples.length < 80) {
        const rawValid = ctx.tracker.countValidPoses(item.results.landmarks || []);
        const sample = Math.max(rawValid, visibleCount, framePeople.length);
        if (sample > 0) ctx.memberCountSamples.push(sample);
      }
      const avgConfidence = framePeople.length
        ? framePeople.reduce((s: number, p: any) => s + (p.confidence || 0), 0) / framePeople.length
        : 0;
      const beat = timeSecToBeat(t, ctx.bpm);
      const beatIndex = timeSecToBeatIndex(t, ctx.bpm);
      const timelineFrameIndex = Math.min(ctx.timelineTotalFrames - 1, Math.round(t * ctx.sampleFps));
      const runningCoverage = ctx.analysisDuration > 0 ? Math.min(1, t / ctx.analysisDuration) : 0;
      const trackStability = frameIndex > 0
        ? Math.max(0, 1 - ctx.trackIdChangeCount / (frameIndex + 1))
        : 1;

      pipelineDiagnostics.setFrameIndex(t, frameIndex);
      pipelineDiagnostics.markTimeline(t, 'tracking-end', frameIndex);
      pipelineDiagnostics.clearStageProcessing('tracking');

      return {
        ...item,
        frameIndex,
        gridTimestamp,
        timestampMs,
        framePeople,
        missingMemberIds,
        rawCount,
        visibleCount,
        estimatedCount,
        avgConfidence,
        beat,
        beatIndex,
        timelineFrameIndex,
        runningCoverage,
        trackStability,
      };
    },
  });

  const finalizeStage = createPipelineStage<TrackingStageOutput, null>({
    name: 'worker-dancedatabase',
    maxQueueLength: 60,
    targetFrameBudgetMs: 1000 / Math.max(1, ctx.sampleFps),
    onDrop: stageDrop('worker-dancedatabase'),
    handler: async (item) => {
      const t = item.time;
      const frameStartedAt = performance.now();
      const { framePeople, frameIndex, gridTimestamp, timestampMs } = item;

      ctx.frames.push({
        timestamp: gridTimestamp,
        timestampMs,
        sourceVideoTime: t,
        videoWidth: ctx.videoWidth,
        videoHeight: ctx.videoHeight,
        detectedPeople: framePeople,
      });
      ctx.perfStats.sampledFrames = (ctx.perfStats.sampledFrames || 0) + 1;

      if (ctx.bytesPerSkeletonFrame === 0 && ctx.frames.length > 0) {
        ctx.bytesPerSkeletonFrame = estimateBytesPerSkeletonFrame(ctx.frames[ctx.frames.length - 1]);
      }

      const progressRatio = ctx.analysisDuration > 0 ? Math.min(1, t / ctx.analysisDuration) : 0;
      while (
        ctx.nextCoverageCheckpointIdx < ctx.COVERAGE_CHECKPOINTS.length
        && progressRatio >= ctx.COVERAGE_CHECKPOINTS[ctx.nextCoverageCheckpointIdx]
      ) {
        const checkpoint = ctx.COVERAGE_CHECKPOINTS[ctx.nextCoverageCheckpointIdx];
        ctx.nextCoverageCheckpointIdx += 1;
        const liveCoverage = calculateTimelineCoverage(ctx.frames, ctx.analysisDuration);
        const projectedFinalCoverage = checkpoint > 0
          ? Math.min(1, liveCoverage.coverage / checkpoint)
          : liveCoverage.coverage;
        if (
          checkpoint >= ctx.COVERAGE_PROJECTION_MIN_PROGRESS
          && projectedFinalCoverage < SKELETON_MIN_TIMELINE_COVERAGE
        ) {
          recordCoverageFailure({
            checkpoint,
            projectedFinalCoverage,
            frameCount: ctx.frames.length,
            analysisDuration: ctx.analysisDuration,
          });
          throw new Error(
            `Motion Extraction 조기 종료 — Coverage 85% 미달 예상 `
            + `(checkpoint=${Math.round(checkpoint * 100)}%, `
            + `projected=${Math.round(projectedFinalCoverage * 100)}%)`,
          );
        }
      }

      const workerQueueLength = Math.max(0, ctx.workerSentCount - ctx.workerAckCount);
      if (ctx.worker) {
        if (workerQueueLength >= ctx.MAX_WORKER_QUEUE) {
          ctx.workerDroppedCount += 1;
          recordQueueOverflow('motion-post-process-worker', {
            queueLength: workerQueueLength,
            droppedCount: ctx.workerDroppedCount,
            effectiveMaxQueueLength: ctx.MAX_WORKER_QUEUE,
          });
        } else {
          const skeletonFrame = {
            timestamp: gridTimestamp,
            timestampMs,
            sourceVideoTime: t,
            frameIndex,
            videoWidth: ctx.videoWidth,
            videoHeight: ctx.videoHeight,
            members: framePeople.map((person: any, idx: number) => ({
              personIndex: idx,
              trackId: Number(person.trackId),
              estimatedMemberId: String(person.trackId),
              isEstimated: person.isEstimated ?? false,
              confidence: person.confidence,
              joints: Object.fromEntries(
                Object.entries(person.joints || {}).map(([name, joint]: [string, any]) => [
                  name,
                  {
                    x: joint.x,
                    y: joint.y,
                    z: joint.z ?? 0,
                    visibility: joint.visibility ?? joint.confidence ?? 1,
                    presence: joint.presence,
                    confidence: joint.confidence ?? joint.visibility ?? 1,
                  },
                ]),
              ),
            })).filter((member: any) => Object.keys(member.joints || {}).length),
          };
          ctx.worker.postMessage({
            type: 'PROCESS_FRAME',
            frameIndex,
            frame: skeletonFrame,
            groupId: ctx.groupId,
            userMemberId: '',
            focusMemberId: null,
            songId: ctx.groupId,
            sampleFps: ctx.sampleFps,
            detectedCount: framePeople.length,
            allMemberIds: framePeople.map((person: any) => String(person.trackId)),
            minBufferedFrames: ctx.minBufferedFrames,
          });
          ctx.workerSentAtByFrame.set(frameIndex, performance.now());
          ctx.workerSentCount += 1;
          pipelineDiagnostics.markTimeline(t, 'worker-send', frameIndex);
          ctx.maxWorkerQueueObserved = Math.max(ctx.maxWorkerQueueObserved, workerQueueLength + 1);
        }
      }

      ctx.lastProcessingDelayMs = performance.now() - frameStartedAt;
      ctx.perfStats.totalMs = (ctx.perfStats.totalMs || 0) + ctx.lastProcessingDelayMs;

      const now = performance.now();
      if (ctx.lastSampleAt > 0) {
        const instant = 1000 / Math.max(1, now - ctx.lastSampleAt);
        ctx.measuredFps = ctx.measuredFps * 0.85 + instant * 0.15;
      }
      ctx.lastSampleAt = now;
      ctx.rvfcFpsSum += item.rvfcFps ?? 0;
      ctx.queueDelaySum += item.queueDelayMs ?? 0;
      ctx.sampleCountForAvg += 1;
      ctx.maxSamplerQueueObserved = Math.max(ctx.maxSamplerQueueObserved, item.queueLength ?? 0);

      const heapStats = ctx.heapTracker.getStats();
      ctx.onDebug?.({
        frameIndex,
        timestamp: gridTimestamp,
        sourceVideoTime: t,
        lastTimestamp: t,
        measuredFps: ctx.measuredFps,
        sampleFps: ctx.sampleFps,
        nativeFps: ctx.sourceVideoNativeFps,
        rawPoseCount: item.rawCount,
        handCount: item.results.hands?.length || 0,
        faceCount: item.results.faces?.length || 0,
        trackedCount: framePeople.length,
        visibleCount: item.visibleCount,
        estimatedCount: item.estimatedCount,
        expectedMemberCount: ctx.expectedMemberCount,
        missingMemberCount: Math.max(0, ctx.expectedMemberCount - item.visibleCount),
        trackingIds: framePeople.map((p: any) => p.trackId),
        currentTrackedMembers: framePeople.map((p: any) => p.trackId),
        missingMembers: item.missingMemberIds,
        avgConfidence: item.avgConfidence,
        beat: item.beat,
        beatIndex: item.beatIndex,
        interpolationHold: item.estimatedCount > 0,
        timelineDuration: ctx.analysisDuration,
        timelineFrameIndex: item.timelineFrameIndex,
        timelineTotalFrames: ctx.timelineTotalFrames,
        pipelineStage: 'frame_detect',
        workerQueue: workerQueueLength,
        processingFrame: false,
        processingDelay: ctx.lastProcessingDelayMs,
        trackerResetCount: ctx.tracker.getReleasedTrackCount(),
        trackIdChanges: ctx.trackIdChangeCount,
        coverage: item.runningCoverage,
        rvfcFps: item.rvfcFps ?? ctx.measuredFps,
        queueLength: item.queueLength ?? 0,
        queueDelay: item.queueDelayMs ?? 0,
        workerDelay: ctx.avgWorkerDelayMs,
        mediaPipeDelay: item.mediaPipeDelayMs,
        droppedFrames: ctx.samplerQueueDroppedCount,
        trackStability: item.trackStability,
        cacheUsed: false,
        cacheCoverage: null,
        frameBufferMemoryMb: bytesToMb(
          estimateFrameBufferMemoryBytes(ctx.frames.length, ctx.bytesPerSkeletonFrame),
        ),
        canvasMemoryMb: bytesToMb(
          estimateCanvasPoolMemoryBytes(ctx.videoWidth, ctx.videoHeight, ctx.SAMPLER_MAX_QUEUE_LENGTH + 4),
        ),
        peakHeapMb: bytesToMb(heapStats.peakBytes),
        gcFrequency: heapStats.gcEventCount,
        workerMemoryMb: bytesToMb(ctx.workerMemory.totalBytes()),
      });

      pipelineEventBus.emit('motion-frame-ready', {
        groupId: ctx.groupId,
        frameIndex,
        timestamp: gridTimestamp,
        detectedPeople: framePeople,
      });

      ctx.onFrameDetected?.({
        rawCount: item.rawCount,
        trackedCount: framePeople.length,
        visibleCount: item.visibleCount,
        expectedMemberCount: ctx.expectedMemberCount,
      });

      return null;
    },
  });

  mediapipeStage.pipeTo(trackingStage);
  trackingStage.pipeTo(finalizeStage);

  const ingress = (sample: FrameIngressSample) => {
    mediapipeStage.push(sample);
  };

  const drain = async () => {
    await mediapipeStage.drain();
    await trackingStage.drain();
    await finalizeStage.drain();
  };

  const close = () => {
    mediapipeStage.close();
    trackingStage.close();
    finalizeStage.close();
  };

  const getAllStats = () => [
    mediapipeStage.getStats(),
    trackingStage.getStats(),
    finalizeStage.getStats(),
  ];

  return { ingress, drain, close, getAllStats, stages: [mediapipeStage, trackingStage, finalizeStage] };
}
