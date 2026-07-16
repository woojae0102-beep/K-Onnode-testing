/**
 * ADMIN — MoCap API 프록시.
 * env: MOCAP_API_URL, MOCAP_API_KEY
 * optional: MOCAP_API_TIMEOUT_MS (default 120000)
 */
const { normalizeMocapResponse } = require('./mocapResponseNormalizer.cjs');
const { parseMultipart } = require('./mocapMultipart.cjs');

async function readRawBody(req) {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return null;
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
  if (!raw || !raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return {};
  }
}

async function parseRequest(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const raw = await readRawBody(req);
    if (!raw?.length) throw new Error('empty_multipart_body');
    const { fields, files } = parseMultipart(raw, contentType);
    return {
      groupId: fields.groupId || '',
      songId: fields.songId || '',
      videoId: fields.videoId || '',
      videoBuffer: files.video?.data || files.file?.data || null,
      videoFilename: files.video?.filename || files.file?.filename || 'upload.mp4',
      videoMime: 'video/mp4',
    };
  }

  const body = await readJsonBody(req);
  let videoBuffer = null;
  if (body.videoBase64) {
    videoBuffer = Buffer.from(String(body.videoBase64), 'base64');
  }
  return {
    groupId: body.groupId || '',
    songId: body.songId || '',
    videoId: body.videoId || '',
    videoBuffer,
    videoFilename: body.videoFilename || 'upload.mp4',
    videoMime: body.videoMime || 'video/mp4',
  };
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const probe = url.searchParams.get('probe');

  const apiUrl = (process.env.MOCAP_API_URL || '').replace(/\/+$/, '');
  const apiKey = process.env.MOCAP_API_KEY || '';
  const timeoutMs = Number(process.env.MOCAP_API_TIMEOUT_MS || 120000);
  const available = Boolean(apiUrl && apiKey);

  if (req.method === 'GET' && probe) {
    return res.status(200).json({
      available,
      provider: available ? 'http_mocap_api' : null,
      endpoint: available ? apiUrl : null,
      hint: available
        ? 'MoCap API configured'
        : 'Set MOCAP_API_URL and MOCAP_API_KEY, or use Local Holistic Admin provider',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!available) {
    return res.status(501).json({
      error: 'mocap_api_not_configured',
      hint: 'MOCAP_API_URL / MOCAP_API_KEY 미설정. Admin UI에서 Local Holistic을 사용하세요.',
    });
  }

  let payload;
  try {
    payload = await parseRequest(req);
  } catch (err) {
    return res.status(400).json({
      error: 'invalid_request',
      hint: err?.message || '요청 파싱 실패',
    });
  }

  const { groupId, songId, videoId, videoBuffer, videoFilename, videoMime } = payload;
  if (!groupId || !songId) {
    return res.status(400).json({ error: 'groupId_and_songId_required' });
  }
  if (!videoBuffer?.length) {
    return res.status(400).json({
      error: 'video_required',
      hint: 'multipart field "video" 또는 JSON videoBase64가 필요합니다.',
    });
  }

  const form = new FormData();
  form.append('groupId', groupId);
  form.append('songId', songId);
  if (videoId) form.append('videoId', videoId);
  const blob = new Blob([videoBuffer], { type: videoMime });
  form.append('video', blob, videoFilename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
      },
      body: form,
      signal: controller.signal,
    });

    const text = await upstream.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return res.status(502).json({
        error: 'mocap_invalid_json',
        hint: `Upstream returned non-JSON (${upstream.status})`,
        status: upstream.status,
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status >= 400 ? upstream.status : 502).json({
        error: data.error || 'mocap_upstream_failed',
        hint: data.hint || data.message || text.slice(0, 200),
        status: upstream.status,
      });
    }

    const normalized = normalizeMocapResponse(data, { groupId, songId });
    if (!normalized?.analysisResult?.frames?.length) {
      return res.status(502).json({
        error: 'mocap_empty_frames',
        hint: 'MoCap API가 유효한 motion frames를 반환하지 않았습니다.',
      });
    }

    return res.status(200).json({
      ok: true,
      providerId: 'http_mocap_api',
      providerLabel: normalized.providerLabel,
      analysisResult: {
        ...normalized.analysisResult,
        trackIdToInitialPosition: normalized.analysisResult.trackIdToInitialPosition,
      },
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? 'mocap_timeout' : 'mocap_proxy_failed',
      hint: err?.message || 'MoCap API 프록시 실패',
    });
  } finally {
    clearTimeout(timer);
  }
};
