// @ts-nocheck
import type { PracticeMotionSnapshot } from '../types/motionSnapshot';
import {
  isPracticeMotionSnapshotComplete,
  snapshotAiAvatars,
  snapshotConfidence,
  snapshotCurrentTime,
  snapshotFrame,
  snapshotMemberTracks,
} from './motionSnapshotUtils';

/** @deprecated isPracticeMotionSnapshotComplete 사용 */
export function isGroupDanceSnapshotComplete(
  snapshot: PracticeMotionSnapshot | null | undefined,
): boolean {
  return isPracticeMotionSnapshotComplete(snapshot);
}

let lastLogKey = '';

export function logSnapshotStatus(
  snapshot: PracticeMotionSnapshot | null,
  context: string,
  { loading = false } = {},
) {
  const key = snapshot
    ? `${context}:${snapshotCurrentTime(snapshot)}:${snapshot.timeline?.frameIndex}:${snapshotAiAvatars(snapshot).length}:${Boolean(snapshotFrame(snapshot))}:${snapshotMemberTracks(snapshot).length}`
    : `${context}:null:${loading}`;

  if (key === lastLogKey) return;
  lastLogKey = key;

  if (snapshot) {
    console.debug(`[Snapshot] ${context} OK`, {
      videoDuration: snapshot.videoDuration,
      frameCount: snapshot.frameCount,
      fps: snapshot.fps,
      currentTime: snapshotCurrentTime(snapshot),
      frameIndex: snapshot.timeline?.frameIndex,
      totalFrames: snapshot.timeline?.totalFrames,
      aiCount: snapshotAiAvatars(snapshot).length,
      memberCount: snapshot.members?.length ?? 0,
      hasFrame: Boolean(snapshotFrame(snapshot)),
      hasFormation: Boolean(snapshot.formation),
      memberTracks: snapshotMemberTracks(snapshot).length,
      confidence: snapshotConfidence(snapshot),
      referenceVideo: snapshot.referenceVideo ? 'present' : 'none',
      generatedAt: snapshot.generatedAt,
      complete: isPracticeMotionSnapshotComplete(snapshot),
    });
  } else {
    console.warn(
      `[Snapshot] ${context} NULL`,
      loading ? '(engine loading)' : '(engine ready — tick returned null)',
    );
  }
}

export function resetSnapshotDebugLog() {
  lastLogKey = '';
}

export default logSnapshotStatus;
