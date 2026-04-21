const { collectTrending, getCache, setCache } = require('./_lib/trending');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour soft TTL

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const track = url.searchParams.get('track') || 'all';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  try {
    let cache = getCache();
    const isStale =
      !cache.data ||
      !cache.lastUpdated ||
      Date.now() - new Date(cache.lastUpdated).getTime() > CACHE_TTL_MS;

    const hasKeys = Boolean(
      process.env.YOUTUBE_API_KEY ||
        (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
    );

    if (isStale && hasKeys) {
      const fresh = await collectTrending();
      cache = setCache(fresh);
    }

    if (!cache.data) {
      return res.status(200).json({
        data: { trending: [], dance: [], songs: [], challenges: [], korean: [] },
        lastUpdated: null,
        source: 'empty',
      });
    }

    const filterTrack = (arr) => {
      if (!Array.isArray(arr)) return [];
      const sliced = arr.slice(0, limit);
      return sliced;
    };

    const data = {
      trending: track === 'all' || track === 'trending' ? filterTrack(cache.data.trending) : [],
      dance: track === 'all' || track === 'dance' ? filterTrack(cache.data.dance) : [],
      songs: track === 'all' || track === 'songs' ? filterTrack(cache.data.songs) : [],
      challenges:
        track === 'all' || track === 'challenges' ? filterTrack(cache.data.challenges) : [],
      korean: track === 'all' || track === 'korean' ? filterTrack(cache.data.korean) : [],
    };

    return res.status(200).json({
      data,
      lastUpdated: cache.lastUpdated,
      source: 'cache',
    });
  } catch (error) {
    console.error('Discover fetch failed:', error);
    return res.status(500).json({ error: 'Discover fetch failed', message: String(error?.message || error) });
  }
};
