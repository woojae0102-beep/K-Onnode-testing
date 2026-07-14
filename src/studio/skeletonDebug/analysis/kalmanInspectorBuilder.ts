// @ts-nocheck
import type { DetectionFrame, TrackedPerson } from '../../../services/MultiPersonTracker';
import type { KalmanInspectionRow } from './analysisTypes';
import { findPrevPerson, personCenter } from './analysisMath';

export function buildKalmanInspector(
  frames: DetectionFrame[],
  frameIndex: number,
): KalmanInspectionRow[] {
  const frame = frames[frameIndex];
  if (!frame) return [];
  const rows: KalmanInspectionRow[] = [];

  frame.detectedPeople?.forEach((person) => {
    if (!person.isEstimated) {
      // Was predicted last frame?
      const prev = frameIndex > 0 ? findPrevPerson(frames[frameIndex - 1], person.trackId) : null;
      if (prev?.isEstimated) {
        const pred = personCenter(prev);
        const actual = personCenter(person);
        if (pred && actual) {
          rows.push({
            trackId: person.trackId,
            jointName: 'center',
            predictionX: pred.x,
            predictionY: pred.y,
            actualX: actual.x,
            actualY: actual.y,
            distanceError: Math.hypot(actual.x - pred.x, actual.y - pred.y),
            predictionConfidence: prev.confidence,
            predictionAgeFrames: countPredictionAge(frames, frameIndex, person.trackId),
          });
        }
      }
      return;
    }

    // Currently estimated — compare to last visible
    const lastVisible = findLastVisibleJoints(frames, frameIndex, person.trackId);
    const pred = personCenter(person);
    const actual = lastVisible ? personCenter({ ...person, joints: lastVisible }) : null;
    if (pred) {
      rows.push({
        trackId: person.trackId,
        jointName: 'center',
        predictionX: pred.x,
        predictionY: pred.y,
        actualX: actual?.x ?? pred.x,
        actualY: actual?.y ?? pred.y,
        distanceError: actual ? Math.hypot(actual.x - pred.x, actual.y - pred.y) : 0,
        predictionConfidence: person.confidence,
        predictionAgeFrames: countPredictionAge(frames, frameIndex, person.trackId),
      });
    }
  });

  return rows;
}

function countPredictionAge(frames: DetectionFrame[], frameIndex: number, trackId: number): number {
  let age = 0;
  for (let i = frameIndex; i >= 0; i -= 1) {
    const p = frames[i]?.detectedPeople?.find((x) => x.trackId === trackId);
    if (!p) break;
    if (!p.isEstimated) break;
    age += 1;
  }
  return age;
}

function findLastVisibleJoints(
  frames: DetectionFrame[],
  frameIndex: number,
  trackId: number,
): TrackedPerson['joints'] | null {
  for (let i = frameIndex - 1; i >= 0; i -= 1) {
    const p = frames[i]?.detectedPeople?.find((x) => x.trackId === trackId && !x.isEstimated);
    if (p) return p.joints;
  }
  return null;
}
