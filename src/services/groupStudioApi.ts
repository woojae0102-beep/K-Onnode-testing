// @ts-nocheck

export async function searchYoutubeDance(query, limit = 8) {
  const res = await fetch('/api/group?path=youtube-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error('YouTube 검색에 실패했습니다.');
  const data = await res.json();
  return data.items || [];
}

export async function fetchVideoMetadata(videoId) {
  const res = await fetch(`/api/group?path=video-metadata&videoId=${encodeURIComponent(videoId)}`);
  if (!res.ok) throw new Error('영상 정보를 불러올 수 없습니다.');
  return res.json();
}

export function buildProxyVideoUrl(videoId) {
  return `/api/group?path=proxy-video&videoId=${encodeURIComponent(videoId)}`;
}
