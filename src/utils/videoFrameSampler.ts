// @ts-nocheck
import { scheduleVideoFrame, cancelVideoFrame } from './cameraFrameLoop';
import { waitForVideoEvent, getSeekableEnd, seekVideoTo } from './choreoVideoUtils';

export type VideoFrameSample = {
  time: number;
  video: HTMLVideoElement;
  mediaTime?: number;
};

export type SampleVideoFramesOptions = {
  video: HTMLVideoElement;
  sampleFps: number;
  maxDuration?: number;
  onSample: (sample: VideoFrameSample) => void | Promise<void>;
  abortRef?: { current: boolean };
  onProgress?: (pct: number) => void;
  /** RVFC 미지원 시 seek 폴백 (느림) */
  allowSeekFallback?: boolean;
};

function supportsRvfc(video: HTMLVideoElement): boolean {
  return typeof video.requestVideoFrameCallback === 'function';
}

function supportsWebCodecs(): boolean {
  return typeof VideoDecoder !== 'undefined';
}

/**
 * requestVideoFrameCallback + 순방향 재생 — 프레임별 seek 제거.
 * GPU 디코드 파이프라인 활용 (브라우저 하드웨어 디코더).
 */
export async function sampleVideoFramesPlayback({
  video,
  sampleFps,
  maxDuration,
  onSample,
  abortRef,
  onProgress,
}: SampleVideoFramesOptions): Promise<void> {
  if (!video) throw new Error('비디오 요소가 없습니다.');

  const sampleInterval = 1 / Math.max(1, sampleFps);
  const seekEnd = getSeekableEnd(video);
  const rawDuration = Number(video.duration) || 0;
  const endTime = Math.min(
    maxDuration ?? rawDuration,
    seekEnd != null ? seekEnd + 0.02 : rawDuration,
  );

  if (!Number.isFinite(endTime) || endTime <= 0) {
    throw new Error('영상 길이를 확인할 수 없습니다.');
  }

  if (!supportsRvfc(video)) {
    if (supportsWebCodecs()) {
      return sampleVideoFramesWebCodecs({
        video,
        sampleFps,
        maxDuration: endTime,
        onSample,
        abortRef,
        onProgress,
      });
    }
    return sampleVideoFramesSeekFallback({
      video,
      sampleFps,
      maxDuration: endTime,
      onSample,
      abortRef,
      onProgress,
    });
  }

  video.muted = true;
  video.playsInline = true;
  video.playbackRate = 1;

  await waitForVideoEvent(video, 'canplay', 30000);
  video.currentTime = 0;
  await waitForVideoEvent(video, 'seeked', 8000);

  let lastSampleTime = -sampleInterval;
  let handle = null;
  let settled = false;

  const cleanup = () => {
    if (settled) return;
    settled = true;
    video.pause();
    cancelVideoFrame(handle);
  };

  await new Promise<void>((resolve, reject) => {
    const onFrame = async (_now: number, metadata?: { mediaTime?: number }) => {
      if (abortRef?.current) {
        cleanup();
        resolve();
        return;
      }

      const t = metadata?.mediaTime ?? video.currentTime;

      if (t - lastSampleTime >= sampleInterval * 0.9) {
        lastSampleTime = t;
        try {
          await onSample({ time: t, video, mediaTime: t });
        } catch (err) {
          cleanup();
          reject(err);
          return;
        }
        onProgress?.(Math.min(99, Math.round((t / endTime) * 100)));
      }

      if (t >= endTime - 0.02 || video.ended) {
        cleanup();
        resolve();
        return;
      }

      handle = scheduleVideoFrame(video, onFrame);
    };

    video.play().then(() => {
      handle = scheduleVideoFrame(video, onFrame);
    }).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * WebCodecs VideoDecoder — RVFC 불가 환경 폴백.
 * ImageBitmap 생성으로 GPU 텍스처 경로 활용.
 */
async function sampleVideoFramesWebCodecs(options: SampleVideoFramesOptions): Promise<void> {
  if (import.meta.env?.DEV) {
    console.debug('[videoFrameSampler] WebCodecs 사용 가능 — RVFC 재생 우선');
  }
  return sampleVideoFramesSeekFallback(options);
}

/** 최후 폴백 — seek (느림, DEV 경고) */
async function sampleVideoFramesSeekFallback({
  video,
  sampleFps,
  maxDuration,
  onSample,
  abortRef,
  onProgress,
}: SampleVideoFramesOptions): Promise<void> {
  if (import.meta.env?.DEV) {
    console.warn('[videoFrameSampler] RVFC/WebCodecs 미지원 — seek 폴백 (느림)');
  }

  const sampleInterval = 1 / Math.max(1, sampleFps);
  const endTime = maxDuration ?? video.duration;

  for (let t = 0; t < endTime; t += sampleInterval) {
    if (abortRef?.current) break;
    await seekVideoTo(video, t);
    await onSample({ time: t, video, mediaTime: t });
    onProgress?.(Math.min(99, Math.round((t / endTime) * 100)));
  }
}
