// @ts-nocheck
/**
 * Stub Production Motion Generation Adapter (PHASE 20).
 * In-memory success path — no external processor.
 */
import type {
  ProductionMotionGenerationAdapter,
  AdapterCancelInput,
  AdapterDownloadInput,
  AdapterPersistInput,
  AdapterPollInput,
  AdapterRegisterAuthorityInput,
  AdapterResult,
  AdapterRetryInput,
  AdapterSubmitInput,
  AdapterSubmitData,
  AdapterPollData,
  AdapterDownloadData,
  AdapterPersistData,
  AdapterRegisterAuthorityData,
  AdapterRetryData,
} from './ProductionMotionGenerationAdapter';

export class StubProductionMotionGenerationAdapter implements ProductionMotionGenerationAdapter {
  readonly adapterId = 'stub';

  private pollCounts = new Map<string, number>();

  submitJob(input: AdapterSubmitInput): Promise<AdapterResult<AdapterSubmitData>> {
    const externalJobId = `stub-ext-${input.job.jobId}`;
    this.pollCounts.set(input.job.jobId, 0);
    return Promise.resolve({
      ok: true,
      data: { externalJobId, status: 'queued' },
    });
  }

  pollJob(input: AdapterPollInput): Promise<AdapterResult<AdapterPollData>> {
    const count = (this.pollCounts.get(input.job.jobId) || 0) + 1;
    this.pollCounts.set(input.job.jobId, count);
    return Promise.resolve({
      ok: true,
      data: { status: 'completed', progress: 100 },
    });
  }

  downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult<AdapterDownloadData>> {
    const { job } = input;
    return Promise.resolve({
      ok: true,
      data: {
        motionGlbUrl: `stub://motion/${job.groupId}/${job.songId}/${job.memberId}.glb`,
        byteLength: 1024,
      },
    });
  }

  persistMotion(input: AdapterPersistInput): Promise<AdapterResult<AdapterPersistData>> {
    const { job } = input;
    return Promise.resolve({
      ok: true,
      data: {
        storageUrl: `https://storage.stub/production-motion/${job.groupId}/${job.songId}/${job.jobId}/${job.memberId}.glb`,
        productionMotionAssetId: `prod-${job.groupId}-${job.songId}-${job.jobId}`,
        metadataWritten: true,
      },
    });
  }

  registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult<AdapterRegisterAuthorityData>> {
    return Promise.resolve({
      ok: true,
      data: {
        authorityStatus: 'registered',
        authorityRecordId: `auth-${input.productionMotionAssetId}`,
      },
    });
  }

  cancelJob(_input: AdapterCancelInput): Promise<AdapterResult<{ cancelled: boolean }>> {
    return Promise.resolve({ ok: true, data: { cancelled: true } });
  }

  retryJob(input: AdapterRetryInput): Promise<AdapterResult<AdapterRetryData>> {
    const externalJobId = `stub-ext-retry-${input.job.jobId}-${input.job.retryCount + 1}`;
    this.pollCounts.set(input.job.jobId, 0);
    return Promise.resolve({
      ok: true,
      data: { externalJobId, retryCount: input.job.retryCount + 1 },
    });
  }
}

export default StubProductionMotionGenerationAdapter;
