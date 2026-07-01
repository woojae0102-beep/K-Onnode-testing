// @ts-nocheck
import type { ChoreographyDataset } from '../types/groupChoreography';

const cache = new Map<string, ChoreographyDataset>();
const inflight = new Map<string, Promise<ChoreographyDataset>>();

/**
 * 그룹 안무 JSON을 lazy load + 메모리 캐시.
 * 경로 규칙: /data/choreography/{groupId}-{songId}.json
 */
export async function loadChoreographyDataset(
  groupId: string,
  songId: string,
  options: { force?: boolean } = {},
): Promise<ChoreographyDataset> {
  const key = `${groupId}:${songId}`;
  if (!options.force && cache.has(key)) return cache.get(key)!;
  if (!options.force && inflight.has(key)) return inflight.get(key)!;

  const url = `/data/choreography/${groupId}-${songId}.json`;
  const promise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Choreography dataset not found: ${url}`);
      const data = (await res.json()) as ChoreographyDataset;
      validateDataset(data);
      cache.set(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function getCachedChoreographyDataset(groupId: string, songId: string) {
  return cache.get(`${groupId}:${songId}`) || null;
}

export function clearChoreographyCache() {
  cache.clear();
}

function validateDataset(data: ChoreographyDataset) {
  if (!data?.meta?.groupId || !data?.meta?.songId) {
    throw new Error('Invalid choreography dataset: meta.groupId/songId required');
  }
  if (!Array.isArray(data.members) || !Array.isArray(data.frames)) {
    throw new Error('Invalid choreography dataset: members/frames arrays required');
  }
}

/** SkeletonFrameData(2D 추출) → ChoreographyDataset 변환 (기존 파이프라인 호환) */
export function skeletonFramesToChoreographyDataset({
  groupId,
  songId,
  title,
  formation = 'diamond',
  memberMeta,
  frames,
  durationSec,
}: {
  groupId: string;
  songId: string;
  title?: string;
  formation?: ChoreographyDataset['meta']['formation'];
  memberMeta: ChoreographyDataset['members'];
  frames: Array<{ timestamp: number; members: Array<{ estimatedMemberId: string; isEstimated?: boolean; joints: Record<string, { x: number; y: number; z?: number; visibility?: number }> }> }>;
  durationSec: number;
  sampleFps?: number;
}): ChoreographyDataset {
  const fps = sampleFps || 15;
  return {
    meta: {
      groupId,
      songId,
      title,
      formation,
      durationSec,
      fps,
      version: '1',
      preserveVideoFormation: true,
    },
    members: memberMeta,
    frames: frames.map((frame) => ({
      timestamp: frame.timestamp,
      members: frame.members
        .filter((m) => m.estimatedMemberId)
        .map((m) => ({
          memberId: m.estimatedMemberId,
          isEstimated: m.isEstimated ?? false,
          joints: Object.fromEntries(
            Object.entries(m.joints || {}).map(([name, j]) => [
              name,
              { x: j.x, y: j.y, z: j.z ?? 0, visibility: j.visibility ?? 1 },
            ]),
          ),
        })),
    })),
  };
}
