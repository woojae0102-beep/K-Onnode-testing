// Shared logic for /api/discover and /api/cron/update-trending.
// CommonJS module — Vercel Node.js runtime.
// Uses YouTube Data API v3 only. Re-fetches weekly via cron.

let CACHE = {
  data: null,
  lastUpdated: null,
};

const NEXT_SUNDAY = () => {
  const d = new Date();
  const diff = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

function extractArtist(title) {
  const m = String(title || '').match(/^([^\-|–:]+)[\-|–:]/);
  return (m ? m[1] : '').trim();
}

function pickThumbnail(snippet) {
  return (
    snippet?.thumbnails?.maxres?.url ||
    snippet?.thumbnails?.standard?.url ||
    snippet?.thumbnails?.high?.url ||
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.default?.url ||
    null
  );
}

async function ytSearch({
  apiKey,
  q,
  maxResults = 20,
  order = 'viewCount',
  publishedAfter,
  videoDuration,
  videoCategoryId,
}) {
  const params = new URLSearchParams({
    part: 'snippet',
    q,
    type: 'video',
    order,
    maxResults: String(Math.min(maxResults, 50)),
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    safeSearch: 'moderate',
    key: apiKey,
  });
  if (publishedAfter) params.set('publishedAfter', publishedAfter);
  if (videoDuration) params.set('videoDuration', videoDuration);
  if (videoCategoryId) params.set('videoCategoryId', videoCategoryId);
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube search failed (${res.status}): ${text.slice(0, 100)}`);
  }
  const data = await res.json();
  return data.items || [];
}

async function ytVideos({ apiKey, ids }) {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    id: ids.join(','),
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube videos failed (${res.status}): ${text.slice(0, 100)}`);
  }
  const data = await res.json();
  return data.items || [];
}

// Fetch search results, then enrich with statistics, sort by viewCount desc.
async function fetchRanked({
  apiKey,
  q,
  max = 20,
  order = 'viewCount',
  publishedAfter,
  videoDuration,
  videoCategoryId,
  exclude = new Set(),
  filter = null,
}) {
  // Search wider so that dedupe + filter still leaves enough rows.
  const items = await ytSearch({
    apiKey,
    q,
    maxResults: Math.min(max * 2 + 10, 50),
    order,
    publishedAfter,
    videoDuration,
    videoCategoryId,
  });
  const ids = items.map((it) => it?.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const detailed = await ytVideos({ apiKey, ids });
  let rows = detailed.map((v) => ({
    videoId: v.id,
    title: v.snippet?.title || '',
    channel: v.snippet?.channelTitle || '',
    thumbnail: pickThumbnail(v.snippet),
    viewCount: parseInt(v.statistics?.viewCount || '0', 10),
    likeCount: parseInt(v.statistics?.likeCount || '0', 10),
    commentCount: parseInt(v.statistics?.commentCount || '0', 10),
    publishedAt: v.snippet?.publishedAt,
    duration: v.contentDetails?.duration,
    categoryId: v.snippet?.categoryId,
  }));
  if (exclude && exclude.size) {
    rows = rows.filter((r) => !exclude.has(r.videoId));
  }
  if (typeof filter === 'function') {
    rows = rows.filter(filter);
  }
  return rows.sort((a, b) => b.viewCount - a.viewCount).slice(0, max);
}

function rankAndShape(rows, mapFn) {
  return rows.map((row, idx) => ({
    rank: idx + 1,
    ...mapFn(row, idx),
  }));
}

async function fetchTrending(apiKey) {
  // YouTube most popular Music category in KR
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    regionCode: 'KR',
    videoCategoryId: '10',
    maxResults: '25',
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube mostPopular failed (${res.status}): ${text.slice(0, 100)}`);
  }
  const data = await res.json();
  // YouTube `mostPopular` chart for regionCode=KR + videoCategoryId=10 (Music)
  // is already curated Korean music by definition, so no extra K-POP filter here.
  const items = (data.items || [])
    .map((v) => ({
      videoId: v.id,
      title: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      thumbnail: pickThumbnail(v.snippet),
      viewCount: parseInt(v.statistics?.viewCount || '0', 10),
      likeCount: parseInt(v.statistics?.likeCount || '0', 10),
      publishedAt: v.snippet?.publishedAt,
    }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 20);

  return rankAndShape(items, (it) => ({
    id: it.videoId,
    title: it.title,
    artist: extractArtist(it.title) || it.channel,
    channel: it.channel,
    thumbnail: it.thumbnail,
    viewCount: it.viewCount,
    likeCount: it.likeCount,
    publishedAt: it.publishedAt,
    youtubeUrl: `https://youtube.com/watch?v=${it.videoId}`,
    track: 'trending',
  }));
}

// Helper: try a tighter window first, then widen if results are sparse.
async function fetchRankedWindowed({
  apiKey,
  q,
  max = 20,
  windowsDays = [7, 14, 30, 90],
  videoDuration,
  exclude,
  filter,
}) {
  for (const days of windowsDays) {
    const after = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const items = await fetchRanked({
      apiKey,
      q,
      max,
      order: 'viewCount',
      publishedAfter: after,
      videoDuration,
      exclude,
      filter,
    });
    if (items.length >= Math.min(max, 10)) {
      return { items, windowDays: days };
    }
  }
  // Final fallback: no published-after filter
  const items = await fetchRanked({
    apiKey,
    q,
    max,
    order: 'viewCount',
    videoDuration,
    exclude,
    filter,
  });
  return { items, windowDays: null };
}

// Heuristic detectors so each category gets DISTINCT content.
const RX_DANCE = /(dance practice|안무|choreography|cover dance|커버 ?댄스|performance video|studio choom|focus cam|직캠|\bm ?countdown\b)/i;
const RX_CHALLENGE = /(challenge|챌린지|#shorts|쇼츠|tiktok)/i;
const RX_OFFICIAL_MV = /(official\s*(?:m\/?v|music video|video|audio)|뮤직비디오|\bMV\b|M\/V|\(MV\))/i;
const RX_KOREAN = /[\u3131-\uD79D]/; // any Hangul char
// K-POP entity / label keywords (lowercased compare). Helps gate non-Korean
// search-result noise (e.g. random TikTok dances) from leaking into our lists.
const KPOP_KEYWORDS = [
  'kpop', 'k-pop', 'korean pop', 'k pop',
  '1thek', 'mnet', 'mcountdown', 'm countdown', 'studio choom', 'm2', 'kbs world', 'inkigayo', 'show champion', 'music bank',
  'hybe', 'bighit', 'big hit', 'jyp', 'sm entertainment', 'sment', 'yg entertainment', 'ygfamily', 'starship', 'pledis', 'cube entertainment', 'fantagio', 'ador', 'kakao entertainment',
  // Actively-promoted artists/groups (case-insensitive substring match)
  'bts', 'bangtan', 'blackpink', 'twice', 'enhypen', 'le sserafim', 'lesserafim', 'newjeans', 'aespa', 'itzy', 'ive', 'illit', 'babymonster',
  'stray kids', 'straykids', 'seventeen', 'ateez', 'txt', 'tomorrow x together', 'nct', 'riize', 'zerobaseone', 'zb1', 'nmixx',
  '(g)i-dle', 'g-idle', 'gidle', 'kiss of life', 'kissoflife', 'cortis', 'fromis_9', 'fromis', 'red velvet', 'mamamoo', 'oh my girl',
  'iu', '아이유', '뉴진스', '에스파', '아이브', '르세라핌', '아일릿', '스트레이키즈', '세븐틴', '엔하이픈', '투모로우바이투게더', '여자아이들',
];

function isKpopText(text) {
  if (!text) return false;
  const lc = String(text).toLowerCase();
  if (KPOP_KEYWORDS.some((kw) => lc.includes(kw))) return true;
  return RX_KOREAN.test(text);
}

function isKpopRow(r) {
  return isKpopText(r?.title) || isKpopText(r?.channel);
}

const isDuration = (iso, kind) => {
  // ISO 8601 like PT3M21S
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const seconds = (parseInt(m[1] || '0', 10) * 3600) + (parseInt(m[2] || '0', 10) * 60) + parseInt(m[3] || '0', 10);
  if (kind === 'short') return seconds > 0 && seconds <= 90;
  if (kind === 'song') return seconds >= 90 && seconds <= 600;
  return null;
};

async function fetchPopularDance(apiKey, exclude) {
  // Choreography / dance practice / cover dance — explicitly NOT MVs and K-POP only.
  const { items } = await fetchRankedWindowed({
    apiKey,
    q: 'kpop dance practice OR choreography OR 안무 OR studio choom',
    max: 20,
    exclude,
    filter: (r) => {
      if (!isKpopRow(r)) return false;
      if (RX_CHALLENGE.test(r.title) && !RX_DANCE.test(r.title)) return false;
      return RX_DANCE.test(r.title) || /dance/i.test(r.title);
    },
  });
  const difficulties = ['easy', 'normal', 'normal', 'hard', 'hard'];
  return rankAndShape(items, (it, idx) => ({
    id: it.videoId,
    title: it.title,
    artist: extractArtist(it.title) || it.channel,
    channel: it.channel,
    thumbnail: it.thumbnail,
    viewCount: it.viewCount,
    likeCount: it.likeCount,
    publishedAt: it.publishedAt,
    difficulty: difficulties[idx % difficulties.length],
    youtubeUrl: `https://youtube.com/watch?v=${it.videoId}`,
    track: 'dance',
  }));
}

async function fetchPopularSongs(apiKey, exclude) {
  // Hot K-POP MVs / official audio of this week — full songs (>=90s),
  // explicitly excluding short-form/challenge/dance-only content.
  const { items } = await fetchRankedWindowed({
    apiKey,
    q: 'kpop MV OR "official MV" OR "official audio" OR comeback OR 뮤직비디오 OR 컴백',
    max: 25,
    exclude,
    filter: (r) => {
      if (!isKpopRow(r)) return false;
      if (RX_CHALLENGE.test(r.title)) return false;
      if (RX_DANCE.test(r.title)) return false;
      const dur = isDuration(r.duration, 'song');
      if (dur === false) return false;
      return RX_OFFICIAL_MV.test(r.title) || /audio/i.test(r.title) || dur === true;
    },
  });
  return rankAndShape(items, (it) => ({
    id: it.videoId,
    title: it.title,
    artist: extractArtist(it.title) || it.channel,
    channel: it.channel,
    albumArt: it.thumbnail,
    thumbnail: it.thumbnail,
    viewCount: it.viewCount,
    likeCount: it.likeCount,
    publishedAt: it.publishedAt,
    youtubeUrl: `https://youtube.com/watch?v=${it.videoId}`,
    track: 'songs',
  }));
}

// Channel/title noise we never want in the challenge list
const RX_CHALLENGE_NOISE = /(poppyplaytime|gmod|garry'?s mod|sfm|minecraft|fortnite|prank|life ?hack|dabble|gaming)/i;

async function fetchChallenges(apiKey, exclude) {
  // Short-form K-POP challenges (under 90s) — verified K-POP only.
  const { items } = await fetchRankedWindowed({
    apiKey,
    q: '"kpop challenge" OR "kpop dance challenge" OR "kpop 챌린지"',
    max: 20,
    videoDuration: 'short',
    exclude,
    filter: (r) => {
      if (!isKpopRow(r)) return false;
      if (RX_CHALLENGE_NOISE.test(r.title) || RX_CHALLENGE_NOISE.test(r.channel)) return false;
      // Require at least Korean text or an explicit K-POP entity in title/channel
      const strong = RX_KOREAN.test(r.title) || RX_KOREAN.test(r.channel) ||
        /(bts|blackpink|twice|enhypen|le sserafim|lesserafim|newjeans|aespa|itzy|\bive\b|illit|babymonster|stray ?kids|seventeen|ateez|\btxt\b|\bnct\b|riize|nmixx|cortis|kiss of life|fromis|1thek|mnet|studio choom|jyp|hybe|\bsm\b|\byg\b|starship)/i.test(`${r.title} ${r.channel}`);
      if (!strong) return false;
      return RX_CHALLENGE.test(r.title) || isDuration(r.duration, 'short') === true;
    },
  });
  return rankAndShape(items, (it) => ({
    id: it.videoId,
    name: String(it.title).replace(/\[.*?\]/g, '').trim(),
    title: it.title,
    channel: it.channel,
    thumbnail: it.thumbnail,
    viewCount: it.viewCount,
    likeCount: it.likeCount,
    participants: Math.floor(it.viewCount / 100),
    deadline: NEXT_SUNDAY(),
    youtubeUrl: `https://youtube.com/watch?v=${it.videoId}`,
    track: 'challenge',
  }));
}

async function collectTrending() {
  const youtubeKey = process.env.YOUTUBE_API_KEY;

  if (!youtubeKey) {
    return {
      dance: [],
      trending: [],
      songs: [],
      challenges: [],
      usedFallback: true,
      reason: 'NO_YOUTUBE_API_KEY',
    };
  }

  // Run sequentially so each later category can dedupe against the earlier ones.
  // Quota cost: ~4 search calls (100 units each) + 4 videos calls (1 unit each) ≈ 404 units per refresh.
  const exclude = new Set();
  const safe = async (label, fn) => {
    try {
      const rows = await fn();
      rows.forEach((r) => r?.id && exclude.add(r.id));
      return rows;
    } catch (err) {
      console.error(`[trending] ${label} failed:`, err?.message || err);
      return [];
    }
  };

  // Order matters: trending (mostPopular chart) is broadest, then songs (full MVs),
  // then dance (practice/choreo), then challenges (shorts).
  const trending = await safe('trending', () => fetchTrending(youtubeKey));
  const songs = await safe('songs', () => fetchPopularSongs(youtubeKey, new Set(exclude)));
  const dance = await safe('dance', () => fetchPopularDance(youtubeKey, new Set(exclude)));
  const challenges = await safe('challenges', () => fetchChallenges(youtubeKey, new Set(exclude)));

  return {
    dance,
    trending,
    songs,
    challenges,
    usedFallback:
      dance.length === 0 && trending.length === 0 && songs.length === 0 && challenges.length === 0,
  };
}

function setCache(payload) {
  CACHE = { data: payload, lastUpdated: new Date().toISOString() };
  return CACHE;
}

function getCache() {
  return CACHE;
}

module.exports = {
  collectTrending,
  setCache,
  getCache,
};
