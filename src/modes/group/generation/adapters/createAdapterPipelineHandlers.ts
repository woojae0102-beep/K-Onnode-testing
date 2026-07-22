// @ts-nocheck
/**
 * Maps Pipeline Stages → Adapter calls (PHASE 20).
 * Order: submit → poll → (internal stages) → download → persist → registerAuthority
 * Pipeline stage order is NOT changed.
 */
import type { ProductionMotionGenerationPipelineStage } from '../productionMotionGenerationPipelineContract';
import type {
  ProductionMotionGenerationPipelineHandlers,
  StageHandlerResult,
} from '../productionMotionGenerationPipelineStateMachine';
import type { ProductionMotionGenerationJobContext } from '../productionMotionGenerationJobContext';
import type { ProductionMotionGenerationAdapter } from './ProductionMotionGenerationAdapter';
import { AdapterExecutionStateStore } from './AdapterExecutionState';
import {
  ADAPTER_ERROR_CODES,
  requireDownloadComplete,
  requirePersistComplete,
  requirePollComplete,
  requireSubmitComplete,
  unwrapAdapterResult,
} from './adapterFailClosed';

const INTERNAL_POLL_STAGES: ProductionMotionGenerationPipelineStage[] = [
  'SKELETON_NORMALIZE',
  'MOTION_CLEANUP',
  'FOOT_LOCK_CORRECTION',
  'ROOT_MOTION_NORMALIZE',
  'ANIMATION_OPTIMIZATION',
  'ANIMATION_COMPRESSION',
];

function fail(code: string, message?: string, recoverable?: boolean): StageHandlerResult {
  return { ok: false, errorCode: code, message, recoverable };
}

export function createAdapterPipelineHandlers(
  adapter: ProductionMotionGenerationAdapter,
  stateStore: AdapterExecutionStateStore = new AdapterExecutionStateStore(),
): ProductionMotionGenerationPipelineHandlers {
  const log = (jobId: string, method: string) => {
    const s = stateStore.get(jobId);
    s.adapterCallLog.push(`${adapter.adapterId}:${method}`);
  };

  const handlers: ProductionMotionGenerationPipelineHandlers = {
    UPLOAD_VIDEO: async (ctx) => {
      log(ctx.jobId, 'submitJob');
      const result = await adapter.submitJob({
        job: ctx,
        inputVideoUrl: ctx.inputVideoUrl,
      });
      const unwrapped = unwrapAdapterResult(result, ADAPTER_ERROR_CODES.SUBMIT_FAILED);
      if (!unwrapped.ok) return fail(unwrapped.errorCode, unwrapped.message, unwrapped.recoverable);

      const state = stateStore.get(ctx.jobId);
      state.externalJobId = unwrapped.data.externalJobId;
      state.submitCompleted = true;
      return {
        ok: true,
        patch: {
          inputVideoUrl: ctx.inputVideoUrl || `adapter://${adapter.adapterId}/video/${ctx.videoId}`,
        },
      };
    },

    SKELETON_EXTRACTION: async (ctx) => {
      const pre = requireSubmitComplete(stateStore.get(ctx.jobId));
      if (!pre.ok) return fail(pre.errorCode!, pre.message);

      const state = stateStore.get(ctx.jobId);
      const maxPollAttempts = 10;

      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        log(ctx.jobId, 'pollJob');
        const result = await adapter.pollJob({
          job: ctx,
          externalJobId: state.externalJobId!,
        });
        const unwrapped = unwrapAdapterResult(result, ADAPTER_ERROR_CODES.POLL_FAILED);
        if (!unwrapped.ok) return fail(unwrapped.errorCode, unwrapped.message, unwrapped.recoverable);

        if (unwrapped.data.status === 'failed' || unwrapped.data.status === 'cancelled') {
          return fail(
            unwrapped.data.errorCode || ADAPTER_ERROR_CODES.POLL_FAILED,
            `poll status=${unwrapped.data.status}`,
            false,
          );
        }
        if (unwrapped.data.status === 'completed') {
          state.pollCompleted = true;
          return { ok: true };
        }
      }

      return fail(ADAPTER_ERROR_CODES.POLL_TIMEOUT, 'pollJob exceeded max attempts', true);
    },

    MOTION_GLB_EXPORT: async (ctx) => {
      const pre = requirePollComplete(stateStore.get(ctx.jobId));
      if (!pre.ok) return fail(pre.errorCode!, pre.message);

      log(ctx.jobId, 'downloadMotion');
      const state = stateStore.get(ctx.jobId);
      const result = await adapter.downloadMotion({
        job: ctx,
        externalJobId: state.externalJobId!,
      });
      const unwrapped = unwrapAdapterResult(result, ADAPTER_ERROR_CODES.DOWNLOAD_FAILED);
      if (!unwrapped.ok) return fail(unwrapped.errorCode, unwrapped.message, unwrapped.recoverable);

      state.downloadCompleted = true;
      state.motionGlbUrl = unwrapped.data.motionGlbUrl;
      return {
        ok: true,
        patch: { outputMotionGlbUrl: unwrapped.data.motionGlbUrl },
      };
    },

    STORAGE_UPLOAD: async (ctx) => {
      const pre = requireDownloadComplete(stateStore.get(ctx.jobId));
      if (!pre.ok) return fail(pre.errorCode!, pre.message);

      log(ctx.jobId, 'persistMotion');
      const state = stateStore.get(ctx.jobId);
      const result = await adapter.persistMotion({
        job: ctx,
        externalJobId: state.externalJobId!,
        motionGlbUrl: state.motionGlbUrl!,
      });
      const unwrapped = unwrapAdapterResult(result, ADAPTER_ERROR_CODES.PERSIST_FAILED);
      if (!unwrapped.ok) return fail(unwrapped.errorCode, unwrapped.message, unwrapped.recoverable);

      state.persistCompleted = true;
      state.storageUrl = unwrapped.data.storageUrl;
      state.productionMotionAssetId = unwrapped.data.productionMotionAssetId;
      return {
        ok: true,
        patch: {
          outputMotionGlbUrl: unwrapped.data.storageUrl,
          productionMotionAssetId: unwrapped.data.productionMotionAssetId,
        },
      };
    },

    FIRESTORE_METADATA: async (ctx) => {
      const state = stateStore.get(ctx.jobId);
      if (!state.persistCompleted) {
        return fail(ADAPTER_ERROR_CODES.PERSIST_FAILED, 'metadata requires persistMotion');
      }
      return { ok: true };
    },

    PRODUCTION_MOTION_ASSET_V2: async (ctx) => {
      const pre = requirePersistComplete(stateStore.get(ctx.jobId));
      if (!pre.ok) return fail(pre.errorCode!, pre.message);
      const state = stateStore.get(ctx.jobId);
      return {
        ok: true,
        patch: { productionMotionAssetId: state.productionMotionAssetId! },
      };
    },

    AUTHORITY_REGISTRATION: async (ctx) => {
      const pre = requirePersistComplete(stateStore.get(ctx.jobId));
      if (!pre.ok) return fail(pre.errorCode!, pre.message);

      log(ctx.jobId, 'registerAuthority');
      const state = stateStore.get(ctx.jobId);
      const result = await adapter.registerAuthority({
        job: ctx,
        externalJobId: state.externalJobId!,
        productionMotionAssetId: state.productionMotionAssetId!,
      });
      const unwrapped = unwrapAdapterResult(result, ADAPTER_ERROR_CODES.AUTHORITY_FAILED);
      if (!unwrapped.ok) return fail(unwrapped.errorCode, unwrapped.message, unwrapped.recoverable);
      if (unwrapped.data.authorityStatus !== 'registered') {
        return fail(ADAPTER_ERROR_CODES.AUTHORITY_FAILED, 'authority not registered', false);
      }

      state.authorityRegistered = true;
      return { ok: true, patch: { authorityStatus: 'registered' } };
    },

    READY: async (ctx) => {
      const state = stateStore.get(ctx.jobId);
      if (!state.authorityRegistered) {
        return fail(ADAPTER_ERROR_CODES.AUTHORITY_FAILED, 'READY blocked — authority not registered');
      }
      if (ctx.currentState === 'CANCELLED' || ctx.cancelled) {
        return fail(ADAPTER_ERROR_CODES.RESUME_AFTER_CANCEL, 'READY blocked — job cancelled');
      }
      return { ok: true };
    },
  };

  for (const stage of INTERNAL_POLL_STAGES) {
    handlers[stage] = async (ctx) => {
      const pre = requirePollComplete(stateStore.get(ctx.jobId));
      if (!pre.ok) return fail(pre.errorCode!, pre.message);
      return { ok: true };
    };
  }

  return handlers;
}

export { AdapterExecutionStateStore };

export default createAdapterPipelineHandlers;
