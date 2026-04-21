// Shared logic for /api/discover and /api/cron/update-trending.
// CommonJS module — Vercel Node.js runtime.

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

async function fetchPopularDance(apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=kpop+dance+cover&type=video&order=viewCount&maxResults=10&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube dance search failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    id: item.id?.videoId,
    title: item.snippet?.title,
    artist: extractArtist(item.snippet?.title),
    thumbnail: item.snippet?.thumbnails?.medium?.url,
    youtubeUrl: `https://youtube.com/watch?v=${item.id?.videoId}`,
    track: 'dance',
  }));
}

async function fetchTrendingVideos(apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=KR&videoCategoryId=10&maxResults=15&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube trending failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    id: item.id,
    title: item.snippet?.title,
    thumbnail: item.snippet?.thumbnails?.medium?.url,
    viewCount: parseInt(item.statistics?.viewCount || '0', 10),
    likeCount: parseInt(item.statistics?.likeCount || '0', 10),
    youtubeUrl: `https://youtube.com/watch?v=${item.id}`,
    track: 'trending',
  }));
}

async function fetchPopularSongs(clientId, clientSecret) {
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  if (!tokenRes.ok) throw new Error(`Spotify auth failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  // Spotify K-POP daily playlist
  const playlistId = '37i9dQZF1DX9tPFwDMOaN1';
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=20`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  if (!res.ok) throw new Error(`Spotify playlist failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    id: item.track?.id,
    title: item.track?.name,
    artist: item.track?.artists?.[0]?.name,
    albumArt: item.track?.album?.images?.[1]?.url,
    bpm: null,
    track: 'songs',
  }));
}

async function fetchChallenges(apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=kpop+challenge&type=video&order=viewCount&maxResults=6&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube challenges failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    id: item.id?.videoId,
    name: String(item.snippet?.title || '').replace(/\[.*?\]/g, '').trim(),
    thumbnail: item.snippet?.thumbnails?.medium?.url,
    participants: Math.floor(Math.random() * 50000) + 5000,
    deadline: NEXT_SUNDAY(),
    track: 'challenge',
  }));
}

async function collectTrending() {
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  const spotifyId = process.env.SPOTIFY_CLIENT_ID;
  const spotifySecret = process.env.SPOTIFY_CLIENT_SECRET;

  const tasks = [];
  tasks.push(youtubeKey ? fetchPopularDance(youtubeKey).catch(() => []) : Promise.resolve([]));
  tasks.push(youtubeKey ? fetchTrendingVideos(youtubeKey).catch(() => []) : Promise.resolve([]));
  tasks.push(
    spotifyId && spotifySecret
      ? fetchPopularSongs(spotifyId, spotifySecret).catch(() => [])
      : Promise.resolve([])
  );
  tasks.push(youtubeKey ? fetchChallenges(youtubeKey).catch(() => []) : Promise.resolve([]));

  const [dance, trending, songs, challenges] = await Promise.all(tasks);
  return {
    dance,
    trending,
    songs,
    challenges,
    korean: [],
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
