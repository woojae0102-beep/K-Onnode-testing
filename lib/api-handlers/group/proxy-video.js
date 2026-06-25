const { proxyVideoStream } = require('./streamResolver.cjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const videoId = url.searchParams.get('videoId') || url.searchParams.get('id') || '';
  if (!videoId) {
    return res.status(400).json({ error: 'videoId required' });
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  try {
    await proxyVideoStream(videoId, req, res);
    return undefined;
  } catch (err) {
    console.error('[group/proxy-video]', videoId, err?.message || err, err?.details || '');
    return res.status(502).json({
      error: err.message || 'proxy failed',
      hint: 'YouTube 스트림 연결에 실패했습니다. 영상 파일을 직접 업로드해 주세요.',
      details: err.details || undefined,
    });
  }
};
