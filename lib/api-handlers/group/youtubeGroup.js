function parseIsoDuration(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0', 10) * 3600)
    + (parseInt(m[2] || '0', 10) * 60)
    + parseInt(m[3] || '0', 10);
}

const RX_MV = /(official\s*(?:m\/?v|music\s*video|video|audio)|뮤직비디오|\bMV\b|M\/V|\(MV\)|music\s*video|teaser|lyric|가사|audio\s*ver)/i;
const RX_DANCE = /(dance\s*practice|dance\s*rehearsal|choreography|choreo|안무|연습|연습실|practice\s*room|rehearsal|studio\s*choom|스튜디오\s*춤|안무영상|안무연습|choreography\s*video)/i;
const RX_EXCLUDE = /(reaction|리액션|vlog|브이로그|behind\s*the|making\s*film|interview|#shorts|쇼츠)/i;

function isMusicVideoTitle(title) {
  return RX_MV.test(String(title || ''));
}

function scoreDanceTitle(title) {
  const t = String(title || '');
  if (RX_EXCLUDE.test(t)) return -100;
  if (isMusicVideoTitle(t)) return -50;
  let score = 0;
  if (/dance\s*practice/i.test(t)) score += 30;
  if (/안무/i.test(t)) score += 28;
  if (/연습실|practice\s*room/i.test(t)) score += 25;
  if (/choreography|choreo/i.test(t)) score += 20;
  if (/studio\s*choom|스튜디오\s*춤/i.test(t)) score += 18;
  if (/rehearsal/i.test(t)) score += 12;
  return score;
}

async function youtubeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

async function ytSearch(apiKey, q, maxResults = 15) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(Math.min(maxResults, 25)),
    q,
    key: apiKey,
    videoDuration: 'medium',
    relevanceLanguage: 'ko',
    regionCode: 'KR',
  });
  const data = await youtubeFetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  return (data.items || []).map((it) => it.id?.videoId).filter(Boolean);
}

async function ytMeta(apiKey, ids) {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    part: 'contentDetails,snippet,statistics',
    id: [...new Set(ids)].join(','),
    key: apiKey,
  });
  const data = await youtubeFetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  return (data.items || []).map((v) => ({
    videoId: v.id,
    title: v.snippet?.title || '',
    channel: v.snippet?.channelTitle || '',
    thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
    youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`,
    durationSec: parseIsoDuration(v.contentDetails?.duration),
    viewCount: parseInt(v.statistics?.viewCount || '0', 10),
    danceScore: scoreDanceTitle(v.snippet?.title || ''),
    videoType: scoreDanceTitle(v.snippet?.title || '') > 0 ? 'dance_practice' : 'other',
  }));
}

async function searchDancePractice(apiKey, query, limit = 8) {
  const base = String(query || '').trim();
  const queries = [
    `${base} dance practice`,
    `${base} 안무 연습`,
    `${base} choreography practice`,
    `${base} 연습실`,
    `${base} studio choom`,
  ];

  const allIds = [];
  for (const q of queries) {
    try {
      const ids = await ytSearch(apiKey, q, 12);
      allIds.push(...ids);
    } catch {
      /* try next query */
    }
  }

  const detailed = await ytMeta(apiKey, allIds);
  const seen = new Set();
  const ranked = detailed
    .filter((row) => row.durationSec >= 30 && row.durationSec <= 600)
    .filter((row) => row.danceScore > 0)
    .filter((row) => {
      if (seen.has(row.videoId)) return false;
      seen.add(row.videoId);
      return true;
    })
    .sort((a, b) => b.danceScore - a.danceScore || b.viewCount - a.viewCount)
    .slice(0, limit);

  return ranked;
}

async function fetchVideoMetadata(apiKey, videoId) {
  if (apiKey) {
    const rows = await ytMeta(apiKey, [videoId]);
    const v = rows[0];
    if (v) return v;
  }

  const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
  if (pipedRes.ok) {
    const piped = await pipedRes.json();
    const title = piped.title || '';
    return {
      videoId,
      title,
      channel: piped.uploader || '',
      thumbnail: piped.thumbnail || '',
      durationSec: Math.round(piped.duration || 0),
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      danceScore: scoreDanceTitle(title),
      videoType: scoreDanceTitle(title) > 0 ? 'dance_practice' : 'other',
    };
  }

  throw new Error('영상 정보를 가져올 수 없습니다.');
}

async function resolveStreamUrl(videoId) {
  const res = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
  if (!res.ok) throw new Error('스트림 URL을 찾을 수 없습니다.');
  const data = await res.json();
  const streams = data.videoStreams || [];
  const pick = streams.find((s) => s.quality === '360p')
    || streams.find((s) => s.quality === '480p')
    || streams.find((s) => /mp4/i.test(s.format || s.mimeType || ''))
    || streams[0];
  if (!pick?.url) throw new Error('재생 가능한 스트림이 없습니다.');
  return pick.url;
}

module.exports = {
  searchDancePractice,
  fetchVideoMetadata,
  resolveStreamUrl,
  parseIsoDuration,
  scoreDanceTitle,
  isMusicVideoTitle,
};
