const { resolveStreamUrl } = require('./youtubeGroup');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const videoId = url.searchParams.get('videoId') || url.searchParams.get('id') || '';
  if (!videoId) {
    return res.status(400).json({ error: 'videoId required' });
  }

  try {
    const streamUrl = await resolveStreamUrl(videoId);
    const rangeHeader = req.headers.range || req.headers.Range || '';

    const upstream = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: 'upstream fetch failed' });
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

    if (upstream.body) {
      await pipeline(Readable.fromWeb(upstream.body), res);
      return undefined;
    }

    const buffer = await upstream.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[group/proxy-video]', err);
    return res.status(500).json({
      error: err.message || 'proxy failed',
      hint: '영상 파일을 직접 업로드해 주세요.',
    });
  }
};
