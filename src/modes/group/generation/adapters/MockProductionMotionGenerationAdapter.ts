// @ts-nocheck
/**
 * Mock Production Motion Generation Adapter (PHASE 20 — TEST 209+).
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
} from './ProductionMotionGenerationAdapter';
import { StubProductionMotionGenerationAdapter } from './StubProductionMotionGenerationAdapter';

export type MockAdapterOptions = {
  failAt?: 'submit' | 'poll' | 'download' | 'persist' | 'authority';
  pollReturnsProcessingFirst?: boolean;
};

export class MockProductionMotionGenerationAdapter implements ProductionMotionGenerationAdapter {
  readonly adapterId: string;
  readonly callOrder: string[] = [];
  private pollCounts = new Map<string, number>();
  private inner: StubProductionMotionGenerationAdapter;

  constructor(
    adapterId = 'mock-gx10',
    private options: MockAdapterOptions = {},
  ) {
    this.adapterId = adapterId;
    this.inner = new StubProductionMotionGenerationAdapter();
  }

  private record(method: string) {
    this.callOrder.push(method);
  }

  async submitJob(input: AdapterSubmitInput): Promise<AdapterResult> {
    this.record('submitJob');
    if (this.options.failAt === 'submit') {
      return { ok: false, errorCode: 'ADAPTER_SUBMIT_FAILED', recoverable: true };
    }
    return this.inner.submitJob(input);
  }

  async pollJob(input: AdapterPollInput): Promise<AdapterResult> {
    this.record('pollJob');
    if (this.options.failAt === 'poll') {
      return { ok: false, errorCode: 'ADAPTER_POLL_TIMEOUT', recoverable: true };
    }
    if (this.options.pollReturnsProcessingFirst) {
      const n = (this.pollCounts.get(input.job.jobId) || 0) + 1;
      this.pollCounts.set(input.job.jobId, n);
      if (n === 1) {
        return { ok: true, data: { status: 'processing', progress: 40 } };
      }
    }
    return this.inner.pollJob(input);
  }

  async downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult> {
    this.record('downloadMotion');
    if (this.options.failAt === 'download') {
      return { ok: false, errorCode: 'ADAPTER_DOWNLOAD_FAILED', recoverable: true };
    }
    return this.inner.downloadMotion(input);
  }

  async persistMotion(input: AdapterPersistInput): Promise<AdapterResult> {
    this.record('persistMotion');
    if (this.options.failAt === 'persist') {
      return { ok: false, errorCode: 'ADAPTER_PERSIST_FAILED', recoverable: false };
    }
    return this.inner.persistMotion(input);
  }

  async registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult> {
    this.record('registerAuthority');
    if (this.options.failAt === 'authority') {
      return { ok: false, errorCode: 'ADAPTER_AUTHORITY_FAILED', recoverable: false };
    }
    return this.inner.registerAuthority(input);
  }

  async cancelJob(input: AdapterCancelInput): Promise<AdapterResult> {
    this.record('cancelJob');
    return this.inner.cancelJob(input);
  }

  async retryJob(input: AdapterRetryInput): Promise<AdapterResult> {
    this.record('retryJob');
    return this.inner.retryJob(input);
  }
}

export default MockProductionMotionGenerationAdapter;
