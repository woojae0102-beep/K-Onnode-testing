// @ts-nocheck

const CLIENT_DOWNLOAD_TIMEOUT_MS = 12000;
const CLIENT_DOWNLOAD_MAX_TIMEOUT_MS = 45 * 60 * 1000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function streamToBlob(readableStream, maxBytes = 80 * 1024 * 1024) {
  const reader = readableStream.getReader();
  const chunks = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }

  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }

  if (!total) throw new Error('다운로드된 영상 데이터가 없습니다.');
  return new Blob(chunks, { type: 'video/mp4' });
}

export async function downloadYoutubeVideoBlob(videoId, onStatus) {
  onStatus?.('브라우저에서 YouTube 영상 연결 중...');

  const { YtdlCore } = await import('@ybd-project/ytdl-core/browser');
  const ytdl = new YtdlCore({
    clients: ['IOS', 'ANDROID', 'WEB', 'MWEB'],
  });

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await withTimeout(
    ytdl.getFullInfo(watchUrl),
    CLIENT_DOWNLOAD_TIMEOUT_MS,
    'YouTube 정보 조회 시간이 초과되었습니다.',
  );

  const format = info.formats
    ?.filter((f) => f.url && f.hasVideo && f.hasAudio)
    ?.sort((a, b) => (Number(a.quality?.label) || 999) - (Number(b.quality?.label) || 999))[0];

  if (!format) {
    throw new Error('재생 가능한 YouTube 포맷을 찾지 못했습니다.');
  }

  onStatus?.('YouTube 영상 다운로드 중...');
  const lengthSec = Number(info.videoDetails?.lengthSeconds || info.playability?.lengthSeconds || 0);
  const downloadTimeoutMs = Number.isFinite(lengthSec) && lengthSec > 0
    ? Math.min(CLIENT_DOWNLOAD_MAX_TIMEOUT_MS, Math.max(CLIENT_DOWNLOAD_TIMEOUT_MS, lengthSec * 1000 + 30000))
    : CLIENT_DOWNLOAD_MAX_TIMEOUT_MS;

  const stream = await withTimeout(
    ytdl.downloadFromInfo(info, { format }),
    downloadTimeoutMs,
    'YouTube 다운로드 시간이 초과되었습니다.',
  );

  return streamToBlob(stream);
}
