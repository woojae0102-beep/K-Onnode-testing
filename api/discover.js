const { collectTrending, getCache, setCache } = require('./_lib/trending');

// Soft TTL — refresh after 6 hours (cron handles the weekly hard refresh).
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const track = url.searchParams.get('track') || 'all';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const force = url.searchParams.get('force') === '1';

  try {
    let cache = getCache();
    const isStale =
      !cache.data ||
      !cache.lastUpdated ||
      Date.now() - new Date(cache.lastUpdated).getTime() > CACHE_TTL_MS;

    const hasKeys = Boolean(process.env.YOUTUBE_API_KEY);

    if ((force || isStale) && hasKeys) {
      try {
        const fresh = await collectTrending();
        // Only overwrite cache if at least one section is non-empty
        const total =
          (fresh.trending?.length || 0) +
          (fresh.dance?.length || 0) +
          (fresh.songs?.length || 0) +
          (fresh.challenges?.length || 0);
        if (total > 0) {
          cache = setCache(fresh);
        } else if (!cache.data) {
          cache = setCache(fresh);
        }
      } catch (fetchErr) {
        console.error('[discover] live fetch failed; serving cached/empty:', fetchErr?.message || fetchErr);
      }
    }

    if (!cache.data) {
      return res.status(200).json({
        data: { trending: [], dance: [], songs: [], challenges: [] },
        lastUpdated: null,
        source: hasKeys ? 'empty' : 'no-key',
      });
    }

    const filterTrack = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, limit);
    };

    const data = {
      trending: track === 'all' || track === 'trending' ? filterTrack(cache.data.trending) : [],
      dance: track === 'all' || track === 'dance' ? filterTrack(cache.data.dance) : [],
      songs: track === 'all' || track === 'songs' ? filterTrack(cache.data.songs) : [],
      challenges:
        track === 'all' || track === 'challenges' ? filterTrack(cache.data.challenges) : [],
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
