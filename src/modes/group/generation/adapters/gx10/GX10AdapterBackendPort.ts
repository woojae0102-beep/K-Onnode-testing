// @ts-nocheck
/**
 * GX10 Adapter Backend Port (PHASE 20).
 * Server-side REST wiring injects this — generation layer does not import gx10RestClient.
 */
import type {
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

export interface GX10AdapterBackendPort {
  submitJob(input: AdapterSubmitInput): Promise<AdapterResult<AdapterSubmitData>>;
  pollJob(input: AdapterPollInput): Promise<AdapterResult<AdapterPollData>>;
  downloadMotion(input: AdapterDownloadInput): Promise<AdapterResult<AdapterDownloadData>>;
  persistMotion(input: AdapterPersistInput): Promise<AdapterResult<AdapterPersistData>>;
  registerAuthority(input: AdapterRegisterAuthorityInput): Promise<AdapterResult<AdapterRegisterAuthorityData>>;
  cancelJob(input: AdapterCancelInput): Promise<AdapterResult<{ cancelled: boolean }>>;
  retryJob(input: AdapterRetryInput): Promise<AdapterResult<AdapterRetryData>>;
}

export default GX10AdapterBackendPort;
