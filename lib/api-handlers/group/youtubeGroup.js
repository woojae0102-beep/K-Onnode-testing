function parseIsoDuration(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0', 10) * 3600)
    + (parseInt(m[2] || '0', 10) * 60)
    + parseInt(m[3] || '0', 10);
}

async function youtubeFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

async function searchDancePractice(apiKey, query, limit = 8) {
  const q = `${query} dance practice OR 안무 OR choreography`;
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(Math.min(limit, 15)),
    q,
    key: apiKey,
    videoDuration: 'medium',
    relevanceLanguage: 'ko',
  });

  const data = await youtubeFetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const ids = (data.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const metaParams = new URLSearchParams({
    part: 'contentDetails,snippet,statistics',
    id: ids.join(','),
    key: apiKey,
  });
  const meta = await youtubeFetch(`https://www.googleapis.com/youtube/v3/videos?${metaParams}`);
  const byId = Object.fromEntries((meta.items || []).map((v) => [v.id, v]));

  return ids.map((id) => {
    const v = byId[id];
    const sn = v?.snippet || data.items.find((it) => it.id?.videoId === id)?.snippet || {};
    const durationSec = parseIsoDuration(v?.contentDetails?.duration);
    return {
      videoId: id,
      title: sn.title || '',
      channel: sn.channelTitle || '',
      thumbnail: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || '',
      youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
      durationSec,
    };
  }).filter((it) => it.durationSec >= 30 && it.durationSec <= 600);
}

async function fetchVideoMetadata(apiKey, videoId) {
  if (apiKey) {
    const params = new URLSearchParams({
      part: 'contentDetails,snippet,statistics',
      id: videoId,
      key: apiKey,
    });
    const data = await youtubeFetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    const v = data.items?.[0];
    if (v) {
      return {
        videoId,
        title: v.snippet?.title || '',
        channel: v.snippet?.channelTitle || '',
        thumbnail: v.snippet?.thumbnails?.medium?.url || '',
        durationSec: parseIsoDuration(v.contentDetails?.duration),
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
  if (pipedRes.ok) {
    const piped = await pipedRes.json();
    return {
      videoId,
      title: piped.title || '',
      channel: piped.uploader || '',
      thumbnail: piped.thumbnail || '',
      durationSec: Math.round(piped.duration || 0),
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
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
};
