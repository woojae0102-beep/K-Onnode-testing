const { searchDancePractice } = require('./youtubeGroup');

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ items: [], reason: 'NO_YOUTUBE_API_KEY' });
  }

  let query = '';
  let limit = 8;
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    query = url.searchParams.get('q') || '';
    limit = parseInt(url.searchParams.get('limit') || '8', 10);
  } else {
    const body = await readJsonBody(req);
    query = body.query || body.q || '';
    limit = parseInt(body.limit || '8', 10);
  }

  if (!query.trim()) {
    return res.status(400).json({ error: 'query required' });
  }

  try {
    const items = await searchDancePractice(apiKey, query.trim(), limit);
    return res.status(200).json({ items });
  } catch (err) {
    console.error('[group/youtube-search]', err);
    return res.status(500).json({ error: err.message || 'search failed', items: [] });
  }
};
