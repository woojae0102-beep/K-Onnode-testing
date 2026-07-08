// @ts-nocheck
import type { SkeletonFrameData, SkeletonMemberData } from '../types/groupPractice';
import { isDevEnvironment } from './isDevEnvironment';

let lastLoggedFrameIndex = -1;

function jointsObjectId(joints: Record<string, unknown> | null | undefined): string {
  if (!joints) return 'null';
  return `ref@${Object.keys(joints).length}`;
}

/**
 * 렌더 직전 referenceFrames[currentFrame] 검증 로그.
 * frameIndex 변경 시에만 출력 (RAF 스팸 방지).
 */
export function logReferenceFrameBeforeRender(
  frame: SkeletonFrameData | null | undefined,
  frameIndex: number,
  options: { focusMemberId?: string; force?: boolean } = {},
): void {
  if (!isDevEnvironment()) return;
  if (!frame?.members?.length) return;

  if (!options.force && frameIndex === lastLoggedFrameIndex) return;
  lastLoggedFrameIndex = frameIndex;

  const members = frame.members;
  const memberIds = members.map((m) => m.estimatedMemberId ?? null);
  const trackIds = members.map((m) => m.trackId ?? null);
  const jointCount = members.reduce(
    (sum, m) => sum + Object.keys(m.joints || {}).length,
    0,
  );

  console.table({
    frameIndex,
    members: members.length,
    memberIds,
    trackIds,
    jointCount,
    timestamp: frame.timestamp,
    focusMemberId: options.focusMemberId ?? null,
  });

  const memberRows = members.map((m) => ({
    memberId: m.estimatedMemberId ?? null,
    trackId: m.trackId ?? null,
    'nose.x': m.joints?.nose?.x ?? null,
    'nose.y': m.joints?.nose?.y ?? null,
    jointCount: Object.keys(m.joints || {}).length,
    isEstimated: Boolean(m.isEstimated),
    jointsSharedKey: jointsObjectId(m.joints),
  }));
  console.table(memberRows);

  warnDuplicateNosePositions(members);
  warnSharedJointsReferences(members);
}

function warnDuplicateNosePositions(members: SkeletonMemberData[]): void {
  const byNose = new Map<string, string[]>();

  members.forEach((m) => {
    const nose = m.joints?.nose;
    if (!nose || !Number.isFinite(nose.x) || !Number.isFinite(nose.y)) return;
    const key = `${nose.x.toFixed(5)},${nose.y.toFixed(5)}`;
    const id = m.estimatedMemberId ?? String(m.trackId ?? '?');
    const list = byNose.get(key) || [];
    list.push(id);
    byNose.set(key, list);
  });

  byNose.forEach((ids, key) => {
    if (ids.length > 1) {
      console.warn(
        '[ReferenceFrameRender] 동일 nose 좌표 — 멤버가 겹쳐 보일 수 있음',
        { nose: key, memberIds: ids },
      );
    }
  });
}

function warnSharedJointsReferences(members: SkeletonMemberData[]): void {
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i];
      const b = members[j];
      if (a.joints && b.joints && a.joints === b.joints) {
        console.error(
          '[ReferenceFrameRender] 얕은 복사 버그 — members가 같은 joints 객체 참조',
          {
            memberA: a.estimatedMemberId ?? a.trackId,
            memberB: b.estimatedMemberId ?? b.trackId,
          },
        );
      }
    }
  }
}

/** 세션 재시작 시 로그 스로틀 초기화 */
export function resetReferenceFrameRenderDebug(): void {
  lastLoggedFrameIndex = -1;
}

export default logReferenceFrameBeforeRender;
