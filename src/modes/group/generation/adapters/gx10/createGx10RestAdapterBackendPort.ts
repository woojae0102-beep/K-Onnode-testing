// @ts-nocheck
/**
 * Real GX10 REST Adapter Backend Port (PHASE 21).
 * Delegates to lib/api-lib gx10RestClient + gx10ProductionMotionPersist — Pipeline never imports REST directly.
 */
import { createRequire } from 'node:module';
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
import {
  GX10BackendSessionStore,
  type GX10MemberMappingEntry,
} from './GX10BackendSessionStore';
import { gx10ErrorToAdapterResult } from './gx10AdapterErrorMapping';

const require = createRequire(import.meta.url);
const { GX10RestClient, createGX10RestClientFromEnv } = require('../../../../../../lib/api-lib/gx10RestClient.cjs');
const {
  mapJobOutputToProductionMotionAssetV2,
  uploadMotionGlbToStorage,
  buildAuthorityRecords,
  writeProductionMotionFirestoreRecords,
} = require('../../../../../../lib/api-lib/gx10ProductionMotionPersist.cjs');
const { validateGX10JobOutputContract } = require('../../../../../../lib/api-lib/gx10ProcessorOutputValidation.cjs');
const { normalizeJobStatus } = require('../../../../../../lib/api-lib/gx10RestApiContract.cjs');

export type Gx10RestAdapterBackendOptions = {
  client?: InstanceType<typeof GX10RestClient>;
  admin?: { firestore: () => { collection: (name: string) => { doc: (id: string) => { set: (data: unknown, opts?: unknown) => Promise<void> } } } } | null;
  sessionStore?: GX10BackendSessionStore;
  ingestedBy?: string;
};

function defaultMemberMapping(job: AdapterSubmitInput['job']): GX10MemberMappingEntry[] {
  return [{
    memberId: job.memberId,
    memberName: job.memberId,
    memberOrder: 0,
    avatarAssetId: `${job.groupId}__${job.memberId}`,
    avatarGlbUrl: job.inputVideoUrl?.startsWith('http') ? job.inputVideoUrl : `https://storage.stub/avatars/${job.groupId}/${job.memberId}.glb`,
    avatarSkeletonProfile: 'RPM',
    avatarSkeletonVersion: '1.0',
  }];
}

export function createGx10RestAdapterBackendPort(
  options: Gx10RestAdapterBackendOptions = {},
): GX10AdapterBackendPort {
  const client = options.client ?? createGX10RestClientFromEnv();
  const admin = options.admin ?? null;
  const sessions = options.sessionStore ?? new GX10BackendSessionStore();
  const defaultIngestedBy = options.ingestedBy ?? 'gx10-generation-pipeline';

  return {
    async submitJob(input: AdapterSubmitInput): Promise<AdapterResult> {
      try {
        const session = sessions.get(input.job.jobId);
        if (!session.ingestedBy) session.ingestedBy = defaultIngestedBy;
        const memberMapping = session.memberMapping.length
          ? session.memberMapping
          : defaultMemberMapping(input.job);
        session.memberMapping = memberMapping;

        if (!session.videoBuffer?.length) {
          return {
            ok: false,
            errorCode: ADAPTER_ERROR_CODES.SUBMIT_FAILED,
            message: 'videoBuffer missing — call sessionStore.setJobInput before execute',
            recoverable: false,
          };
        }

        const submitted = await client.submitJob({
          groupId: input.job.groupId,
          songId: input.job.songId,
          productionAssetId: `${input.job.groupId}__${input.job.songId}`,
          fps: 30,
          memberMapping,
          markAsRealProduction: true,
          videoBuffer: session.videoBuffer,
          videoFilename: `${input.job.videoId || input.job.jobId}.mp4`,
          sourceVideoMetadata: {
            durationSec: 30,
            fps: 30,
            sourceType: 'uploaded_video',
          },
        });

        session.externalJobId = submitted.jobId;
        return {
          ok: true,
          data: {
            externalJobId: submitted.jobId,
            status: normalizeJobStatus(submitted.status) === 'queued' ? 'queued' : 'processing',
          },
        };
      } catch (err) {
        return gx10ErrorToAdapterResult(err);
      }
    },

    async pollJob(input: AdapterPollInput): Promise<AdapterResult> {
      try {
        const status = await client.getJobStatus(input.externalJobId);
        const normalized = normalizeJobStatus(status.status);
        return {
          ok: true,
          data: {
            status: normalized,
            progress: status.progress,
            errorCode: status.errorCode,
          },
        };
      } catch (err) {
        return gx10ErrorToAdapterResult(err);
      }
    },

    async downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult> {
      try {
        const session = sessions.get(input.job.jobId);
        const jobOutput = await client.getJobResult(input.externalJobId);
        session.jobOutput = jobOutput;

        const buffer = await client.downloadMemberMotionGlb(input.externalJobId, input.job.memberId);
        session.motionBuffer = buffer;

        const motionGlbUrl = `gx10://local/${input.externalJobId}/${input.job.memberId}.glb`;
        return {
          ok: true,
          data: { motionGlbUrl, byteLength: buffer.length },
        };
      } catch (err) {
        return gx10ErrorToAdapterResult(err);
      }
    },

    async persistMotion(input: AdapterPersistInput): Promise<AdapterResult> {
      try {
        const session = sessions.get(input.job.jobId);
        if (!session.jobOutput || !session.motionBuffer?.length) {
          return {
            ok: false,
            errorCode: ADAPTER_ERROR_CODES.PERSIST_FAILED,
            message: 'downloadMotion must complete before persist',
            recoverable: false,
          };
        }

        let motionUrl = input.motionGlbUrl;
        if (admin) {
          motionUrl = await uploadMotionGlbToStorage(admin, {
            groupId: input.job.groupId,
            songId: input.job.songId,
            memberId: input.job.memberId,
            jobId: input.externalJobId,
            buffer: session.motionBuffer,
          });
        } else {
          motionUrl = `https://storage.stub/production-motion/${input.job.groupId}/${input.job.songId}/${input.externalJobId}/${input.job.memberId}.glb`;
        }

        const members = (session.jobOutput.members || []).map((m: Record<string, unknown>) => {
          if (m.memberId === input.job.memberId) {
            return { ...m, motionUrl };
          }
          return m;
        });
        const hydrated = { ...session.jobOutput, members, status: 'completed' };
        session.hydratedJobOutput = hydrated;
        session.storageUrl = motionUrl;

        validateGX10JobOutputContract(hydrated, 'real_production');
        const asset = mapJobOutputToProductionMotionAssetV2(hydrated);
        session.assetDraft = asset;
        session.productionMotionAssetId = asset.productionAssetId;
        session.metadataWritten = Boolean(admin);

        if (admin) {
          const { computeGX10MemberOutputChecksumSync } = require('../../../../../../lib/api-lib/gx10MemberOutputChecksum.cjs');
          hydrated.members = hydrated.members.map((m: Record<string, unknown>) => ({
            ...m,
            checksum: computeGX10MemberOutputChecksumSync(m),
          }));
          session.assetDraft = mapJobOutputToProductionMotionAssetV2(hydrated);
        }

        return {
          ok: true,
          data: {
            storageUrl: motionUrl,
            productionMotionAssetId: asset.productionAssetId,
            metadataWritten: session.metadataWritten,
          },
        };
      } catch (err) {
        return gx10ErrorToAdapterResult(err);
      }
    },

    async registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult> {
      try {
        const session = sessions.get(input.job.jobId);
        if (!session.assetDraft || !session.hydratedJobOutput) {
          return {
            ok: false,
            errorCode: ADAPTER_ERROR_CODES.AUTHORITY_FAILED,
            message: 'persistMotion must complete before authority registration',
            recoverable: false,
          };
        }

        if (!admin) {
          session.authorityRegistered = true;
          session.authorityRecordId = input.productionMotionAssetId;
          return {
            ok: true,
            data: {
              authorityStatus: 'registered',
              authorityRecordId: input.productionMotionAssetId,
            },
          };
        }

        const { asset: signedAsset, authorityRecord } = buildAuthorityRecords(
          { ...session.assetDraft },
          session.hydratedJobOutput,
          session.ingestedBy,
        );

        await writeProductionMotionFirestoreRecords(
          admin,
          signedAsset,
          authorityRecord,
          session.ingestedBy,
          session.hydratedJobOutput,
        );

        session.authorityRegistered = true;
        session.authorityRecordId = authorityRecord.authorityRecordId || input.productionMotionAssetId;

        return {
          ok: true,
          data: {
            authorityStatus: 'registered',
            authorityRecordId: session.authorityRecordId,
          },
        };
      } catch (err) {
        return gx10ErrorToAdapterResult(err);
      }
    },

    async cancelJob(input: AdapterCancelInput): Promise<AdapterResult> {
      try {
        const session = sessions.get(input.job.jobId);
        const jobId = input.externalJobId || session.externalJobId;
        if (!jobId) {
          return { ok: true, data: { cancelled: true } };
        }
        await client.cancelJob(jobId);
        return { ok: true, data: { cancelled: true } };
      } catch (err) {
        return gx10ErrorToAdapterResult(err);
      }
    },

    async retryJob(input: AdapterRetryInput): Promise<AdapterResult> {
      sessions.reset(input.job.jobId);
      return {
        ok: true,
        data: {
          externalJobId: `retry-pending-${input.job.jobId}`,
          retryCount: input.job.retryCount + 1,
        },
      };
    },
  };
}

export default createGx10RestAdapterBackendPort;
