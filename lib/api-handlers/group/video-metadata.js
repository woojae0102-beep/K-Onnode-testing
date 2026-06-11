const { fetchVideoMetadata } = require('./youtubeGroup');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  let videoId = '';

  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    videoId = url.searchParams.get('videoId') || url.searchParams.get('id') || '';
  } else {
    const body = typeof req.body === 'object' ? req.body : {};
    videoId = body.videoId || body.id || '';
  }

  if (!videoId) {
    return res.status(400).json({ error: 'videoId required' });
  }

  try {
    const meta = await fetchVideoMetadata(apiKey, videoId);
    return res.status(200).json(meta);
  } catch (err) {
    console.error('[group/video-metadata]', err);
    return res.status(500).json({ error: err.message || 'metadata failed' });
  }
};
