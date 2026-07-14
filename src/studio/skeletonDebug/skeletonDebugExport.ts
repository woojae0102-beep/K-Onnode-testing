// @ts-nocheck
import type { AnalysisResult } from '../../services/videoAnalysisTypes';
import type { DetectionFrame } from '../../services/MultiPersonTracker';
import type { SkeletonAnalysisPackage } from './analysis/analysisTypes';
import { buildFrameAnalysis } from './analysis/buildFullAnalysis';
import { buildHungarianInspector } from './analysis/hungarianInspectorBuilder';
import { computeMotionQuality, computePerformanceBreakdown } from './analysis/motionQualityAnalyzer';
import { frameDt, findPrevPerson, personPoseConfidence, personVelocity } from './analysis/analysisMath';
import type {
  SkeletonDebugExportDocument,
  SkeletonDebugFrameExport,
  SkeletonDebugFrameStat,
  SkeletonDebugPersonExport,
  TrackHistoryEntry,
} from './types';
import { buildTrackHistory } from './trackHistoryBuilder';

function personToExportV2(
  person: DetectionFrame['detectedPeople'][0],
  frameIndex: number,
  frames: DetectionFrame[],
  frameStat: SkeletonDebugFrameStat | null,
  hungarianCost?: number,
  matchingThreshold?: number,
  predictionError?: number,
): SkeletonDebugPersonExport {
  const joints: Record<string, SkeletonDebugPersonExport['joints'][string]> = {};
  Object.entries(person.joints || {}).forEach(([name, joint]) => {
    joints[name] = {
      x: joint.x,
      y: joint.y,
      z: joint.z ?? 0,
      visibility: joint.visibility ?? joint.confidence ?? 1,
      confidence: joint.confidence ?? joint.visibility ?? 1,
    };
  });

  const prev = frameIndex > 0 ? findPrevPerson(frames[frameIndex - 1], person.trackId) : null;
  const dt = frameDt(frames, frameIndex, 30);
  const velocity = prev ? personVelocity(prev, person, dt) : 0;
  let acceleration = 0;
  if (frameIndex > 1) {
    const prev2 = findPrevPerson(frames[frameIndex - 2], person.trackId);
    if (prev && prev2) {
      const v0 = personVelocity(prev2, prev, dt);
      acceleration = (velocity - v0) / dt;
    }
  }

  const quality = computeMotionQuality(frames, frameIndex, frameStat);

  return {
    trackId: person.trackId,
    isEstimated: Boolean(person.isEstimated),
    confidence: person.confidence,
    joints,
    velocity,
    acceleration,
    poseScore: personPoseConfidence(person),
    trackingScore: person.isEstimated ? 0.5 : 1,
    hungarianCost,
    matchingThreshold,
    predictionError,
    occlusionReason: person.isEstimated ? 'kalman_hold' : null,
  };
}

function frameToExportV2(
  frame: DetectionFrame,
  frameIndex: number,
  frames: DetectionFrame[],
  frameStats: SkeletonDebugFrameStat[],
  groupId: string,
  sampleFps: number,
): SkeletonDebugFrameExport {
  const stat = frameStats[frameIndex] ?? null;
  const prev = frameIndex > 0 ? frames[frameIndex - 1] : null;
  const hungarian = buildHungarianInspector(prev, frame, sampleFps);
  const fa = buildFrameAnalysis(frames, frameStats, frameIndex, groupId, sampleFps);
  const perf = computePerformanceBreakdown(stat);
  const quality = computeMotionQuality(frames, frameIndex, stat);

  return {
    frameIndex,
    timestamp: frame.timestamp ?? frameIndex / sampleFps,
    sourceVideoTime: frame.sourceVideoTime ?? frame.timestamp ?? 0,
    persons: (frame.detectedPeople || []).map((p) => {
      const h = hungarian.find((x) => x.previousTrackId === p.trackId);
      return personToExportV2(p, frameIndex, frames, stat, h?.cost, h?.threshold);
    }),
    motionQuality: quality.overall,
    coverageScore: stat?.coverage ?? 0,
    pipelineStageTimes: {
      mediaPipe: perf.mediaPipeMs,
      tracking: perf.trackingMs,
      hungarian: perf.hungarianMs,
      kalman: perf.kalmanMs,
      worker: perf.workerMs,
      total: perf.totalMs,
    },
    failureReasons: fa.rcaIssues.map((i) => `${i.problem}: ${i.reason}`),
    hungarianMatches: hungarian.map((h) => ({
      previousTrackId: h.previousTrackId,
      currentDetectionIndex: h.currentDetectionIndex,
      cost: h.cost,
      threshold: h.threshold,
      matched: h.matched,
    })),
  };
}

export function buildSkeletonDebugExport(
  analysisResult: AnalysisResult,
  frameStats: SkeletonDebugFrameStat[],
  trackHistory: TrackHistoryEntry[],
  groupId: string,
  coverage: number,
  analysisPackage?: SkeletonAnalysisPackage | null,
): SkeletonDebugExportDocument {
  const sampleFps = analysisResult.sampleFps ?? 30;
  const rawFrames = analysisResult.frames || [];
  const frames = rawFrames.map((f, i) =>
    frameToExportV2(f, i, rawFrames, frameStats, groupId, sampleFps),
  );

  return {
    meta: {
      version: 2,
      exportedAt: new Date().toISOString(),
      groupId,
      videoWidth: analysisResult.videoWidth ?? 0,
      videoHeight: analysisResult.videoHeight ?? 0,
      sampleFps,
      sourceVideoDurationSec: analysisResult.sourceVideoDurationSec ?? 0,
      sourceVideoNativeFps: analysisResult.sourceVideoNativeFps ?? null,
      peakTrackCount: analysisResult.peakTrackCount ?? 0,
      frameCount: frames.length,
      coverage,
    },
    frameStats,
    trackHistory,
    frames,
    analysis: analysisPackage
      ? {
          extractionReport: analysisPackage.extractionReport,
          trackLifecycles: analysisPackage.trackLifecycles,
          coverageDropEvents: analysisPackage.coverageDropEvents,
          coverageTimeline: analysisPackage.coverageTimeline,
        }
      : undefined,
  };
}

export function downloadSkeletonDebugJson(doc: SkeletonDebugExportDocument, fileName = 'skeleton-analysis.json'): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseSkeletonDebugJson(text: string): SkeletonDebugExportDocument {
  const parsed = JSON.parse(text);
  if (!parsed?.meta?.version || !Array.isArray(parsed.frames)) {
    throw new Error('유효하지 않은 Skeleton Analysis JSON 형식입니다.');
  }
  return parsed as SkeletonDebugExportDocument;
}

export function exportFramesToDetectionFrames(
  exportFrames: SkeletonDebugFrameExport[],
): DetectionFrame[] {
  return exportFrames.map((ef) => ({
    timestamp: ef.timestamp,
    sourceVideoTime: ef.sourceVideoTime,
    detectedPeople: ef.persons.map((p) => ({
      trackId: p.trackId,
      confidence: p.confidence,
      isEstimated: p.isEstimated,
      lastSeenTimestamp: ef.timestamp,
      joints: Object.fromEntries(
        Object.entries(p.joints).map(([name, j]) => [
          name,
          { x: j.x, y: j.y, z: j.z, visibility: j.visibility, confidence: j.confidence },
        ]),
      ),
      worldJoints: {},
    })),
  }));
}

export function sessionFromExportDocument(doc: SkeletonDebugExportDocument): {
  frames: DetectionFrame[];
  frameStats: SkeletonDebugFrameStat[];
  trackHistory: TrackHistoryEntry[];
} {
  const frames = exportFramesToDetectionFrames(doc.frames);
  const trackHistory = doc.trackHistory?.length
    ? doc.trackHistory
    : buildTrackHistory(frames);
  return {
    frames,
    frameStats: doc.frameStats || [],
    trackHistory,
  };
}

export default buildSkeletonDebugExport;
