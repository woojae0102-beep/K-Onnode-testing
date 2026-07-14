// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { AnalysisResult } from '../../../services/videoAnalysisTypes';
import type { SkeletonDebugFrameStat } from '../types';
import type {
  ExtractionProblemEntry,
  ExtractionRcaReport,
  FrameAnalysisSnapshot,
  PerformanceTimelinePoint,
  SkeletonAnalysisPackage,
} from './analysisTypes';
import { analyzeFrameRca } from './frameRcaAnalyzer';
import { buildHungarianInspector } from './hungarianInspectorBuilder';
import { buildKalmanInspector } from './kalmanInspectorBuilder';
import { buildMultiPersonInspector } from './multiPersonInspectorBuilder';
import { buildPipelineInspector } from './pipelineInspectorBuilder';
import { buildCoverageTimeline, detectCoverageDrops } from './coverageAnalyzer';
import { buildConfidenceTimelines } from './confidenceTimelineBuilder';
import { computeMotionQuality, computePerformanceBreakdown } from './motionQualityAnalyzer';
import { buildEnhancedTrackLifecycles } from './trackLifecycleAnalyzer';
import { getGroupData } from '../../../data/groupPracticeData';
import { resolveMinAiReferenceTracks } from '../../../config/choreoExtractConfig';

export function buildFrameAnalysis(
  frames: DetectionFrame[],
  frameStats: SkeletonDebugFrameStat[],
  frameIndex: number,
  groupId: string,
  sampleFps: number,
): FrameAnalysisSnapshot {
  const frame = frames[frameIndex] ?? null;
  const prev = frameIndex > 0 ? frames[frameIndex - 1] : null;
  const stat = frameStats[frameIndex] ?? null;
  const group = getGroupData(groupId);
  const trackToMember = new Map<number, string>();

  return {
    frameIndex,
    timestamp: frame?.timestamp ?? frameIndex / sampleFps,
    pipeline: buildPipelineInspector(frameIndex, frame, stat),
    hungarian: buildHungarianInspector(prev, frame, sampleFps),
    kalman: buildKalmanInspector(frames, frameIndex),
    persons: buildMultiPersonInspector(frame, prev, group?.members ?? [], trackToMember),
    rcaIssues: analyzeFrameRca(frames, frameIndex, stat, sampleFps),
    motionQuality: computeMotionQuality(frames, frameIndex, stat),
    performance: computePerformanceBreakdown(stat),
  };
}

export function buildExtractionRcaReport(
  analysisResult: AnalysisResult,
  frameStats: SkeletonDebugFrameStat[],
  frames: DetectionFrame[],
  groupId: string,
  sampleFps: number,
): ExtractionRcaReport {
  const group = getGroupData(groupId);
  const minRequired = resolveMinAiReferenceTracks(group?.memberCount ?? 0);
  const peakTrack = analysisResult.peakTrackCount ?? 0;
  const coverage = frameStats.length ? frameStats[frameStats.length - 1].coverage : 0;
  const avgConf = frameStats.length
    ? frameStats.reduce((s, f) => s + f.confidence, 0) / frameStats.length
    : 0;

  const qualityScores = frameStats.map((_, i) =>
    computeMotionQuality(frames, i, frameStats[i]).overall,
  );
  const motionQualityAverage = qualityScores.length
    ? qualityScores.reduce((s, v) => s + v, 0) / qualityScores.length
    : 0;

  let stableFrames = 0;
  frameStats.forEach((f) => {
    if (f.estimated === 0 && f.visible >= f.tracked - 1) stableFrames += 1;
  });
  const trackingStabilityPercent = frameStats.length
    ? Math.round((stableFrames / frameStats.length) * 100)
    : 0;

  const problems: ExtractionProblemEntry[] = [];
  const coverageDrops = detectCoverageDrops(frameStats);
  coverageDrops.slice(0, 20).forEach((ev) => {
    problems.push({
      frameIndex: ev.toFrame,
      problem: 'Coverage Drop',
      reason: ev.reason,
      severity: ev.dropAmount > 0.1 ? 'critical' : 'warning',
    });
  });

  for (let i = 1; i < Math.min(frames.length, 2000); i += 1) {
    const issues = analyzeFrameRca(frames, i, frameStats[i], sampleFps);
    issues.filter((x) => x.severity !== 'info').slice(0, 1).forEach((issue) => {
      if (problems.length < 40) {
        problems.push({
          frameIndex: i,
          problem: issue.problem,
          reason: issue.reason,
          severity: issue.severity === 'critical' ? 'critical' : 'warning',
        });
      }
    });
  }

  const passed = coverage >= 0.85 && peakTrack >= minRequired;
  let failureReason: string | null = null;
  if (!passed) {
    if (coverage < 0.85) failureReason = 'Coverage below threshold';
    else if (peakTrack < minRequired) failureReason = `Peak track ${peakTrack} < required ${minRequired}`;
  }

  const dropped = frameStats.length ? frameStats[frameStats.length - 1].droppedFrames : 0;
  const hungarianProblems = problems.filter((p) => p.reason.includes('Hungarian')).length;
  const trackingProblems = problems.filter((p) => p.reason.includes('Occlusion') || p.reason.includes('Loss')).length;
  const detectorProblems = problems.filter((p) => p.reason.includes('MediaPipe')).length;
  const queueProblems = problems.filter((p) => p.reason.includes('Queue')).length;
  const total = hungarianProblems + trackingProblems + detectorProblems + queueProblems + 1;

  return {
    passed,
    coverage,
    peakTrack,
    averageConfidence: avgConf,
    trackingStabilityPercent,
    motionQualityAverage: Math.round(motionQualityAverage),
    failureReason,
    problems: problems.sort((a, b) => a.frameIndex - b.frameIndex).slice(0, 50),
    rootCauseContributions: {
      detectorPct: Math.round((detectorProblems / total) * 100),
      trackingPct: Math.round((trackingProblems / total) * 100),
      hungarianPct: Math.round((hungarianProblems / total) * 100),
      confidencePct: Math.round((problems.filter((p) => p.problem.includes('Confidence')).length / total) * 100),
      queuePct: Math.round((queueProblems / total) * 100),
    },
  };
}

export function buildFullAnalysisPackage(options: {
  analysisResult: AnalysisResult;
  frameStats: SkeletonDebugFrameStat[];
  groupId: string;
  sampleFps: number;
}): SkeletonAnalysisPackage {
  const { analysisResult, frameStats, groupId, sampleFps } = options;
  const frames = analysisResult.frames ?? [];

  const frameAnalyses = new Map<number, FrameAnalysisSnapshot>();
  // Pre-build only every Nth frame + on-demand cache — store sparse for memory
  const step = frames.length > 800 ? 5 : 1;
  for (let i = 0; i < frames.length; i += step) {
    frameAnalyses.set(i, buildFrameAnalysis(frames, frameStats, i, groupId, sampleFps));
  }

  const performanceTimeline: PerformanceTimelinePoint[] = frameStats.map((f) => ({
    frameIndex: f.frameIndex,
    timestamp: f.timestamp,
    performance: computePerformanceBreakdown(f),
  }));

  return {
    version: 2,
    builtAt: new Date().toISOString(),
    frameAnalyses,
    trackLifecycles: buildEnhancedTrackLifecycles(frames, sampleFps),
    coverageTimeline: buildCoverageTimeline(frameStats),
    coverageDropEvents: detectCoverageDrops(frameStats),
    confidenceByTrack: buildConfidenceTimelines(frames),
    performanceTimeline,
    extractionReport: buildExtractionRcaReport(analysisResult, frameStats, frames, groupId, sampleFps),
  };
}

export function getFrameAnalysis(
  pkg: SkeletonAnalysisPackage,
  frames: DetectionFrame[],
  frameStats: SkeletonDebugFrameStat[],
  frameIndex: number,
  groupId: string,
  sampleFps: number,
): FrameAnalysisSnapshot {
  if (pkg.frameAnalyses.has(frameIndex)) {
    return pkg.frameAnalyses.get(frameIndex)!;
  }
  const snap = buildFrameAnalysis(frames, frameStats, frameIndex, groupId, sampleFps);
  pkg.frameAnalyses.set(frameIndex, snap);
  return snap;
}
