const { collectTrending, setCache } = require('../_lib/trending');

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const payload = await collectTrending();
    setCache(payload);
    return res.status(200).json({
      success: true,
      updated: new Date().toISOString(),
      counts: {
        dance: payload.dance.length,
        trending: payload.trending.length,
        songs: payload.songs.length,
        challenges: payload.challenges.length,
      },
      usedFallback: payload.usedFallback,
    });
  } catch (error) {
    console.error('Trending update failed:', error);
    return res.status(500).json({ error: 'Update failed', message: String(error?.message || error) });
  }
};
