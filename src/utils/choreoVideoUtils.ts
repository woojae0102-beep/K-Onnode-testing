// @ts-nocheck
import { buildProxyVideoUrl } from '../services/groupStudioApi';

export const VIDEO_LOAD_TIMEOUT_MS = 90000;
export const VIDEO_SEEK_TIMEOUT_MS = 8000;

function readyForEvent(video, event) {
  if (!video) return false;
  if (event === 'loadedmetadata') return video.readyState >= 1;
  if (event === 'loadeddata') return video.readyState >= 2;
  if (event === 'canplay') return video.readyState >= 3;
  if (event === 'seeked') return !video.seeking;
  return false;
}

export function waitForVideoEvent(video, event, timeoutMs = VIDEO_LOAD_TIMEOUT_MS) {
  if (!video) return Promise.reject(new Error('비디오 요소가 없습니다.'));
  if (readyForEvent(video, event)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener(event, onOk);
      video.removeEventListener('error', onErr);
      video.removeEventListener('stalled', onStalled);
      fn(value);
    };

    const onOk = () => finish(resolve);
    const onErr = () => {
      const code = video.error?.code;
      const detail = code === 4 ? '재생 형식을 지원하지 않습니다.' : '영상 로드에 실패했습니다.';
      finish(reject, new Error(`YouTube 영상 오류: ${detail} 파일 업로드를 시도해 주세요.`));
    };
    const onStalled = () => {
      if (event === 'canplay' && video.readyState >= 2 && video.duration > 0) {
        finish(resolve);
      }
    };

    const timer = setTimeout(() => {
      if (event === 'canplay' && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
        finish(resolve);
        return;
      }
      finish(
        reject,
        new Error(
          event === 'seeked'
            ? '영상 구간 이동 시간이 초과되었습니다. 네트워크 상태를 확인하거나 파일을 직접 업로드해 주세요.'
            : 'YouTube 영상 연결 시간이 초과되었습니다. URL을 확인하거나 영상 파일을 직접 업로드해 주세요.',
        ),
      );
    }, timeoutMs);

    video.addEventListener(event, onOk, { once: true });
    video.addEventListener('error', onErr, { once: true });
    if (event === 'canplay') {
      video.addEventListener('stalled', onStalled);
    }
  });
}

export async function probeProxyVideo(videoId, timeoutMs = 20000) {
  const url = buildProxyVideoUrl(videoId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-65535' },
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 206) {
      let hint = '';
      try {
        const json = await res.json();
        hint = json.hint || json.error || '';
      } catch {
        /* ignore */
      }
      throw new Error(hint || 'YouTube 프록시 영상을 가져올 수 없습니다. 영상 파일을 직접 업로드해 주세요.');
    }
    const type = res.headers.get('content-type') || '';
    if (type.includes('json') || type.includes('text')) {
      throw new Error('YouTube 영상 스트림 대신 오류 응답이 반환되었습니다. 파일 업로드를 시도해 주세요.');
    }
    return url;
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareAnalysisVideo(video, { file, videoId, onStatus }) {
  if (!video) throw new Error('비디오 요소가 없습니다.');

  video.playsInline = true;
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  if (file) {
    onStatus?.('업로드 영상 준비 중...');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    await waitForVideoEvent(video, 'loadeddata');
    return { objectUrl, cleanup: () => { URL.revokeObjectURL(objectUrl); video.src = ''; } };
  }

  if (videoId) {
    onStatus?.('YouTube 영상 연결 확인 중...');
    const proxyUrl = await probeProxyVideo(videoId);
    onStatus?.('YouTube 영상 불러오는 중...');
    video.src = proxyUrl;
    await waitForVideoEvent(video, 'loadedmetadata');
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      await waitForVideoEvent(video, 'loadeddata', 30000);
    }
    return { objectUrl: '', cleanup: () => { video.src = ''; } };
  }

  throw new Error('영상 소스가 없습니다.');
}

export async function seekVideoTo(video, timeSec) {
  if (!video) return;
  if (Math.abs(video.currentTime - timeSec) < 0.05 && readyForEvent(video, 'seeked')) return;
  video.currentTime = timeSec;
  await waitForVideoEvent(video, 'seeked', VIDEO_SEEK_TIMEOUT_MS);
}
