/**
 * GX10 Production Motion — Admin API proxy (PHASE 15).
 *
 * env: GX10_API_URL, GX10_API_KEY
 * optional: GX10_API_TIMEOUT_MS, GX10_POLL_TIMEOUT_MS, GX10_API_MAX_RETRIES
 *
 * Actions (query param action=):
 *   probe   GET  — config + health
 *   create  POST — submit job
 *   status  GET  — poll GX10 + update Firestore (?jobId=)
 *   cancel  POST — cancel job (?jobId=)
 *   finalize POST — download GLB + persist production asset (?jobId=)
 *   recover POST — retry finalize for persist_failed (?jobId=)
 *   run     POST — submit + poll + finalize (long-running)
 */
const { requireAdmin } = require('../../api-lib/firebaseAuth.cjs');
const { getAdmin } = require('../../api-lib/firebaseAdmin.cjs');
const { parseMultipart } = require('./mocapMultipart.cjs');
const { createGX10RestClientFromEnv, GX10RestClientError } = require('../../api-lib/gx10RestClient.cjs');
const {
  submitGx10ProductionMotionJob,
  refreshGx10JobStatus,
  cancelGx10ProductionMotionJob,
  finalizeGx10ProductionMotionJob,
  recoverGx10ProductionMotionJob,
  runGx10ProductionMotionPipeline,
  loadJobRecord,
} = require('../../api-lib/gx10ProductionMotionOrchestrator.cjs');

async function readRawBody(req) {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRawBody(req);
  if (!raw?.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return {};
  }
}

async function parseCreateBody(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const raw = await readRawBody(req);
    const { fields, files } = parseMultipart(raw, contentType);
    let memberMapping = [];
    if (fields.memberMapping) {
      try { memberMapping = JSON.parse(fields.memberMapping); } catch { memberMapping = []; }
    }
    let sourceVideoMetadata;
    if (fields.sourceVideoMetadata) {
      try { sourceVideoMetadata = JSON.parse(fields.sourceVideoMetadata); } catch { /* ignore */ }
    }
    return {
      groupId: fields.groupId,
      songId: fields.songId,
      productionAssetId: fields.productionAssetId,
      fps: Number(fields.fps) || 30,
      memberMapping,
      sourceVideoMetadata,
      videoBuffer: files.video?.data || files.file?.data || null,
      videoFilename: files.video?.filename || files.file?.filename || 'upload.mp4',
    };
  }

  const body = await readJsonBody(req);
  let videoBuffer = null;
  if (body.videoBase64) videoBuffer = Buffer.from(String(body.videoBase64), 'base64');
  return {
    groupId: body.groupId,
    songId: body.songId,
    productionAssetId: body.productionAssetId,
    fps: Number(body.fps) || 30,
    memberMapping: body.memberMapping || [],
    sourceVideoMetadata: body.sourceVideoMetadata,
    videoBuffer,
    videoFilename: body.videoFilename || 'upload.mp4',
  };
}

function keyMissing(res) {
  return res.status(501).json({
    error: 'GX10_API_KEY_MISSING',
    hint: 'GX10_API_URL and GX10_API_KEY must be configured on the server',
  });
}

function mapClientError(res, err) {
  if (err instanceof GX10RestClientError) {
    const status = err.code === 'GX10_AUTH_FAILED' ? 401
      : err.code === 'GX10_JOB_NOT_FOUND' ? 404
        : err.code === 'GX10_POLL_TIMEOUT' || err.code === 'GX10_REQUEST_TIMEOUT' ? 504
          : err.code === 'GX10_JOB_CANCELLED' ? 409
            : 502;
    return res.status(status).json({
      error: err.code,
      hint: err.message,
      meta: err.meta,
    });
  }
  return res.status(500).json({
    error: err?.code || 'GX10_PIPELINE_FAILED',
    hint: err?.message || String(err),
  });
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const action = url.searchParams.get('action') || 'probe';
  const jobId = url.searchParams.get('jobId') || '';
  const client = createGX10RestClientFromEnv();
  const configured = client.isConfigured();
  const { admin, error: adminError } = getAdmin();

  if (action === 'probe') {
    const payload = {
      configured,
      provider: 'gx10',
      apiUrl: configured ? client.apiUrl : null,
      hint: configured ? 'GX10 API configured' : 'Set GX10_API_URL and GX10_API_KEY',
    };
    if (!configured) {
      return res.status(200).json({ ...payload, error: 'GX10_API_KEY_MISSING' });
    }
    try {
      const health = await client.probeHealth();
      return res.status(200).json({ ...payload, health });
    } catch (err) {
      return res.status(502).json({
        ...payload,
        error: err.code || 'GX10_HEALTH_CHECK_FAILED',
        hint: err.message,
      });
    }
  }

  if (!configured) return keyMissing(res);

  if (action === 'create' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });

    let payload;
    try {
      payload = await parseCreateBody(req);
    } catch (err) {
      return res.status(400).json({ error: 'invalid_request', hint: err?.message });
    }
    if (!payload.groupId || !payload.songId || !payload.videoBuffer?.length) {
      return res.status(400).json({ error: 'groupId_songId_video_required' });
    }
    if (!Array.isArray(payload.memberMapping) || !payload.memberMapping.length) {
      return res.status(400).json({ error: 'memberMapping_required' });
    }

    try {
      const record = await submitGx10ProductionMotionJob(admin, client, {
        ...payload,
        createdBy: auth.uid,
      });
      return res.status(200).json(record);
    } catch (err) {
      return mapClientError(res, err);
    }
  }

  if (action === 'status' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });

    try {
      const record = await refreshGx10JobStatus(admin, client, jobId);
      const autoFinalize = url.searchParams.get('autoFinalize') === '1';
      if (autoFinalize && record.status === 'completed') {
        const finalized = await finalizeGx10ProductionMotionJob(admin, client, jobId, auth.uid);
        return res.status(200).json(finalized);
      }
      return res.status(200).json(record);
    } catch (err) {
      return mapClientError(res, err);
    }
  }

  if (action === 'cancel' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });

    try {
      const record = await cancelGx10ProductionMotionJob(admin, client, jobId);
      return res.status(200).json(record);
    } catch (err) {
      return mapClientError(res, err);
    }
  }

  if (action === 'finalize' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });

    try {
      const record = await finalizeGx10ProductionMotionJob(admin, client, jobId, auth.uid);
      return res.status(200).json(record);
    } catch (err) {
      return mapClientError(res, err);
    }
  }

  if (action === 'recover' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });

    try {
      const record = await recoverGx10ProductionMotionJob(admin, client, jobId, auth.uid);
      return res.status(200).json(record);
    } catch (err) {
      return mapClientError(res, err);
    }
  }

  if (action === 'run' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });

    let payload;
    try {
      payload = await parseCreateBody(req);
    } catch (err) {
      return res.status(400).json({ error: 'invalid_request', hint: err?.message });
    }
    if (!payload.groupId || !payload.songId || !payload.videoBuffer?.length) {
      return res.status(400).json({ error: 'groupId_songId_video_required' });
    }

    try {
      const record = await runGx10ProductionMotionPipeline(admin, client, {
        ...payload,
        createdBy: auth.uid,
        pollTimeoutMs: Number(url.searchParams.get('pollTimeoutMs') || process.env.GX10_POLL_TIMEOUT_MS || 600000),
      });
      return res.status(200).json(record);
    } catch (err) {
      if (err instanceof GX10RestClientError && err.code === 'GX10_POLL_TIMEOUT') {
        const partial = jobId ? await loadJobRecord(admin, jobId) : null;
        return res.status(504).json({
          error: err.code,
          hint: err.message,
          job: partial,
          recoverable: true,
        });
      }
      return mapClientError(res, err);
    }
  }

  if (action === 'job' && req.method === 'GET') {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.code });
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });
    if (!admin) return res.status(503).json({ error: 'FIREBASE_ADMIN_UNAVAILABLE', hint: adminError });
    const record = await loadJobRecord(admin, jobId);
    if (!record) return res.status(404).json({ error: 'GX10_JOB_NOT_FOUND' });
    return res.status(200).json(record);
  }

  return res.status(405).json({ error: 'unknown_action', action });
};
