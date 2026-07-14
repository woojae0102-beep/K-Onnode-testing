// @ts-nocheck
import type { DetectionFrame } from '../../../services/MultiPersonTracker';
import type { GroupMember } from '../../../types/groupPractice';
import type { PersonInspectionRow } from './analysisTypes';
import {
  avgJointVisibility,
  bboxOverlap,
  computeBBox,
  findClosestPrevTrack,
  findPrevPerson,
  isOutsideScreen,
  personPoseConfidence,
} from './analysisMath';

export function buildMultiPersonInspector(
  frame: DetectionFrame | null,
  prevFrame: DetectionFrame | null,
  members: GroupMember[],
  trackToMember: Map<number, string>,
): PersonInspectionRow[] {
  if (!frame?.detectedPeople?.length) return [];

  return frame.detectedPeople.map((person) => {
    const prev = findPrevPerson(prevFrame, person.trackId);
    const conf = personPoseConfidence(person);
    const vis = avgJointVisibility(person);
    const memberId = trackToMember.get(person.trackId);
    const memberLabel = members.find((m) => m.id === memberId)?.nameKr
      ?? members.find((m) => m.id === memberId)?.name
      ?? `Track ${person.trackId}`;

    let status: PersonInspectionRow['status'] = 'visible';
    let reason: string | undefined;
    let predictionMethod: PersonInspectionRow['predictionMethod'] = 'none';

    if (person.isEstimated) {
      status = 'occluded';
      predictionMethod = 'kalman';
      reason = `Visibility ${Math.round(vis * 100)}% — Kalman hold`;
    } else if (isOutsideScreen(person)) {
      status = 'outside_screen';
      reason = 'BBox near screen edge';
    } else if (vis < 0.35) {
      status = 'occluded';
      reason = `Low visibility ${Math.round(vis * 100)}%`;
    }

    if (!person.isEstimated && prev?.isEstimated) {
      predictionMethod = 'kalman';
    }

    const closest = findClosestPrevTrack(prevFrame, person);
    let trackingStability: PersonInspectionRow['trackingStability'] = 'stable';
    if (!prev) trackingStability = 'new';
    else if (closest && closest.trackId !== person.trackId && closest.distance < 0.15) {
      trackingStability = 'switched';
      reason = `Track switch ${closest.trackId} → ${person.trackId}`;
    } else if (person.isEstimated) {
      trackingStability = 'unstable';
    }

    // Lost: in prev but not visible now
    if (!person.isEstimated && conf < 0.35) {
      status = 'lost';
      reason = 'MediaPipe Miss / low confidence';
    }

    // BBox overlap evidence for occlusion
    if (prev && !person.isEstimated) {
      const others = frame.detectedPeople.filter((p) => p.trackId !== person.trackId && !p.isEstimated);
      const boxA = computeBBox(person.joints);
      others.forEach((other) => {
        const overlap = bboxOverlap(boxA, computeBBox(other.joints));
        if (overlap > 0.5 && status === 'visible') {
          status = 'occluded';
          reason = `BBox overlap ${Math.round(overlap * 100)}%`;
        }
      });
    }

    return {
      trackId: person.trackId,
      memberLabel,
      status,
      visiblePercent: Math.round((person.isEstimated ? vis * 0.5 : vis) * 100),
      confidence: conf,
      trackingStability,
      predictionMethod,
      avgJointVisibility: vis,
      reason,
    };
  });
}
