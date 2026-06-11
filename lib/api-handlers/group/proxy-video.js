const { resolveStreamUrl } = require('./youtubeGroup');

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
    const upstream = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Range: req.headers.range || '',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'upstream fetch failed' });
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    const buffer = await upstream.arrayBuffer();
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('[group/proxy-video]', err);
    return res.status(500).json({
      error: err.message || 'proxy failed',
      hint: '영상 파일을 직접 업로드해 주세요.',
    });
  }
};
