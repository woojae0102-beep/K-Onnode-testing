// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { SkeletonDebugFrameStat } from '../types';
import type { FrameRcaIssue } from './analysisTypes';
import { buildHungarianInspector, averageHungarianCost } from './hungarianInspectorBuilder';
import {
  avgJointVisibility,
  bboxOverlap,
  computeBBox,
  findPrevPerson,
  personPoseConfidence,
} from './analysisMath';

export function analyzeFrameRca(
  frames: DetectionFrame[],
  frameIndex: number,
  frameStat: SkeletonDebugFrameStat | null,
  sampleFps: number,
): FrameRcaIssue[] {
  const frame = frames[frameIndex];
  const prev = frameIndex > 0 ? frames[frameIndex - 1] : null;
  if (!frame) return [];

  const issues: FrameRcaIssue[] = [];
  const hungarian = buildHungarianInspector(prev, frame, sampleFps);

  // Track lost
  prev?.detectedPeople?.forEach((prevPerson) => {
    const curr = frame.detectedPeople?.find((p) => p.trackId === prevPerson.trackId);
    if (!curr) {
      issues.push({
        problem: `Track #${prevPerson.trackId} Lost`,
        reason: 'Tracking Loss',
        evidence: ['Track absent in current frame'],
        suggestedCause: 'Person left frame or MediaPipe miss',
        severity: 'critical',
      });
      return;
    }
    if (!prevPerson.isEstimated && curr.isEstimated) {
      const vis = avgJointVisibility(curr);
      const ls = curr.joints?.left_shoulder;
      const rh = curr.joints?.right_hip;
      const evidence: string[] = [];
      if (ls) evidence.push(`Left Shoulder visibility ${(ls.visibility ?? ls.confidence ?? 0).toFixed(2)}`);
      if (rh) evidence.push(`Right Hip visibility ${(rh.visibility ?? rh.confidence ?? 0).toFixed(2)}`);
      const others = frame.detectedPeople.filter((p) => p.trackId !== curr.trackId && !p.isEstimated);
      const box = computeBBox(curr.joints);
      others.forEach((o) => {
        const ov = bboxOverlap(box, computeBBox(o.joints));
        if (ov > 0.4) evidence.push(`BBox overlap ${Math.round(ov * 100)}%`);
      });
      const prevConf = personPoseConfidence(prevPerson);
      const currConf = personPoseConfidence(curr);
      if (prevConf > currConf) {
        evidence.push(`Confidence dropped ${prevConf.toFixed(2)} → ${currConf.toFixed(2)}`);
      }
      issues.push({
        problem: `Track #${curr.trackId} Lost (Occluded)`,
        reason: 'Occlusion',
        evidence,
        suggestedCause: 'Person temporarily hidden',
        severity: 'warning',
      });
    }
  });

  // Track switch
  hungarian.filter((h) => !h.matched && h.reason?.includes('Track switch')).forEach((h) => {
    issues.push({
      problem: 'Track Switch',
      reason: 'Hungarian Reassignment',
      evidence: [
        `Matching Cost ${h.cost.toFixed(2)}`,
        `Threshold ${h.threshold.toFixed(2)}`,
        `Previous Track ${h.previousTrackId}`,
        h.reason || '',
      ],
      suggestedCause: 'Hungarian cost spike or detection reorder',
      severity: 'warning',
    });
  });

  // Hungarian rejects
  const rejects = hungarian.filter((h) => !h.matched && !h.reason?.includes('Track switch'));
  if (rejects.length >= 2) {
    issues.push({
      problem: 'Hungarian Matching Stress',
      reason: 'Hungarian Reject',
      evidence: rejects.slice(0, 4).map((r) => `Track${r.previousTrackId} cost ${r.cost.toFixed(2)} / ${r.threshold.toFixed(2)}`),
      suggestedCause: 'Pose similarity too low between frames',
      severity: 'info',
    });
  }

  // Coverage / queue
  if (frameStat && frameStat.coverage < (frames[frameIndex - 1] ? (frameStat.coverage + 0.05) : 1)) {
    const drop = frameStat.droppedFrames > 0;
    issues.push({
      problem: 'Coverage Drop',
      reason: drop ? 'Worker Queue Overflow' : 'Member Loss',
      evidence: [
        `Coverage ${Math.round(frameStat.coverage * 100)}%`,
        drop ? `Dropped frames ${frameStat.droppedFrames}` : `Visible ${frameStat.visible}/${frameStat.tracked}`,
      ],
      suggestedCause: drop ? 'Pipeline backlog' : 'Detection or tracking loss',
      severity: 'warning',
    });
  }

  if (frameStat?.workerQueue > 25) {
    issues.push({
      problem: 'Worker Queue Overflow',
      reason: 'Queue Backlog',
      evidence: [`Worker queue ${frameStat.workerQueue}`, `Queue length ${frameStat.queueLength}`],
      suggestedCause: 'Post-process worker slower than ingest',
      severity: 'critical',
    });
  }

  // MediaPipe miss
  if (frameStat && frameStat.detected < frameStat.tracked) {
    issues.push({
      problem: 'MediaPipe Detection Gap',
      reason: 'MediaPipe Miss',
      evidence: [`Detected ${frameStat.detected} < Tracked ${frameStat.tracked}`],
      suggestedCause: 'Raw detection count below tracked (hold/interpolation active)',
      severity: 'info',
    });
  }

  if (!issues.length && hungarian.length) {
    const avg = averageHungarianCost(hungarian);
    if (avg > 0.35) {
      issues.push({
        problem: 'Elevated Matching Cost',
        reason: 'Hungarian Cost Spike',
        evidence: [`Average Cost ${avg.toFixed(2)}`],
        suggestedCause: 'Fast motion or overlapping performers',
        severity: 'info',
      });
    }
  }

  return issues;
}
