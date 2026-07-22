// @ts-nocheck
/**
 * GX10 adapter execution session (PHASE 21).
 * Per-job state between submit → poll → download → persist → authority.
 */
import { Buffer } from 'node:buffer';
export type GX10MemberMappingEntry = {
  memberId: string;
  memberName: string;
  memberOrder: number;
  avatarAssetId: string;
  avatarGlbUrl: string;
  avatarSkeletonProfile: string;
  avatarSkeletonVersion: string;
};

export type GX10BackendJobSession = {
  externalJobId: string | null;
  videoBuffer: Buffer | null;
  memberMapping: GX10MemberMappingEntry[];
  jobOutput: Record<string, unknown> | null;
  motionBuffer: Buffer | null;
  hydratedJobOutput: Record<string, unknown> | null;
  assetDraft: Record<string, unknown> | null;
  storageUrl: string | null;
  productionMotionAssetId: string | null;
  authorityRecordId: string | null;
  ingestedBy: string;
  metadataWritten: boolean;
  authorityRegistered: boolean;
};

export function createGx10BackendJobSession(ingestedBy = 'gx10-generation-pipeline'): GX10BackendJobSession {
  return {
    externalJobId: null,
    videoBuffer: null,
    memberMapping: [],
    jobOutput: null,
    motionBuffer: null,
    hydratedJobOutput: null,
    assetDraft: null,
    storageUrl: null,
    productionMotionAssetId: null,
    authorityRecordId: null,
    ingestedBy,
    metadataWritten: false,
    authorityRegistered: false,
  };
}

export class GX10BackendSessionStore {
  private sessions = new Map<string, GX10BackendJobSession>();

  get(jobId: string): GX10BackendJobSession {
    if (!this.sessions.has(jobId)) {
      this.sessions.set(jobId, createGx10BackendJobSession());
    }
    return this.sessions.get(jobId)!;
  }

  setJobInput(jobId: string, input: {
    videoBuffer?: Buffer | null;
    memberMapping?: GX10MemberMappingEntry[];
    ingestedBy?: string;
  }): GX10BackendJobSession {
    const session = this.get(jobId);
    if (input.videoBuffer) session.videoBuffer = input.videoBuffer;
    if (input.memberMapping?.length) session.memberMapping = input.memberMapping;
    if (input.ingestedBy) session.ingestedBy = input.ingestedBy;
    return session;
  }

  reset(jobId: string): void {
    this.sessions.delete(jobId);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export default GX10BackendSessionStore;
