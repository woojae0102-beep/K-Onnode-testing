const fetchYoutubeCaptions = require('./fetch-youtube-captions');
const buildKnowledge = require('./build-knowledge');

function createMemoryRes() {
  const holder = { statusCode: 200, body: null };
  return {
    status(code) {
      holder.statusCode = code;
      return this;
    },
    json(body) {
      holder.body = body;
      return holder;
    },
    _holder: holder,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const youtubeRes = createMemoryRes();
    await fetchYoutubeCaptions(req, youtubeRes);

    const customKnowledge = Array.isArray(req.body?.customKnowledge) ? req.body.customKnowledge : [];
    const customResults = [];
    for (const item of customKnowledge) {
      const buildReq = {
        ...req,
        method: 'POST',
        body: item,
      };
      const buildRes = createMemoryRes();
      await buildKnowledge(buildReq, buildRes);
      customResults.push(buildRes._holder.body);
    }

    return res.status(200).json({
      ok: true,
      youtube: youtubeRes._holder.body,
      customResults,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};
