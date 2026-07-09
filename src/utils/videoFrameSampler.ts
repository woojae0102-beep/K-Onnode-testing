// @ts-nocheck
import { scheduleVideoFrame, cancelVideoFrame } from './cameraFrameLoop';
import { waitForVideoEvent } from './choreoVideoUtils';

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
  onDecode?: (decodeWaitMs: number) => void;
};

function supportsRvfc(video: HTMLVideoElement): boolean {
  return typeof video.requestVideoFrameCallback === 'function';
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
  onDecode,
}: SampleVideoFramesOptions): Promise<void> {
  if (!video) throw new Error('비디오 요소가 없습니다.');

  const sampleInterval = 1 / Math.max(1, sampleFps);
  const rawDuration = Number(video.duration) || 0;
  const endTime = maxDuration ?? rawDuration;

  if (!Number.isFinite(endTime) || endTime <= 0) {
    throw new Error('영상 길이를 확인할 수 없습니다.');
  }

  if (!supportsRvfc(video)) {
    throw new Error('requestVideoFrameCallback 미지원 브라우저입니다. Chrome/Edge 최신 버전을 사용해 주세요.');
  }

  video.muted = true;
  video.playsInline = true;
  video.playbackRate = 1;

  await waitForVideoEvent(video, 'canplay', 30000);
  if (video.currentTime > 0.05) {
    video.currentTime = 0;
  }

  let nextSampleTime = 0;
  let handle = null;
  let settled = false;
  let lastRvfcAt = performance.now();

  const cleanup = () => {
    if (settled) return;
    settled = true;
    video.pause();
    cancelVideoFrame(handle);
  };

  await new Promise<void>((resolve, reject) => {
    const onFrame = async (_now: number, metadata?: { mediaTime?: number }) => {
      const frameArrivedAt = performance.now();
      onDecode?.(frameArrivedAt - lastRvfcAt);
      lastRvfcAt = frameArrivedAt;

      if (abortRef?.current) {
        cleanup();
        resolve();
        return;
      }

      const currentTime = Number(video.currentTime) || 0;
      const metadataTime = metadata?.mediaTime;
      const mediaTime = Number.isFinite(metadataTime)
        ? Math.min(metadataTime, currentTime || metadataTime)
        : currentTime;
      const reachedDuration = currentTime >= endTime - 0.05;

      while (nextSampleTime <= endTime && mediaTime + 1e-3 >= nextSampleTime) {
        const sampleTime = nextSampleTime;
        nextSampleTime += sampleInterval;
        try {
          await onSample({ time: sampleTime, video, mediaTime });
        } catch (err) {
          cleanup();
          reject(err);
          return;
        }
        onProgress?.(Math.min(99, Math.round((sampleTime / endTime) * 100)));

        if (abortRef?.current) {
          cleanup();
          resolve();
          return;
        }
      }

      if (video.ended || reachedDuration) {
        while (!abortRef?.current && nextSampleTime <= endTime + 1e-3) {
          const sampleTime = Math.min(nextSampleTime, endTime);
          nextSampleTime += sampleInterval;
          try {
            await onSample({ time: sampleTime, video, mediaTime });
          } catch (err) {
            cleanup();
            reject(err);
            return;
          }
          onProgress?.(Math.min(99, Math.round((sampleTime / endTime) * 100)));
        }
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
