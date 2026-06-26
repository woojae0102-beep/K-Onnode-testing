// @ts-nocheck
import { CHOREO_MAX_DURATION_SEC } from '../config/choreoExtractConfig';

function waitFor(condition, timeoutMs = 15000, intervalMs = 200) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (condition()) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('YouTube 플레이어 준비 시간이 초과되었습니다.'));
      }
    }, intervalMs);
  });
}

function pickRecorderMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export async function recordYoutubeTabVideo({
  youtubePlayerRef,
  maxDurationSec = CHOREO_MAX_DURATION_SEC,
  onStatus,
}) {
  // getDisplayMedia는 버튼 클릭 직후에만 허용됩니다. 플레이어 대기 전에 먼저 호출해야 합니다.
  onStatus?.('탭 공유 창에서 이 페이지 탭을 선택해 주세요. YouTube 영상이 자동 재생·녹화됩니다.');

  let displayStream;
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
      preferCurrentTab: true,
    });
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      throw new Error('탭 공유가 취소되었습니다. 다시 시도하거나 영상 파일을 업로드해 주세요.');
    }
    throw new Error('탭 공유를 시작할 수 없습니다. Chrome/Edge 최신 버전을 사용해 주세요.');
  }

  if (!youtubePlayerRef?.isReady?.()) {
    onStatus?.('YouTube 플레이어 준비 중...');
    await waitFor(() => youtubePlayerRef?.isReady?.(), 20000);
  }

  const rawDuration = Number(youtubePlayerRef.getDuration?.() || 0);
  const duration = Math.min(
    Math.max(rawDuration > 0 ? rawDuration : maxDurationSec, 10),
    maxDurationSec,
  );

  const mimeType = pickRecorderMimeType();
  const recorder = mimeType
    ? new MediaRecorder(displayStream, { mimeType, videoBitsPerSecond: 2_500_000 })
    : new MediaRecorder(displayStream);
  const chunks = [];

  const stopTracks = () => {
    displayStream.getTracks().forEach((track) => track.stop());
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let progressTimer;
    let safetyTimer;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (progressTimer) clearInterval(progressTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
      stopTracks();
      fn(value);
    };

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    recorder.onerror = () => {
      finish(reject, new Error('탭 녹화 중 오류가 발생했습니다. 영상 파일 업로드를 시도해 주세요.'));
    };

    recorder.onstop = () => {
      if (!chunks.length) {
        finish(reject, new Error('녹화된 영상 데이터가 없습니다. 탭 선택 후 YouTube 영상이 보이는지 확인해 주세요.'));
        return;
      }
      finish(resolve, new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    };

    displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (recorder.state === 'recording') recorder.stop();
    });

    try {
      recorder.start(1000);
      youtubePlayerRef.seekTo?.(0);
      youtubePlayerRef.play?.();
    } catch (err) {
      finish(reject, new Error(err?.message || 'YouTube 재생을 시작할 수 없습니다.'));
      return;
    }

    onStatus?.(`YouTube 영상 녹화 중... (0/${Math.round(duration)}초)`);
    progressTimer = setInterval(() => {
      const elapsed = Number(youtubePlayerRef.getCurrentTime?.() || 0);
      onStatus?.(`YouTube 영상 녹화 중... (${Math.round(elapsed)}/${Math.round(duration)}초)`);
      if (elapsed >= duration - 0.35 && recorder.state === 'recording') {
        youtubePlayerRef.pause?.();
        recorder.stop();
      }
    }, 400);

    safetyTimer = setTimeout(() => {
      if (recorder.state === 'recording') {
        youtubePlayerRef.pause?.();
        recorder.stop();
      }
    }, (duration + 20) * 1000);
  });
}
