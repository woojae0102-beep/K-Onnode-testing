// @ts-nocheck
/** YouTube 스트림 URL 해석 — ytdl 우선, Piped/Invidious/Cobalt 폴백 */

const PIPED_INSTANCES = [
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.io',
  'https://api-piped.mha.fi',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.adminforge.net',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi-libre.kavin.rocks',
  'https://pa.mint.lgbt',
];

const INVIDIOUS_INSTANCES = [
  'https://invidious.protokollden.se',
  'https://invidious.perennialte.ch',
  'https://inv.tux.pizza',
  'https://invidious.private.coffee',
];

const RESOLVER_BUDGET_MS = 8000;

let youtubeiPromise = null;

async function getYoutubeiClient() {
  if (!youtubeiPromise) {
    youtubeiPromise = import('youtubei.js').then(({ ClientType, Innertube }) =>
      Innertube.create({
        client_type: ClientType.ANDROID,
        retrieve_player: true,
      }),
    );
  }
  return youtubeiPromise;
}

/**
 * youtubei.js ANDROID 클라이언트로 직접 스트림 (ytdl decipher 이슈 우회)
 */
async function pipeViaYoutubei(videoId, req, res) {
  const { Utils } = await import('youtubei.js');
  const yt = await getYoutubeiClient();

  const stream = await yt.download(videoId, {
    type: 'videoandaudio',
    quality: '360p',
    format: 'mp4',
    client: 'ANDROID',
  });

  res.status(200);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const { Readable } = require('stream');
  const { pipeline } = require('stream/promises');

  async function* toNodeBuffers() {
    for await (const chunk of Utils.streamToIterable(stream)) {
      yield Buffer.from(chunk);
    }
  }

  await pipeline(Readable.from(toNodeBuffers()), res);
  return true;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = RESOLVER_BUDGET_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function pickPipedStream(data) {
  const streams = data?.videoStreams || [];
  return streams.find((s) => s.quality === '360p')
    || streams.find((s) => s.quality === '480p')
    || streams.find((s) => /mp4/i.test(String(s.format || s.mimeType || '')))
    || streams[0];
}

async function resolveViaPiped(videoId) {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/streams/${encodeURIComponent(videoId)}`, {}, 5000);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.length < 40 || /shutdown|error/i.test(text.slice(0, 80))) continue;
      const data = JSON.parse(text);
      const pick = pickPipedStream(data);
      if (pick?.url) return { url: pick.url, source: `piped:${base}` };
    } catch {
      /* next */
    }
  }
  throw new Error('Piped 실패');
}

async function resolveViaInvidious(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Onnode/1.0)' },
      }, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      const combined = (data.formatStreams || []).find((s) =>
        /360p|480p|720p|medium/i.test(String(s.quality || s.resolution || '')))
        || data.formatStreams?.[0];
      if (combined?.url) return { url: combined.url, source: `invidious:${base}` };
    } catch {
      /* next */
    }
  }
  throw new Error('Invidious 실패');
}

function getYtdl() {
  return require('@distube/ytdl-core');
}

async function resolveViaYtdl(videoId) {
  const ytdl = getYtdl();
  if (!ytdl.validateID(videoId)) throw new Error('잘못된 videoId');

  const info = await Promise.race([
    ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`),
    new Promise((_, reject) => setTimeout(() => reject(new Error('ytdl timeout')), RESOLVER_BUDGET_MS)),
  ]);

  const format = ytdl.chooseFormat(info.formats, {
    quality: '18',
    filter: (f) => f.hasVideo && f.hasAudio && f.container === 'mp4',
  }) || ytdl.chooseFormat(info.formats, { quality: 'lowest', filter: 'videoandaudio' });

  if (!format?.url) throw new Error('ytdl 스트림 없음');
  return { url: format.url, source: 'ytdl-core', info, format };
}

async function resolveViaCobalt(videoId) {
  const base = process.env.COBALT_API_URL;
  if (!base) throw new Error('skip');

  const res = await fetchWithTimeout(base.replace(/\/$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      downloadMode: 'auto',
      videoQuality: '360',
    }),
  }, 15000);

  if (!res.ok) throw new Error(`Cobalt HTTP ${res.status}`);
  const data = await res.json();
  const url = data.url || data.stream?.url;
  if (!url) throw new Error('Cobalt URL 없음');
  return { url, source: 'cobalt' };
}

/**
 * ytdl로 YouTube에서 직접 스트림 (googlevideo URL 재요청보다 안정적)
 */
async function pipeViaYtdl(videoId, req, res) {
  const ytdl = getYtdl();
  if (!ytdl.validateID(videoId)) return false;

  const info = await Promise.race([
    ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000)),
  ]);

  const format = ytdl.chooseFormat(info.formats, {
    quality: '18',
    filter: (f) => f.hasVideo && f.hasAudio && f.container === 'mp4',
  }) || ytdl.chooseFormat(info.formats, { quality: 'lowest', filter: 'videoandaudio' });

  if (!format) return false;

  const rangeHeader = req.headers.range || req.headers.Range || '';
  const rangeMatch = String(rangeHeader).match(/bytes=(\d+)-(\d*)/);
  const opts = { format };
  if (rangeMatch) {
    opts.range = {
      start: parseInt(rangeMatch[1], 10),
      end: rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined,
    };
  }

  res.status(rangeMatch ? 206 : 200);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, opts);
    stream.on('error', reject);
    res.on('close', () => stream.destroy());
    stream.pipe(res);
    stream.on('end', resolve);
  });

  return true;
}

function parseRangeHeader(rangeHeader) {
  const m = String(rangeHeader || '').match(/bytes=(\d+)-(\d*)/);
  if (!m) return null;
  return { start: parseInt(m[1], 10), end: m[2] ? parseInt(m[2], 10) : undefined };
}

async function fetchUpstreamStream(url, req) {
  const rangeHeader = req.headers.range || req.headers.Range || '';
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.youtube.com/',
      Origin: 'https://www.youtube.com',
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    },
  });
}

async function pipeResolvedUrl(streamUrl, req, res) {
  const upstream = await fetchUpstreamStream(streamUrl, req);
  if (!upstream.ok && upstream.status !== 206) {
    const err = new Error(`upstream ${upstream.status}`);
    err.status = upstream.status;
    throw err;
  }

  const contentType = upstream.headers.get('content-type') || 'video/mp4';
  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  ['content-length', 'content-range', 'accept-ranges'].forEach((key) => {
    const value = upstream.headers.get(key);
    if (value) res.setHeader(key, value);
  });

  const range = parseRangeHeader(req.headers.range || req.headers.Range);
  const maxBuffer = range && range.end !== undefined && range.end - range.start < 2 * 1024 * 1024;

  if (maxBuffer || !upstream.body) {
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
    return;
  }

  const { Readable } = require('stream');
  const { pipeline } = require('stream/promises');
  await pipeline(Readable.fromWeb(upstream.body), res);
}

async function resolveStreamUrlFast(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    throw new Error('유효하지 않은 YouTube videoId입니다.');
  }

  const chain = [
    resolveViaPiped,
    resolveViaInvidious,
    () => (process.env.COBALT_API_URL ? resolveViaCobalt(id) : Promise.reject(new Error('skip'))),
  ];

  const failures = [];
  for (const fn of chain) {
    try {
      const result = await fn(id);
      if (result?.url) {
        console.log('[streamResolver] fast resolved via', result.source);
        return result.url;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg !== 'skip') failures.push(msg);
    }
  }

  const err = new Error(
    'YouTube 영상 스트림을 가져올 수 없습니다. 영상 파일을 직접 업로드해 주세요.',
  );
  err.details = failures;
  throw err;
}

async function resolveStreamUrl(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    throw new Error('유효하지 않은 YouTube videoId입니다.');
  }

  const chain = [
    resolveViaPiped,
    resolveViaInvidious,
    () => (process.env.COBALT_API_URL ? resolveViaCobalt(id) : Promise.reject(new Error('skip'))),
    resolveViaYtdl,
  ];

  const failures = [];
  for (const fn of chain) {
    try {
      const result = await fn(id);
      if (result?.url) {
        console.log('[streamResolver] resolved via', result.source);
        return result.url;
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg !== 'skip') failures.push(msg);
    }
  }

  const err = new Error(
    'YouTube 영상 스트림을 가져올 수 없습니다. 영상 파일을 직접 업로드해 주세요.',
  );
  err.details = failures;
  throw err;
}

function isProbeRequest(req) {
  const range = parseRangeHeader(req.headers.range || req.headers.Range);
  if (!range) return false;
  const end = range.end ?? range.start + 65535;
  return end - range.start <= 256 * 1024;
}

async function proxyVideoStream(videoId, req, res) {
  const rangeHeader = req.headers.range || req.headers.Range || '';

  // video 요소 스트리밍은 Range 요청 → URL 해석 후 구간만 전달 (Vercel 4.5MB 제한 회피)
  if (rangeHeader) {
    try {
      const streamUrl = await resolveStreamUrl(videoId);
      await pipeResolvedUrl(streamUrl, req, res);
      return;
    } catch (err) {
      console.warn('[proxyVideoStream] ranged resolve failed:', err?.message || err);
    }
  }

  if (isProbeRequest(req)) {
    try {
      const streamUrl = await resolveStreamUrlFast(videoId);
      await pipeResolvedUrl(streamUrl, req, res);
      return;
    } catch (err) {
      console.warn('[proxyVideoStream] fast probe failed:', err?.message || err);
    }
  }

  try {
    const ok = await pipeViaYoutubei(videoId, req, res);
    if (ok) return;
  } catch (err) {
    console.warn('[proxyVideoStream] youtubei pipe failed:', err?.message || err);
  }

  try {
    const ok = await pipeViaYtdl(videoId, req, res);
    if (ok) return;
  } catch (err) {
    console.warn('[proxyVideoStream] ytdl pipe failed:', err?.message || err);
  }

  const streamUrl = await resolveStreamUrl(videoId);
  await pipeResolvedUrl(streamUrl, req, res);
}

module.exports = {
  resolveStreamUrl,
  resolveStreamUrlFast,
  proxyVideoStream,
  pipeViaYtdl,
  pipeViaYoutubei,
  PIPED_INSTANCES,
};
