/**
 * GX10 Production Motion orchestrator (PHASE 15).
 *
 * Submit → Poll → Download GLB → Validate → Persist (authority + Firestore).
 */
const { GX10RestClientError } = require('./gx10RestClient.cjs');
const {
  hydrateJobOutputWithStoredMotionUrls,
  persistProductionMotionAsset,
} = require('./gx10ProductionMotionPersist.cjs');

const JOBS_COLLECTION = 'gx10_production_motion_jobs';
const MAX_FINALIZE_ATTEMPTS = Number(process.env.GX10_FINALIZE_MAX_ATTEMPTS || 3);

async function saveJobRecord(admin, jobId, data) {
  if (!admin) return;
  await admin.firestore().collection(JOBS_COLLECTION).doc(jobId).set({
    ...data,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function loadJobRecord(admin, jobId) {
  if (!admin) return null;
  const snap = await admin.firestore().collection(JOBS_COLLECTION).doc(jobId).get();
  return snap.exists ? snap.data() : null;
}

async function submitGx10ProductionMotionJob(admin, client, input) {
  const productionAssetId = input.productionAssetId || `${input.groupId}__${input.songId}`;
  const submitted = await client.submitJob({
    groupId: input.groupId,
    songId: input.songId,
    productionAssetId,
    fps: input.fps || 30,
    memberMapping: input.memberMapping,
    sourceVideoMetadata: input.sourceVideoMetadata,
    markAsRealProduction: true,
    videoBuffer: input.videoBuffer,
    videoFilename: input.videoFilename,
  });

  const record = {
    jobId: submitted.jobId,
    groupId: input.groupId,
    songId: input.songId,
    productionAssetId: submitted.productionAssetId || productionAssetId,
    status: submitted.status || 'queued',
    gx10Status: submitted.status || 'queued',
    createdAt: submitted.createdAt || new Date().toISOString(),
    createdBy: input.createdBy,
    memberMapping: input.memberMapping,
    finalizeAttempts: 0,
  };
  await saveJobRecord(admin, submitted.jobId, record);
  return record;
}

async function refreshGx10JobStatus(admin, client, jobId) {
  const status = await client.getJobStatus(jobId);
  const existing = (await loadJobRecord(admin, jobId)) || { jobId };
  const record = {
    ...existing,
    jobId,
    status: status.status,
    gx10Status: status.status,
    progress: status.progress,
    errorCode: status.errorCode,
    message: status.message,
    productionAssetId: status.productionAssetId || existing.productionAssetId,
  };
  await saveJobRecord(admin, jobId, record);
  return record;
}

async function cancelGx10ProductionMotionJob(admin, client, jobId) {
  const cancelled = await client.cancelJob(jobId);
  const record = {
    ...(await loadJobRecord(admin, jobId)),
    jobId,
    status: 'cancelled',
    gx10Status: cancelled.status || 'cancelled',
    cancelledAt: new Date().toISOString(),
  };
  await saveJobRecord(admin, jobId, record);
  return record;
}

async function finalizeGx10ProductionMotionJob(admin, client, jobId, ingestedBy) {
  const existing = (await loadJobRecord(admin, jobId)) || {};
  const attempts = Number(existing.finalizeAttempts || 0) + 1;

  await saveJobRecord(admin, jobId, {
    ...existing,
    jobId,
    status: 'persisting',
    finalizeAttempts: attempts,
  });

  try {
    const jobOutput = await client.getJobResult(jobId);
    const hydrated = await hydrateJobOutputWithStoredMotionUrls(admin, client, {
      ...jobOutput,
      jobId: jobOutput.jobId || jobId,
      status: 'completed',
      markAsRealProduction: true,
    });

    const persisted = await persistProductionMotionAsset(admin, {
      jobOutput: hydrated,
      ingestedBy,
    });

    const record = {
      ...existing,
      jobId,
      status: 'persisted',
      gx10Status: 'completed',
      productionAssetId: persisted.productionAssetId,
      persistedAt: new Date().toISOString(),
      finalizeAttempts: attempts,
      asset: persisted.asset,
    };
    await saveJobRecord(admin, jobId, record);
    return record;
  } catch (err) {
    const recoverable = attempts < MAX_FINALIZE_ATTEMPTS;
    await saveJobRecord(admin, jobId, {
      ...existing,
      jobId,
      status: recoverable ? 'persist_failed' : 'failed',
      gx10Status: existing.gx10Status || 'completed',
      errorCode: err?.code || 'GX10_FINALIZE_FAILED',
      message: err?.message || String(err),
      finalizeAttempts: attempts,
      recoverable,
    });
    throw err;
  }
}

async function pollAndFinalizeGx10Job(admin, client, jobId, options = {}) {
  const status = await client.pollUntilComplete(jobId, {
    pollTimeoutMs: options.pollTimeoutMs,
    pollIntervalMs: options.pollIntervalMs,
    onPoll: async (pollStatus) => {
      await saveJobRecord(admin, jobId, {
        ...(await loadJobRecord(admin, jobId)),
        jobId,
        status: pollStatus.status,
        gx10Status: pollStatus.status,
        progress: pollStatus.progress,
      });
    },
  });

  await saveJobRecord(admin, jobId, {
    ...(await loadJobRecord(admin, jobId)),
    jobId,
    status: status.status,
    gx10Status: status.status,
    progress: status.progress,
    productionAssetId: status.productionAssetId,
  });

  return finalizeGx10ProductionMotionJob(admin, client, jobId, options.ingestedBy);
}

async function recoverGx10ProductionMotionJob(admin, client, jobId, ingestedBy) {
  const existing = await loadJobRecord(admin, jobId);
  if (!existing) {
    throw new GX10RestClientError('GX10_JOB_NOT_FOUND', `job ${jobId} not found in Firestore`, { jobId });
  }
  if (existing.status === 'persisted') {
    return existing;
  }
  if (existing.finalizeAttempts >= MAX_FINALIZE_ATTEMPTS) {
    throw new GX10RestClientError('GX10_FINALIZE_EXHAUSTED', `finalize attempts exhausted for ${jobId}`, { jobId });
  }
  return finalizeGx10ProductionMotionJob(admin, client, jobId, ingestedBy);
}

async function runGx10ProductionMotionPipeline(admin, client, input) {
  const submitted = await submitGx10ProductionMotionJob(admin, client, input);
  try {
    return await pollAndFinalizeGx10Job(admin, client, submitted.jobId, {
      ingestedBy: input.createdBy,
      pollTimeoutMs: input.pollTimeoutMs,
      pollIntervalMs: input.pollIntervalMs,
    });
  } catch (err) {
    if (err instanceof GX10RestClientError && err.code === 'GX10_POLL_TIMEOUT') {
      await saveJobRecord(admin, submitted.jobId, {
        ...(await loadJobRecord(admin, submitted.jobId)),
        status: 'processing',
        errorCode: err.code,
        message: err.message,
        recoverable: true,
      });
    }
    throw err;
  }
}

module.exports = {
  JOBS_COLLECTION,
  MAX_FINALIZE_ATTEMPTS,
  submitGx10ProductionMotionJob,
  refreshGx10JobStatus,
  cancelGx10ProductionMotionJob,
  finalizeGx10ProductionMotionJob,
  pollAndFinalizeGx10Job,
  recoverGx10ProductionMotionJob,
  runGx10ProductionMotionPipeline,
  loadJobRecord,
};
