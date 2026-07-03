// @ts-nocheck
import type { GroupDanceRenderSnapshot } from '../types/groupChoreography';

/** Snapshot만으로 스테이지 복원에 필요한 필드가 모두 있는지 */
export function isGroupDanceSnapshotComplete(
  snapshot: GroupDanceRenderSnapshot | null | undefined,
): boolean {
  if (!snapshot) return false;
  if (!Number.isFinite(snapshot.currentTime) && !Number.isFinite(snapshot.timestamp)) return false;
  if (!snapshot.timeline) return false;
  if (!Number.isFinite(snapshot.timeline.duration) || snapshot.timeline.duration <= 0) return false;
  if (!Number.isFinite(snapshot.timeline.fps) || snapshot.timeline.fps <= 0) return false;
  if (!Number.isFinite(snapshot.timeline.totalFrames) || snapshot.timeline.totalFrames <= 0) return false;
  if (!snapshot.frame) return false;
  if (!Array.isArray(snapshot.memberTracks)) return false;
  if (!Number.isFinite(snapshot.confidence)) return false;
  if (!snapshot.aiAvatars?.length) return false;
  const aiWithJoints = snapshot.aiAvatars.filter((a) => Object.keys(a.joints || {}).length > 0).length;
  return aiWithJoints > 0;
}

let lastLogKey = '';

/** snapshot 생성/실패 상태를 콘솔에 출력 (동일 상태 중복 로그 방지) */
export function logSnapshotStatus(
  snapshot: GroupDanceRenderSnapshot | null,
  context: string,
  { loading = false } = {},
) {
  const key = snapshot
    ? `${context}:${snapshot.currentTime}:${snapshot.timeline?.frameIndex}:${snapshot.aiAvatars?.length ?? 0}:${Boolean(snapshot.frame)}:${snapshot.memberTracks?.length ?? 0}`
    : `${context}:null:${loading}`;

  if (key === lastLogKey) return;
  lastLogKey = key;

  if (snapshot) {
    console.debug(`[Snapshot] ${context} OK`, {
      currentTime: snapshot.currentTime,
      frameIndex: snapshot.timeline?.frameIndex,
      totalFrames: snapshot.timeline?.totalFrames,
      aiCount: snapshot.aiAvatars?.length ?? 0,
      hasFrame: Boolean(snapshot.frame),
      hasFormation: Boolean(snapshot.formation),
      memberTracks: snapshot.memberTracks?.length ?? 0,
      confidence: snapshot.confidence,
      complete: isGroupDanceSnapshotComplete(snapshot),
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
