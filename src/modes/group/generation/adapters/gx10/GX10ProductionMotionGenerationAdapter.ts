// @ts-nocheck
/**
 * Default GX10 Production Motion Generation Adapter (PHASE 20).
 * Delegates to injectable GX10AdapterBackendPort — no direct REST import.
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
} from '../ProductionMotionGenerationAdapter';
import type { GX10AdapterBackendPort } from './GX10AdapterBackendPort';

export class GX10ProductionMotionGenerationAdapter implements ProductionMotionGenerationAdapter {
  readonly adapterId = 'gx10';

  constructor(private readonly backend: GX10AdapterBackendPort) {
    if (!backend) {
      throw new Error('GX10ProductionMotionGenerationAdapter requires backend port');
    }
  }

  submitJob(input: AdapterSubmitInput): Promise<AdapterResult<AdapterSubmitData>> {
    return this.backend.submitJob(input);
  }

  pollJob(input: AdapterPollInput): Promise<AdapterResult<AdapterPollData>> {
    return this.backend.pollJob(input);
  }

  downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult<AdapterDownloadData>> {
    return this.backend.downloadMotion(input);
  }

  persistMotion(input: AdapterPersistInput): Promise<AdapterResult<AdapterPersistData>> {
    return this.backend.persistMotion(input);
  }

  registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult<AdapterRegisterAuthorityData>> {
    return this.backend.registerAuthority(input);
  }

  cancelJob(input: AdapterCancelInput): Promise<AdapterResult<{ cancelled: boolean }>> {
    return this.backend.cancelJob(input);
  }

  retryJob(input: AdapterRetryInput): Promise<AdapterResult<AdapterRetryData>> {
    return this.backend.retryJob(input);
  }
}

export default GX10ProductionMotionGenerationAdapter;
