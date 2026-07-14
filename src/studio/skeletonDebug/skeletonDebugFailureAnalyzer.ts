// @ts-nocheck
import type { AnalysisResult } from '../../services/videoAnalysisTypes';
import type { MotionExtractionDebugState } from '../../types/motionExtraction';
import { resolveMinAiReferenceTracks } from '../../config/choreoExtractConfig';
import type { SkeletonFailureAnalysis, SkeletonFailureCategory, SkeletonDebugFrameStat } from './types';

const CATEGORY_LABELS: Record<SkeletonFailureCategory, string> = {
  coverage_insufficient: 'Coverage 부족',
  track_insufficient: 'Track 부족',
  confidence_insufficient: 'Confidence 부족',
  detection_insufficient: 'MediaPipe Detection 부족',
  tracking_loss: 'Tracking Loss',
  worker_queue_overflow: 'Worker Queue Overflow',
  rvfc_stop: 'RVFC Stop',
  frame_drop: 'Frame Drop',
  video_decode_issue: 'Video Decode Issue',
  pose_quality_insufficient: 'Pose Quality 부족',
  cancelled: '사용자 취소',
  unknown: '알 수 없는 오류',
};

export function getFailureCategoryLabel(cat: SkeletonFailureCategory): string {
  return CATEGORY_LABELS[cat] || cat;
}

export function analyzeSkeletonExtractionFailure(options: {
  error?: Error | string | null;
  analysisResult?: AnalysisResult | null;
  frameStats?: SkeletonDebugFrameStat[];
  lastDebug?: Partial<MotionExtractionDebugState>;
  expectedMemberCount?: number;
}): SkeletonFailureAnalysis | null {
  const { error, analysisResult, frameStats = [], lastDebug = {}, expectedMemberCount = 0 } = options;
  const message = typeof error === 'string' ? error : error?.message;
  if (!message && analysisResult?.frames?.length) return null;

  const categories = new Set<SkeletonFailureCategory>();
  const details: Record<string, unknown> = {};

  if (message?.includes('취소')) {
    categories.add('cancelled');
  }

  const peakTrack = analysisResult?.peakTrackCount ?? 0;
  const minRequired = analysisResult?.minRequiredAiTracks
    ?? resolveMinAiReferenceTracks(expectedMemberCount || analysisResult?.groupMemberCount || 0);
  const coverage = lastDebug.coverage ?? computeFinalCoverage(frameStats);
  const dropped = lastDebug.droppedFrames ?? 0;
  const workerQueue = lastDebug.workerQueue ?? 0;
  const avgConf = computeAvgConfidence(frameStats);
  const poseQuality = computeAvgPoseQuality(frameStats);
  const stage = lastDebug.pipelineStage ?? '';

  details.peakTrack = peakTrack;
  details.minRequiredTracks = minRequired;
  details.coverage = coverage;
  details.droppedFrames = dropped;
  details.workerQueue = workerQueue;
  details.avgConfidence = avgConf;
  details.poseQuality = poseQuality;
  details.pipelineStage = stage;

  if (message?.toLowerCase().includes('rvfc') || stage.includes('rvfc') || stage.includes('stall')) {
    categories.add('rvfc_stop');
  }
  if (message?.includes('Coverage') || coverage < 0.85) {
    categories.add('coverage_insufficient');
  }
  if (message?.includes('멤버') || message?.includes('member') || (minRequired > 0 && peakTrack < minRequired)) {
    categories.add('track_insufficient');
  }
  if (message?.includes('감지하지 못했') || message?.includes('detection')) {
    categories.add('detection_insufficient');
  }
  if (dropped > 10 || stage.includes('overflow') || stage.includes('sampler_queue')) {
    categories.add('frame_drop');
    if (workerQueue > 20 || stage.includes('worker')) categories.add('worker_queue_overflow');
  }
  if (avgConf < 0.5) categories.add('confidence_insufficient');
  if (poseQuality != null && poseQuality < 0.4) categories.add('pose_quality_insufficient');

  const trackLossRatio = computeTrackLossRatio(frameStats);
  if (trackLossRatio > 0.15) categories.add('tracking_loss');

  if (message?.includes('decode') || message?.includes('디코드') || message?.includes('영상')) {
    categories.add('video_decode_issue');
  }

  if (!categories.size) categories.add('unknown');

  const ordered = prioritizeCategories(Array.from(categories));
  const primaryCause = ordered[0];

  return {
    categories: ordered,
    primaryCause,
    message: message || buildDefaultMessage(primaryCause, details),
    details,
  };
}

function computeFinalCoverage(stats: SkeletonDebugFrameStat[]): number {
  if (!stats.length) return 0;
  return stats[stats.length - 1]?.coverage ?? 0;
}

function computeAvgConfidence(stats: SkeletonDebugFrameStat[]): number {
  if (!stats.length) return 0;
  return stats.reduce((s, f) => s + f.confidence, 0) / stats.length;
}

function computeAvgPoseQuality(stats: SkeletonDebugFrameStat[]): number | null {
  const vals = stats.map((f) => f.poseQuality).filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function computeTrackLossRatio(stats: SkeletonDebugFrameStat[]): number {
  if (!stats.length) return 0;
  let lossFrames = 0;
  stats.forEach((f) => {
    if (f.visible < f.tracked || f.estimated > 0) lossFrames += 1;
  });
  return lossFrames / stats.length;
}

function prioritizeCategories(cats: SkeletonFailureCategory[]): SkeletonFailureCategory[] {
  const order: SkeletonFailureCategory[] = [
    'cancelled',
    'rvfc_stop',
    'video_decode_issue',
    'worker_queue_overflow',
    'frame_drop',
    'coverage_insufficient',
    'track_insufficient',
    'detection_insufficient',
    'tracking_loss',
    'confidence_insufficient',
    'pose_quality_insufficient',
    'unknown',
  ];
  return order.filter((c) => cats.includes(c));
}

function buildDefaultMessage(primary: SkeletonFailureCategory, details: Record<string, unknown>): string {
  const label = getFailureCategoryLabel(primary);
  if (primary === 'track_insufficient') {
    return `${label}: peak=${details.peakTrack}, 필요=${details.minRequiredTracks}`;
  }
  if (primary === 'coverage_insufficient') {
    return `${label}: ${Math.round((details.coverage as number) * 100)}%`;
  }
  return label;
}

export default analyzeSkeletonExtractionFailure;
