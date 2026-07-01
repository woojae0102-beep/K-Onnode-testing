// @ts-nocheck
import { buildProxyVideoUrl } from '../services/groupStudioApi';
import { downloadYoutubeVideoBlob } from '../services/youtubeClientDownload';
import { recordYoutubeTabVideo } from '../services/youtubeTabCapture';
import { CHOREO_MAX_DURATION_SEC } from '../config/choreoExtractConfig';

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
      finish(reject, new Error(`영상 오류: ${detail} 다른 방식으로 다시 시도해 주세요.`));
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
            : '영상 연결 시간이 초과되었습니다. 파일 업로드를 시도해 주세요.',
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

/** seekable 범위 안에서만 분석 길이 확정 (과대 duration으로 seek 연쇄 실패 방지) */
export function getSeekableEnd(video) {
  if (!video?.seekable?.length) return null;
  const end = video.seekable.end(video.seekable.length - 1);
  return Number.isFinite(end) && end > 0 ? end : null;
}

/**
 * 분석에 사용할 안전한 영상 길이(초).
 * - video.duration 과 seekable.end 중 신뢰 가능한 값 사용
 * - CHOREO_MAX_DURATION_SEC 상한
 */
export async function resolveVideoDuration(video) {
  if (!video) return 0;

  await waitForVideoEvent(video, 'loadedmetadata');
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    await waitForVideoEvent(video, 'loadeddata', 30000);
  }

  let duration = Number(video.duration) || 0;
  const seekEnd = getSeekableEnd(video);

  if (seekEnd != null) {
    // seekable이 duration보다 약간 길 때만 보정 (무한/비정상 값 방지)
    if (seekEnd > duration && seekEnd < duration * 1.15 + 5) {
      duration = seekEnd;
    }
    // duration이 0인데 seekable만 있는 경우
    if (duration <= 0 && seekEnd > 0) {
      duration = seekEnd;
    }
  }

  duration = Math.min(Math.max(duration, 1), CHOREO_MAX_DURATION_SEC);

  // 분석은 항상 0초부터 시작
  try {
    await seekVideoTo(video, 0);
  } catch {
    /* ignore */
  }

  return duration;
}

async function loadBlobIntoVideo(video, blob, onStatus) {
  const objectUrl = URL.createObjectURL(blob);
  onStatus?.('분석용 영상 준비 중...');
  video.src = objectUrl;
  await waitForVideoEvent(video, 'loadedmetadata');
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    await waitForVideoEvent(video, 'loadeddata', 30000);
  }
  return {
    objectUrl,
    cleanup: () => {
      URL.revokeObjectURL(objectUrl);
      video.src = '';
    },
  };
}

async function fetchProxyVideoBlob(videoId, onStatus) {
  onStatus?.('서버에서 YouTube 영상 연결 중...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(buildProxyVideoUrl(videoId), {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = '';
      try {
        const json = await res.json();
        message = json.hint || json.error || '';
      } catch {
        /* ignore */
      }
      throw new Error(message || '서버 YouTube 연결에 실패했습니다.');
    }
    const type = res.headers.get('content-type') || '';
    if (type.includes('json') || type.includes('text')) {
      throw new Error('서버에서 영상 대신 오류 응답이 반환되었습니다.');
    }
    return res.blob();
  } finally {
    clearTimeout(timer);
  }
}

async function loadProxyStreamIntoVideo(video, videoId, onStatus) {
  onStatus?.('서버에서 YouTube 영상 스트리밍 중...');
  video.src = buildProxyVideoUrl(videoId);
  await waitForVideoEvent(video, 'loadedmetadata', 60000);
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    await waitForVideoEvent(video, 'canplay', 60000);
  }
  return {
    objectUrl: null,
    cleanup: () => {
      video.src = '';
    },
  };
}

async function prepareYoutubeVideo(video, { videoId, onStatus, youtubePlayerRef }) {
  const attempts = [];

  if (youtubePlayerRef) {
    try {
      const blob = await recordYoutubeTabVideo({ youtubePlayerRef, onStatus });
      return loadBlobIntoVideo(video, blob, onStatus);
    } catch (err) {
      attempts.push(`탭 녹화: ${err?.message || String(err)}`);
      console.warn('[prepareYoutubeVideo] tab capture failed:', err);
    }
  }

  try {
    const blob = await downloadYoutubeVideoBlob(videoId, onStatus);
    return loadBlobIntoVideo(video, blob, onStatus);
  } catch (err) {
    attempts.push(`브라우저 다운로드: ${err?.message || String(err)}`);
    console.warn('[prepareYoutubeVideo] client download failed:', err);
  }

  try {
    return await loadProxyStreamIntoVideo(video, videoId, onStatus);
  } catch (streamErr) {
    attempts.push(`서버 스트리밍: ${streamErr?.message || String(streamErr)}`);
    console.warn('[prepareYoutubeVideo] server stream failed:', streamErr);
  }

  try {
    const blob = await fetchProxyVideoBlob(videoId, onStatus);
    return loadBlobIntoVideo(video, blob, onStatus);
  } catch (err) {
    attempts.push(`서버 다운로드: ${err?.message || String(err)}`);
    console.warn('[prepareYoutubeVideo] server proxy failed:', err);
  }

  throw new Error(
    youtubePlayerRef
      ? 'YouTube 영상 준비에 실패했습니다. 「안무 추출」을 다시 누른 뒤 탭 공유 창에서 이 페이지 탭을 선택해 주세요. (Chrome/Edge 권장)'
      : (attempts[0] || 'YouTube 영상을 준비할 수 없습니다. 영상 파일을 직접 업로드해 주세요.'),
  );
}

export async function prepareAnalysisVideo(video, { file, videoId, onStatus, youtubePlayerRef }) {
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
    return {
      objectUrl,
      cleanup: () => {
        URL.revokeObjectURL(objectUrl);
        video.src = '';
      },
    };
  }

  if (videoId) {
    return prepareYoutubeVideo(video, { videoId, onStatus, youtubePlayerRef });
  }

  throw new Error('영상 소스가 없습니다.');
}

export async function seekVideoTo(video, timeSec) {
  if (!video) return;
  const seekEnd = getSeekableEnd(video);
  const clamped = seekEnd != null ? Math.min(timeSec, Math.max(0, seekEnd - 0.04)) : timeSec;
  if (Math.abs(video.currentTime - clamped) < 0.05 && readyForEvent(video, 'seeked')) return;
  video.currentTime = clamped;
  await waitForVideoEvent(video, 'seeked', VIDEO_SEEK_TIMEOUT_MS);
}
