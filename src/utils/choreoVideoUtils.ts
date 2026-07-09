// @ts-nocheck
import { buildProxyVideoUrl } from '../services/groupStudioApi';
import { downloadYoutubeVideoBlob } from '../services/youtubeClientDownload';
import { recordYoutubeTabVideo } from '../services/youtubeTabCapture';
import { resolveVideoSampleFps } from '../config/choreoExtractConfig';

export const VIDEO_LOAD_TIMEOUT_MS = 90000;
export const VIDEO_SEEK_TIMEOUT_MS = 8000;
export const ANALYSIS_VIDEO_READY_TIMEOUT_MS = 15000;

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

/** seekable은 "현재 브라우저가 seek 가능한 구간"일 뿐 전체 영상 길이가 아니다. */
export function getSeekableEnd(video) {
  const seekableLength = video?.seekable?.length ?? 0;
  const bufferedLength = video?.buffered?.length ?? 0;
  const end = seekableLength ? video.seekable.end(seekableLength - 1) : null;
  const bufferedEnd = bufferedLength ? video.buffered.end(bufferedLength - 1) : null;
  console.log('[choreoVideo] media ranges', {
    duration: video?.duration,
    seekableLength,
    seekEnd: end,
    bufferedLength,
    bufferedEnd,
  });
  return Number.isFinite(end) && end > 0 ? end : null;
}

/**
 * 분석에 사용할 영상 길이(초) — video.duration 전체.
 * 30/60/120/600초 등 인위적 상한 없음.
 */
export async function resolveVideoDuration(video) {
  if (!video) return 0;

  await waitForVideoEvent(video, 'loadedmetadata');
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    await waitForVideoEvent(video, 'loadeddata', 30000);
  }

  await waitForVideoEvent(video, 'canplay', 30000);

  const duration = Number(video.duration) || 0;
  const seekEnd = getSeekableEnd(video);

  const resolvedDuration = Number.isFinite(duration) && duration > 0
    ? duration
    : seekEnd;

  if (!Number.isFinite(resolvedDuration) || resolvedDuration <= 0) {
    throw new Error('영상 길이(video.duration)를 확인할 수 없습니다.');
  }

  // 분석은 항상 0초부터 시작
  try {
    await seekVideoTo(video, 0);
  } catch {
    /* ignore */
  }

  return resolvedDuration;
}

function isAnalysisVideoReady(video) {
  return Boolean(
    video
      && video.readyState >= 3
      && Number.isFinite(video.duration)
      && video.duration > 0
      && video.seekable?.length > 0,
  );
}

export async function waitForAnalysisVideoReady(
  video,
  timeoutMs = ANALYSIS_VIDEO_READY_TIMEOUT_MS,
) {
  if (!video) throw new Error('비디오 요소가 없습니다.');
  await waitForVideoEvent(video, 'loadedmetadata', timeoutMs);

  if (isAnalysisVideoReady(video)) {
    getSeekableEnd(video);
    return;
  }

  await new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let timer = 0;

    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', check);
      video.removeEventListener('canplay', check);
      video.removeEventListener('progress', check);
      video.removeEventListener('durationchange', check);
      video.removeEventListener('error', onError);
    };

    const finish = (fn, value) => {
      cleanup();
      fn(value);
    };

    const onError = () => finish(reject, new Error('영상 로드 실패'));

    function check() {
      if (isAnalysisVideoReady(video)) {
        getSeekableEnd(video);
        finish(resolve);
        return;
      }

      if (performance.now() - startedAt >= timeoutMs) {
        getSeekableEnd(video);
        finish(
          reject,
          new Error('분석용 영상 준비 시간이 초과되었습니다. duration/seekable 상태를 확인해 주세요.'),
        );
        return;
      }

      timer = window.setTimeout(check, 100);
    }

    video.addEventListener('loadeddata', check);
    video.addEventListener('canplay', check);
    video.addEventListener('progress', check);
    video.addEventListener('durationchange', check);
    video.addEventListener('error', onError, { once: true });
    check();
  });
}

const RVFC_SAMPLE_MS = 600;

/**
 * 업로드/캡처 영상의 native FPS 추정.
 * 1) MediaStream track frameRate  2) data-native-fps 힌트  3) requestVideoFrameCallback 측정
 */
export async function detectVideoNativeFps(video) {
  if (!video) return null;

  const stream = video.srcObject;
  if (stream && typeof MediaStream !== 'undefined' && stream instanceof MediaStream) {
    const track = stream.getVideoTracks()[0];
    const rate = track?.getSettings?.()?.frameRate;
    if (Number.isFinite(rate) && rate > 0) return rate;
  }

  const hinted = Number(video.dataset?.nativeFps ?? video.getAttribute?.('data-native-fps'));
  if (Number.isFinite(hinted) && hinted > 0) return hinted;

  if (typeof video.requestVideoFrameCallback !== 'function') return null;

  const savedTime = video.currentTime;
  const wasPaused = video.paused;
  let frameCount = 0;

  try {
    video.muted = true;
    video.playsInline = true;
    await video.play();

    await new Promise((resolve) => {
      const start = performance.now();
      const onFrame = () => {
        frameCount += 1;
        if (performance.now() - start >= RVFC_SAMPLE_MS) {
          resolve(true);
          return;
        }
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    });

    const measured = frameCount / (RVFC_SAMPLE_MS / 1000);
    if (Number.isFinite(measured) && measured > 0) return measured;
  } catch {
    /* 재생 불가(코덱/정책) 시 null → 기본 30fps */
  } finally {
    try {
      video.pause();
      video.currentTime = savedTime;
      if (!wasPaused) await video.play().catch(() => {});
      else video.pause();
    } catch {
      /* ignore */
    }
  }

  return null;
}

/** native FPS 읽기 + 30~60 clamp. 알 수 없으면 30. */
export async function resolveAnalysisSampleFps(video) {
  const nativeFps = await detectVideoNativeFps(video);
  const sampleFps = resolveVideoSampleFps(nativeFps);
  if (import.meta.env?.DEV) {
    console.debug('[choreoVideo] sampleFps', {
      nativeFps: nativeFps ?? 'unknown',
      sampleFps,
    });
  }
  return { nativeFps, sampleFps };
}

async function loadBlobIntoVideo(video, blob, onStatus) {
  const objectUrl = URL.createObjectURL(blob);
  onStatus?.('분석용 영상 준비 중...');
  video.src = objectUrl;
  await waitForAnalysisVideoReady(video);
  return {
    objectUrl,
    blob,
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
  await waitForAnalysisVideoReady(video);
  return {
    objectUrl: null,
    blob: null,
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
    await waitForAnalysisVideoReady(video);
    return {
      objectUrl,
      blob: file,
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
  const duration = Number(video.duration);
  const seekEnd = getSeekableEnd(video);
  const upperBound = Number.isFinite(duration) && duration > 0
    ? Math.max(0, duration - 0.04)
    : seekEnd != null
      ? Math.max(0, seekEnd - 0.04)
      : Number.POSITIVE_INFINITY;
  const clamped = Math.max(0, Math.min(timeSec, upperBound));
  if (Math.abs(video.currentTime - clamped) < 0.05 && readyForEvent(video, 'seeked')) return;
  video.currentTime = clamped;
  await waitForVideoEvent(video, 'seeked', VIDEO_SEEK_TIMEOUT_MS);
}
