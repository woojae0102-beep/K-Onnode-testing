/**
 * DeepMotion Animate 3D — 서버 프록시.
 * env: DEEPMOTION_API_KEY (서버 전용, VITE_ 금지)
 * optional: DEEPMOTION_API_URL (default DeepMotion REST base)
 */
const { parseMultipart } = require('./mocapMultipart.cjs');
const { requireAdmin } = require('../../api-lib/firebaseAuth.cjs');
const { getAdmin } = require('../../api-lib/firebaseAdmin.cjs');

const DEFAULT_API_URL = 'https://api.deepmotion.com/v1';
const JOBS_COLLECTION = 'deepmotion_jobs';

function keyMissing(res) {
  return res.status(501).json({
    error: 'DEEPMOTION_API_KEY_MISSING',
    hint: 'DEEPMOTION_API_KEY가 설정되지 않았습니다.',
  });
}

function authFailed(res, hint) {
  return res.status(401).json({
    error: 'DEEPMOTION_AUTH_FAILED',
    hint: hint || 'DeepMotion API 인증에 실패했습니다.',
  });
}

function getConfig() {
  const apiKey = process.env.DEEPMOTION_API_KEY || '';
  const apiUrl = (process.env.DEEPMOTION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  return { apiKey, apiUrl, configured: Boolean(apiKey) };
}

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

async function parseCreateBody(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const raw = await readRawBody(req);
    const { fields, files } = parseMultipart(raw, contentType);
    return {
      groupId: fields.groupId,
      songId: fields.songId,
      title: fields.title,
      video: files.video?.data || files.file?.data,
      filename: files.video?.filename || 'upload.mp4',
    };
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return {
    groupId: body?.groupId,
    songId: body?.songId,
    title: body?.title,
    video: body?.videoBase64 ? Buffer.from(body.videoBase64, 'base64') : null,
    filename: body?.videoFilename || 'upload.mp4',
  };
}

async function saveJob(admin, jobId, data) {
  if (!admin) return;
  await admin.firestore().collection(JOBS_COLLECTION).doc(jobId).set(data, { merge: true });
}

async function loadJob(admin, jobId) {
  if (!admin) return null;
  const snap = await admin.firestore().collection(JOBS_COLLECTION).doc(jobId).get();
  return snap.exists ? snap.data() : null;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const action = url.searchParams.get('action') || 'probe';
  const { apiKey, apiUrl, configured } = getConfig();
  const { admin } = getAdmin();

  if (action === 'probe') {
    return res.status(200).json({
      configured,
      provider: 'deepmotion',
      hint: configured
        ? 'DeepMotion API configured'
        : 'Set DEEPMOTION_API_KEY on the server',
      error: configured ? undefined : 'DEEPMOTION_API_KEY_MISSING',
    });
  }

  if (!configured) {
    return keyMissing(res);
  }

  if (action === 'create' && req.method === 'POST') {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return res.status(auth.status || 403).json({ error: auth.code, hint: 'Admin 권한이 필요합니다.' });
    }

    let payload;
    try {
      payload = await parseCreateBody(req);
    } catch (err) {
      return res.status(400).json({ error: 'invalid_request', hint: err?.message });
    }
    if (!payload.groupId || !payload.songId || !payload.video?.length) {
      return res.status(400).json({ error: 'groupId_songId_video_required' });
    }

    try {
      const form = new FormData();
      form.append('file', new Blob([payload.video]), payload.filename);
      const createRes = await fetch(`${apiUrl}/animate/jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const createData = await createRes.json().catch(() => ({}));
      if (createRes.status === 401 || createRes.status === 403) {
        return authFailed(res, createData.message || createData.error);
      }
      if (!createRes.ok) {
        return res.status(createRes.status >= 400 ? createRes.status : 502).json({
          error: 'DEEPMOTION_JOB_CREATE_FAILED',
          hint: createData.message || createData.error || createRes.statusText,
        });
      }
      const jobId = createData.id || createData.jobId || createData.job_id;
      if (!jobId) {
        return res.status(502).json({
          error: 'DEEPMOTION_JOB_CREATE_FAILED',
          hint: 'DeepMotion API did not return job id',
        });
      }
      const jobRecord = {
        jobId,
        groupId: payload.groupId,
        songId: payload.songId,
        status: 'processing',
        createdAt: new Date().toISOString(),
        createdBy: auth.uid,
      };
      await saveJob(admin, jobId, jobRecord);
      return res.status(200).json({
        jobId,
        status: 'processing',
        createdAt: jobRecord.createdAt,
      });
    } catch (err) {
      return res.status(502).json({
        error: 'DEEPMOTION_JOB_CREATE_FAILED',
        hint: err?.message || 'DeepMotion proxy error',
      });
    }
  }

  if (action === 'status') {
    const jobId = url.searchParams.get('jobId');
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });

    try {
      const statusRes = await fetch(`${apiUrl}/animate/jobs/${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statusData = await statusRes.json().catch(() => ({}));
      if (statusRes.status === 401 || statusRes.status === 403) {
        return authFailed(res, statusData.message || statusData.error);
      }
      if (!statusRes.ok) {
        return res.status(statusRes.status).json({
          error: 'DEEPMOTION_JOB_FAILED',
          hint: statusData.message || statusData.error,
        });
      }
      const remoteStatus = statusData.status || statusData.state || 'processing';
      const normalized = String(remoteStatus).toLowerCase().includes('complete')
        ? 'completed'
        : String(remoteStatus).toLowerCase().includes('fail')
          ? 'failed'
          : 'processing';
      const local = (await loadJob(admin, jobId)) || { jobId };
      local.status = normalized;
      local.updatedAt = new Date().toISOString();
      await saveJob(admin, jobId, local);
      return res.status(200).json({
        jobId,
        status: normalized,
        progress: statusData.progress,
        message: statusData.message,
        error: normalized === 'failed' ? (statusData.error || statusData.message) : undefined,
        errorCode: normalized === 'failed' ? 'DEEPMOTION_JOB_FAILED' : undefined,
      });
    } catch (err) {
      return res.status(502).json({ error: 'DEEPMOTION_JOB_FAILED', hint: err?.message });
    }
  }

  if (action === 'outputs') {
    const jobId = url.searchParams.get('jobId');
    if (!jobId) return res.status(400).json({ error: 'jobId_required' });

    try {
      const outRes = await fetch(`${apiUrl}/animate/jobs/${encodeURIComponent(jobId)}/outputs`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const outData = await outRes.json().catch(() => ({}));
      if (outRes.status === 401 || outRes.status === 403) {
        return authFailed(res, outData.message || outData.error);
      }
      if (!outRes.ok) {
        return res.status(outRes.status).json({
          error: 'DEEPMOTION_OUTPUT_FAILED',
          hint: outData.message || outData.error,
        });
      }
      const rawOutputs = outData.outputs || outData.items || outData;
      const outputs = Array.isArray(rawOutputs)
        ? rawOutputs.map((o, i) => ({
          trackId: String(o.trackId ?? o.actorId ?? o.personId ?? i + 1),
          label: o.label || o.name,
          motionUrl: o.url || o.downloadUrl || o.motionUrl,
          format: (o.format || 'fbx').toLowerCase(),
        }))
        : [];
      if (!outputs.length || outputs.some((o) => !o.motionUrl)) {
        return res.status(502).json({
          error: 'MOTION_OUTPUT_INVALID',
          hint: 'DeepMotion output에 motion URL이 없습니다.',
          outputs,
        });
      }
      return res.status(200).json({ jobId, outputs });
    } catch (err) {
      return res.status(502).json({ error: 'DEEPMOTION_OUTPUT_FAILED', hint: err?.message });
    }
  }

  return res.status(405).json({ error: 'unknown_action', action });
};
