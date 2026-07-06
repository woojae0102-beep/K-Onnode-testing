// @ts-nocheck
import type { SkeletonFrameData } from '../types/groupPractice';
import type { SkeletonRenderTimeline } from '../services/rendering/SkeletonTimelineBuilder';
import { isDevEnvironment } from './isDevEnvironment';

/** Render Timeline 빌드 후 자체 검증 로그 */
export function logSkeletonRenderVerification(
  timeline: SkeletonRenderTimeline,
  sourceFrames: SkeletonFrameData[],
) {
  const validFrames = timeline.frames.filter(Boolean).length;
  const nullFrames = timeline.frames.length - validFrames;
  const sampleIndices = [0, Math.floor(timeline.totalFrames * 0.25), Math.floor(timeline.totalFrames * 0.5), Math.floor(timeline.totalFrames * 0.75), timeline.totalFrames - 1];
  const samples = sampleIndices.map((idx) => {
    const f = timeline.frames[idx];
    return {
      index: idx,
      timeSec: (idx / timeline.fps).toFixed(2),
      members: f?.members?.length ?? 0,
      null: f == null,
    };
  });

  const payload = {
    sourceFrameCount: sourceFrames.length,
    sourceFpsEstimate: Math.round(timeline.sourceFpsEstimate * 10) / 10,
    renderFps: timeline.fps,
    durationSec: timeline.duration,
    totalFrames: timeline.totalFrames,
    validRenderFrames: validFrames,
    nullRenderFrames: nullFrames,
    coverageEndSec: timeline.coverageEndSec,
    coverageMatch: timeline.coverageEndSec >= timeline.duration - 0.5,
    samples,
  };

  if (nullFrames > 0 && timeline.coverageEndSec < timeline.duration - 0.5) {
    console.warn('[SkeletonRenderVerify] coverage gap — practice ends at coverage, no freeze', payload);
  } else if (isDevEnvironment()) {
    console.log('[SkeletonRenderVerify] timeline OK', payload);
  } else {
    console.info('[SkeletonRenderVerify] built', {
      totalFrames: timeline.totalFrames,
      validRenderFrames: validFrames,
      durationSec: timeline.duration,
    });
  }
}

export default logSkeletonRenderVerification;
