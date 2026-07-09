// @ts-nocheck
import { prefersDirectVideoDisplay } from './cameraDisplay';

export type FrameLoopHandle = {
  type: 'rvfc' | 'raf';
  id: number;
  video?: HTMLVideoElement | null;
};

export function scheduleVideoFrame(
  video: HTMLVideoElement | null | undefined,
  callback: (now: number, metadata?: { mediaTime?: number }) => void,
): FrameLoopHandle {
  if (video && typeof video.requestVideoFrameCallback === 'function') {
    // metadata(mediaTime 포함)를 반드시 그대로 전달한다 — 이전에는 (now) => callback(now)로
    // 감싸면서 metadata가 누락되어 호출부의 metadata.mediaTime이 항상 undefined였다.
    const id = video.requestVideoFrameCallback((now, metadata) => callback(now, metadata));
    return { type: 'rvfc', id, video };
  }
  const id = requestAnimationFrame(() => callback(performance.now()));
  return { type: 'raf', id };
}

export function cancelVideoFrame(handle: FrameLoopHandle | null | undefined) {
  if (!handle) return;
  if (handle.type === 'rvfc' && handle.video?.cancelVideoFrameCallback) {
    handle.video.cancelVideoFrameCallback(handle.id);
    return;
  }
  if (handle.type === 'raf') {
    cancelAnimationFrame(handle.id);
  }
}

export function getOptimizedCanvasContext(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas) return null;
  return canvas.getContext('2d', { alpha: true, desynchronized: true });
}

export function syncCanvasToVideo(canvas: HTMLCanvasElement | null | undefined, video: HTMLVideoElement | null | undefined) {
  if (!canvas || !video?.videoWidth || !video?.videoHeight) return false;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

export function syncCanvasToDisplayRect(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

export function isDefaultCameraFilter(filter: { brightness?: number; contrast?: number; saturation?: number } = {}) {
  return filter.brightness === 1 && filter.contrast === 1 && filter.saturation === 1;
}

/** 모바일은 video 직접 표시, 데스크톱은 필터 없을 때 canvas 복사 루프 생략 */
export function shouldPreferDirectVideoDisplay(
  filter: { brightness?: number; contrast?: number; saturation?: number } = {},
) {
  return prefersDirectVideoDisplay() || isDefaultCameraFilter(filter);
}
