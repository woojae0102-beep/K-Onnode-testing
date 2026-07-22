// @ts-nocheck
/**
 * Mock GX10 Adapter Backend Port (PHASE 21 — TEST 226+).
 * Simulates GX10 REST + persist without real network or Firebase.
 */
import { Buffer } from 'node:buffer';
import type { GX10AdapterBackendPort } from './GX10AdapterBackendPort';
import type {
  AdapterCancelInput,
  AdapterDownloadInput,
  AdapterPersistInput,
  AdapterPollInput,
  AdapterRegisterAuthorityInput,
  AdapterResult,
  AdapterRetryInput,
  AdapterSubmitInput,
} from '../ProductionMotionGenerationAdapter';
import { ADAPTER_ERROR_CODES } from '../adapterFailClosed';
import { GX10BackendSessionStore } from './GX10BackendSessionStore';

export type MockGx10BackendOptions = {
  sessionStore?: GX10BackendSessionStore;
  failAt?: 'submit' | 'poll' | 'download' | 'persist' | 'authority';
  pollProcessingTicks?: number;
  pollTimeoutAfter?: number;
};

export function createMockGx10AdapterBackendPort(
  options: MockGx10BackendOptions = {},
): GX10AdapterBackendPort & { callOrder: string[]; pollCalls: number } {
  const sessions = options.sessionStore ?? new GX10BackendSessionStore();
  const callOrder: string[] = [];
  let pollCalls = 0;
  let externalSeq = 0;

  const record = (method: string) => {
    callOrder.push(method);
  };

  return {
    callOrder,
    get pollCalls() {
      return pollCalls;
    },

    async submitJob(input: AdapterSubmitInput): Promise<AdapterResult> {
      record('submitJob');
      if (options.failAt === 'submit') {
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.SUBMIT_FAILED, recoverable: true };
      }
      const session = sessions.get(input.job.jobId);
      externalSeq += 1;
      session.externalJobId = `mock-gx10-job-${externalSeq}`;
      return {
        ok: true,
        data: { externalJobId: session.externalJobId!, status: 'queued' },
      };
    },

    async pollJob(input: AdapterPollInput): Promise<AdapterResult> {
      record('pollJob');
      pollCalls += 1;
      if (options.failAt === 'poll') {
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.POLL_TIMEOUT, recoverable: true };
      }
      if (options.pollTimeoutAfter != null && pollCalls > options.pollTimeoutAfter) {
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.POLL_TIMEOUT, recoverable: true };
      }
      const ticks = options.pollProcessingTicks ?? 1;
      if (pollCalls <= ticks) {
        return { ok: true, data: { status: 'processing', progress: 40 } };
      }
      return { ok: true, data: { status: 'completed', progress: 100 } };
    },

    async downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult> {
      record('downloadMotion');
      if (options.failAt === 'download') {
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.DOWNLOAD_FAILED, recoverable: true };
      }
      const session = sessions.get(input.job.jobId);
      session.motionBuffer = Buffer.from('mock-gltf-motion-bytes');
      session.jobOutput = {
        contractVersion: 1,
        jobId: input.externalJobId,
        status: 'completed',
        productionAssetId: `prod-${input.job.groupId}-${input.job.songId}`,
        groupId: input.job.groupId,
        songId: input.job.songId,
        fps: 30,
        provider: 'gx10',
        processorVersion: 'mock-1.0',
        generatedAt: new Date().toISOString(),
        markAsRealProduction: true,
        members: [{
          memberId: input.job.memberId,
          memberName: input.job.memberId,
          avatarAssetId: `av-${input.job.memberId}`,
          avatarGlbUrl: `https://storage.mock/avatar/${input.job.memberId}.glb`,
          avatarSkeletonProfile: 'RPM',
          avatarSkeletonVersion: '1.0',
          motionAssetId: `motion-${input.job.memberId}`,
          motionUrl: 'pending',
          duration: 30,
          animationClipName: 'Dance',
          sourceSkeletonProfile: 'MIXAMO',
          sourceSkeletonVersion: '1.0',
          checksum: 'mock-checksum',
        }],
      };
      const motionGlbUrl = `https://storage.mock/motion/${input.externalJobId}/${input.job.memberId}.glb`;
      return { ok: true, data: { motionGlbUrl, byteLength: session.motionBuffer.length } };
    },

    async persistMotion(input: AdapterPersistInput): Promise<AdapterResult> {
      record('persistMotion');
      if (options.failAt === 'persist') {
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.PERSIST_FAILED, recoverable: true };
      }
      const session = sessions.get(input.job.jobId);
      const productionMotionAssetId = `prod-${input.job.groupId}-${input.job.songId}-${input.externalJobId}`;
      session.productionMotionAssetId = productionMotionAssetId;
      session.storageUrl = `https://storage.mock/production-motion/${input.job.groupId}/${input.job.songId}/${input.job.memberId}.glb`;
      session.metadataWritten = true;
      return {
        ok: true,
        data: {
          storageUrl: session.storageUrl,
          productionMotionAssetId,
          metadataWritten: true,
        },
      };
    },

    async registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult> {
      record('registerAuthority');
      if (options.failAt === 'authority') {
        return { ok: false, errorCode: ADAPTER_ERROR_CODES.AUTHORITY_FAILED, recoverable: false };
      }
      const session = sessions.get(input.job.jobId);
      session.authorityRegistered = true;
      session.authorityRecordId = input.productionMotionAssetId;
      return {
        ok: true,
        data: {
          authorityStatus: 'registered',
          authorityRecordId: input.productionMotionAssetId,
        },
      };
    },

    async cancelJob(input: AdapterCancelInput): Promise<AdapterResult> {
      record('cancelJob');
      return { ok: true, data: { cancelled: true } };
    },

    async retryJob(input: AdapterRetryInput): Promise<AdapterResult> {
      record('retryJob');
      pollCalls = 0;
      sessions.reset(input.job.jobId);
      externalSeq += 1;
      return {
        ok: true,
        data: {
          externalJobId: `mock-gx10-retry-${externalSeq}`,
          retryCount: input.job.retryCount + 1,
        },
      };
    },
  };
}

export default createMockGx10AdapterBackendPort;
