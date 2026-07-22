// @ts-nocheck
/**
 * GX10 Production Motion Admin API client (PHASE 15).
 * Server proxy only — GX10_API_KEY never exposed to browser.
 */
const API = '/api/group?path=gx10-production-motion';

export type GX10MemberMappingInput = {
  memberId: string;
  memberName: string;
  memberOrder: number;
  avatarAssetId: string;
  avatarGlbUrl: string;
  avatarSkeletonProfile: string;
  avatarSkeletonVersion: string;
};

export type GX10CreateJobInput = {
  groupId: string;
  songId: string;
  productionAssetId?: string;
  fps?: number;
  memberMapping: GX10MemberMappingInput[];
  sourceVideoMetadata?: {
    durationSec: number;
    fps: number;
    sourceType: string;
  };
  videoFile?: File;
};

export async function probeGx10ProductionMotionApi(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}&action=probe`);
  return res.json();
}

export async function createGx10ProductionMotionJob(input: GX10CreateJobInput): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('groupId', input.groupId);
  form.append('songId', input.songId);
  if (input.productionAssetId) form.append('productionAssetId', input.productionAssetId);
  form.append('fps', String(input.fps ?? 30));
  form.append('memberMapping', JSON.stringify(input.memberMapping));
  if (input.sourceVideoMetadata) {
    form.append('sourceVideoMetadata', JSON.stringify(input.sourceVideoMetadata));
  }
  if (input.videoFile) form.append('video', input.videoFile);

  const res = await fetch(`${API}&action=create`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.hint || `GX10 create failed (${res.status})`);
  return data;
}

export async function getGx10ProductionMotionJobStatus(
  jobId: string,
  autoFinalize = false,
): Promise<Record<string, unknown>> {
  const qs = autoFinalize ? '&autoFinalize=1' : '';
  const res = await fetch(`${API}&action=status&jobId=${encodeURIComponent(jobId)}${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.hint || `GX10 status failed (${res.status})`);
  return data;
}

export async function cancelGx10ProductionMotionJob(jobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}&action=cancel&jobId=${encodeURIComponent(jobId)}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.hint || `GX10 cancel failed (${res.status})`);
  return data;
}

export async function finalizeGx10ProductionMotionJob(jobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}&action=finalize&jobId=${encodeURIComponent(jobId)}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.hint || `GX10 finalize failed (${res.status})`);
  return data;
}

export async function recoverGx10ProductionMotionJob(jobId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}&action=recover&jobId=${encodeURIComponent(jobId)}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.hint || `GX10 recover failed (${res.status})`);
  return data;
}

export default probeGx10ProductionMotionApi;
