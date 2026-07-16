// @ts-nocheck
import {
  parseRawPerson,
  countValidPosesMirror,
  passesConfidenceFilter,
  passesVisibilityFilter,
  isBboxOutside,
  CONFIDENCE_THRESHOLD,
  VISIBILITY_THRESHOLD,
} from './mediaPipeLandmarkUtils';
import type {
  MediaPipeRawFrameSnapshot,
  MediaPipeTimingBreakdown,
  JointStabilityRow,
  PipelineFlowStage,
  PipelineRemovalEntry,
  PipelineLossReport,
} from './mediaPipeRawTypes';

export function captureMediaPipeRawFrame(opts: {
  frameIndex: number;
  timestamp: number;
  sourceVideoTime?: number;
  results: { landmarks?: unknown[]; worldLandmarks?: unknown[] };
  queueDelayMs?: number;
  poseDetectionMs: number;
  landmarkProcessMs: number;
  postProcessMs: number;
}): MediaPipeRawFrameSnapshot {
  const landmarks = opts.results.landmarks || [];
  const worldLandmarks = opts.results.worldLandmarks || [];
  const persons = landmarks.map((lm, idx) => parseRawPerson(lm as unknown[], worldLandmarks as unknown[], idx));
  const rawLandmarkCount = landmarks.reduce((sum, lm) => sum + ((lm as unknown[])?.length ?? 0), 0);

  const timing: MediaPipeTimingBreakdown = {
    imageDecodeMs: opts.queueDelayMs ?? 0,
    poseDetectionMs: opts.poseDetectionMs,
    landmarkMs: opts.landmarkProcessMs,
    postProcessMs: opts.postProcessMs,
    totalMs: (opts.queueDelayMs ?? 0) + opts.poseDetectionMs + opts.landmarkProcessMs + opts.postProcessMs,
  };

  return {
    frameIndex: opts.frameIndex,
    timestamp: opts.timestamp,
    sourceVideoTime: opts.sourceVideoTime,
    rawDetectionCount: landmarks.length,
    rawLandmarkCount,
    detectedPersons: countValidPosesMirror(landmarks as unknown[][]),
    persons,
    timing,
  };
}

export function buildJointStability(
  current: MediaPipeRawFrameSnapshot,
  previous: MediaPipeRawFrameSnapshot | null,
): JointStabilityRow[] {
  if (!previous?.persons?.length) {
    return current.persons.flatMap((p) =>
      p.joints.filter((j) => j.action !== 'missing').map((j) => ({
        jointName: `${p.detectionIndex}:${j.name}`,
        deltaPx: 0,
        flicker: false,
        lostReason: null,
      })),
    );
  }

  const rows: JointStabilityRow[] = [];
  current.persons.forEach((person) => {
    const prevPerson = previous.persons[person.detectionIndex];
    person.joints.forEach((joint) => {
      const prevJoint = prevPerson?.joints.find((j) => j.name === joint.name);
      let deltaPx = 0;
      let flicker = false;
      let lostReason: string | null = null;

      if (joint.action === 'missing' || joint.confidence <= 0.3) {
        lostReason = joint.action === 'missing' ? 'landmark missing' : `visibility<=${0.3}`;
      } else if (prevJoint && prevJoint.action !== 'missing') {
        deltaPx = Math.hypot(joint.x - prevJoint.x, joint.y - prevJoint.y);
        flicker = deltaPx > 0.12 && joint.confidence < 0.5;
        if (flicker) lostReason = `flicker Δ${deltaPx.toFixed(3)}`;
      }

      rows.push({
        jointName: `D${person.detectionIndex}:${joint.name}`,
        deltaPx,
        flicker,
        lostReason,
      });
    });
  });
  return rows;
}

export function buildPipelineFlowAndLoss(opts: {
  raw: MediaPipeRawFrameSnapshot;
  afterTrackingVisible: number;
  afterTrackingTotal: number;
  afterMappingTotal: number;
  skeletonOutputCount: number;
  estimatedCount: number;
}): { flow: PipelineFlowStage[]; removals: PipelineRemovalEntry[]; lossReport: PipelineLossReport } {
  const { raw } = opts;
  const removals: PipelineRemovalEntry[] = [];

  const afterConfidence = raw.persons.filter(passesConfidenceFilter).length;
  const afterVisibility = raw.persons.filter((p) => passesConfidenceFilter(p) && passesVisibilityFilter(p)).length;

  raw.persons.forEach((p) => {
    if (!passesConfidenceFilter(p)) {
      removals.push({
        trackOrDetectionId: `Detection${p.detectionIndex}`,
        stage: 'Confidence Filter',
        reason: `confidence<${CONFIDENCE_THRESHOLD} (${p.poseConfidence.toFixed(3)})`,
      });
      return;
    }
    if (!passesVisibilityFilter(p)) {
      removals.push({
        trackOrDetectionId: `Detection${p.detectionIndex}`,
        stage: 'Visibility Filter',
        reason: `visibility<${VISIBILITY_THRESHOLD} (avg=${p.visibilityAverage.toFixed(3)})`,
      });
      return;
    }
    if (isBboxOutside(p.bbox)) {
      removals.push({
        trackOrDetectionId: `Detection${p.detectionIndex}`,
        stage: 'Bounding Box',
        reason: 'bbox outside frame',
      });
    }
  });

  const flow: PipelineFlowStage[] = [
    { label: 'Raw Detection', count: raw.rawDetectionCount },
    { label: 'After Confidence Filter', count: afterConfidence },
    { label: 'After Visibility Filter', count: afterVisibility },
    { label: 'After Tracking', count: opts.afterTrackingVisible },
    { label: 'After Mapping', count: opts.afterMappingTotal },
    { label: 'Skeleton Output', count: opts.skeletonOutputCount },
  ];

  for (let i = 1; i < flow.length; i += 1) {
    const drop = flow[i - 1].count - flow[i].count;
    if (drop > 0 && flow[i].label === 'After Tracking') {
      removals.push({
        trackOrDetectionId: 'Tracking',
        stage: 'Tracking',
        reason: `${drop} detection(s) unmatched or merged`,
      });
    }
    if (drop > 0 && flow[i].label === 'After Mapping' && opts.estimatedCount > 0) {
      removals.push({
        trackOrDetectionId: 'Mapping',
        stage: 'Member Mapping',
        reason: `${opts.estimatedCount} slot(s) filled by interpolation (estimated)`,
      });
    }
    if (drop > 0 && flow[i].label === 'Skeleton Output') {
      removals.push({
        trackOrDetectionId: 'Skeleton',
        stage: 'Skeleton Output',
        reason: `${drop} person(s) dropped — incomplete joints or worker skip`,
      });
    }
  }

  let primaryLossStage: string | null = null;
  let maxDrop = 0;
  for (let i = 1; i < flow.length; i += 1) {
    const drop = flow[i - 1].count - flow[i].count;
    if (drop > maxDrop) {
      maxDrop = drop;
      primaryLossStage = flow[i].label;
    }
  }

  const summary = maxDrop > 0
    ? `Frame ${raw.frameIndex}: ${maxDrop} lost at "${primaryLossStage}" (raw ${raw.rawDetectionCount} → skeleton ${opts.skeletonOutputCount})`
    : `Frame ${raw.frameIndex}: no person-count loss (raw ${raw.rawDetectionCount} → skeleton ${opts.skeletonOutputCount})`;

  const lossReport: PipelineLossReport = {
    frameIndex: raw.frameIndex,
    timestamp: raw.timestamp,
    flow,
    removals,
    primaryLossStage,
    summary,
  };

  return { flow, removals, lossReport };
}

export function countSkeletonOutput(people: Array<{ joints?: Record<string, unknown>; isEstimated?: boolean }>): number {
  return (people || []).filter((p) => {
    const joints = Object.keys(p.joints || {});
    return joints.length >= 5;
  }).length;
}

export function attachPipelineLossToRaw(
  raw: MediaPipeRawFrameSnapshot,
  pipeline: {
    afterTrackingVisible: number;
    afterTrackingTotal: number;
    afterMappingTotal: number;
    skeletonOutputCount: number;
    estimatedCount: number;
  },
  previous: MediaPipeRawFrameSnapshot | null,
): MediaPipeRawFrameSnapshot {
  const { flow, removals, lossReport } = buildPipelineFlowAndLoss({ raw, ...pipeline });
  const jointStability = buildJointStability(raw, previous);
  return {
    ...raw,
    pipelineFlow: flow,
    removals,
    lossReport,
    jointStability,
  };
}
