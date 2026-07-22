// @ts-nocheck
/**
 * In-memory GX10 backend for adapter tests (PHASE 20).
 * Mirrors stub flow — does NOT import lib/api-lib/gx10RestClient.
 */
import type { GX10AdapterBackendPort } from './gx10/GX10AdapterBackendPort';
import { StubProductionMotionGenerationAdapter } from '../StubProductionMotionGenerationAdapter';

/** Stub backend delegates to StubProductionMotionGenerationAdapter. */
export function createInMemoryGX10AdapterBackend(): GX10AdapterBackendPort {
  const stub = new StubProductionMotionGenerationAdapter();
  return {
    submitJob: (input) => stub.submitJob(input),
    pollJob: (input) => stub.pollJob(input),
    downloadMotion: (input) => stub.downloadMotion(input),
    persistMotion: (input) => stub.persistMotion(input),
    registerAuthority: (input) => stub.registerAuthority(input),
    cancelJob: (input) => stub.cancelJob(input),
    retryJob: (input) => stub.retryJob(input),
  };
}

export default createInMemoryGX10AdapterBackend;
