// @ts-nocheck
/**
 * DeepMotion Adapter placeholder (PHASE 20 — not connected to Production Runtime).
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
} from '../ProductionMotionGenerationAdapter';

const NOT_CONNECTED = {
  ok: false as const,
  errorCode: 'DEEPMOTION_ADAPTER_NOT_CONNECTED',
  message: 'DeepMotion adapter is not connected to Production Generation Pipeline',
  recoverable: false,
};

export class DeepMotionProductionMotionGenerationAdapter implements ProductionMotionGenerationAdapter {
  readonly adapterId = 'deepmotion';

  submitJob(_input: AdapterSubmitInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }

  pollJob(_input: AdapterPollInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }

  downloadMotion(_input: AdapterDownloadInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }

  persistMotion(_input: AdapterPersistInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }

  registerAuthority(_input: AdapterRegisterAuthorityInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }

  cancelJob(_input: AdapterCancelInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }

  retryJob(_input: AdapterRetryInput): Promise<AdapterResult> {
    return Promise.resolve(NOT_CONNECTED);
  }
}

export default DeepMotionProductionMotionGenerationAdapter;
