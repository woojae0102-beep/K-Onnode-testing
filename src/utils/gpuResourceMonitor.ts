// @ts-nocheck
/**
 * GPU / 브라우저 미디어 리소스 모니터 — Heap 외 ImageBitmap, VideoFrame,
 * Canvas/WebGL 컨텍스트 생성·해제를 추적한다.
 *
 * 정확도 한계:
 * - transferToImageBitmap() 등 내부 API는 후킹하지 않는다.
 * - WebGL context 수는 getContext 호출 횟수 기반 근사이다.
 */
import { featureFlagManager } from '../config/featureFlagManager';

export type GpuResourceSnapshot = {
  imageBitmapCreated: number;
  imageBitmapClosed: number;
  imageBitmapLive: number;
  videoFrameCreated: number;
  videoFrameClosed: number;
  videoFrameLive: number;
  canvasCreated: number;
  canvasRemoved: number;
  canvasLive: number;
  webglContextCreated: number;
  webglContextLost: number;
  webglContextLive: number;
  sampledAtMs: number;
};

let imageBitmapCreated = 0;
let imageBitmapClosed = 0;
let videoFrameCreated = 0;
let videoFrameClosed = 0;
let canvasCreated = 0;
let canvasRemoved = 0;
let webglContextCreated = 0;
let webglContextLost = 0;
let patched = false;

const canvasRegistry = new WeakSet<HTMLCanvasElement>();

function isMonitoringEnabled(): boolean {
  return featureFlagManager.get('gpuResourceMonitoringEnabled');
}

export function getGpuResourceSnapshot(): GpuResourceSnapshot {
  return {
    imageBitmapCreated,
    imageBitmapClosed,
    imageBitmapLive: Math.max(0, imageBitmapCreated - imageBitmapClosed),
    videoFrameCreated,
    videoFrameClosed,
    videoFrameLive: Math.max(0, videoFrameCreated - videoFrameClosed),
    canvasCreated,
    canvasRemoved,
    canvasLive: Math.max(0, canvasCreated - canvasRemoved),
    webglContextCreated,
    webglContextLost,
    webglContextLive: Math.max(0, webglContextCreated - webglContextLost),
    sampledAtMs: Date.now(),
  };
}

/** ImageBitmap / VideoFrame 수동 추적 — 후킹이 적용되지 않은 Worker 경로용 */
export function trackImageBitmapCreate(count = 1): void {
  if (!isMonitoringEnabled()) return;
  imageBitmapCreated += count;
}

export function trackImageBitmapClose(count = 1): void {
  if (!isMonitoringEnabled()) return;
  imageBitmapClosed += count;
}

export function trackVideoFrameCreate(count = 1): void {
  if (!isMonitoringEnabled()) return;
  videoFrameCreated += count;
}

export function trackVideoFrameClose(count = 1): void {
  if (!isMonitoringEnabled()) return;
  videoFrameClosed += count;
}

function patchImageBitmap(): void {
  if (typeof createImageBitmap !== 'function') return;
  const original = createImageBitmap.bind(globalThis);
  (globalThis as any).createImageBitmap = async (...args: unknown[]) => {
    const bitmap = await original(...args);
    if (isMonitoringEnabled()) imageBitmapCreated += 1;
    return bitmap;
  };
  if (typeof ImageBitmap !== 'undefined' && ImageBitmap.prototype?.close) {
    const origClose = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function patchedClose(...args: unknown[]) {
      if (isMonitoringEnabled()) imageBitmapClosed += 1;
      return origClose.apply(this, args);
    };
  }
}

function patchVideoFrame(): void {
  if (typeof VideoFrame === 'undefined') return;
  const Orig = VideoFrame;
  (globalThis as any).VideoFrame = function PatchedVideoFrame(...args: unknown[]) {
    if (isMonitoringEnabled()) videoFrameCreated += 1;
    return new Orig(...args);
  };
  (globalThis as any).VideoFrame.prototype = Orig.prototype;
  if (Orig.prototype?.close) {
    const origClose = Orig.prototype.close;
    Orig.prototype.close = function patchedClose(...args: unknown[]) {
      if (isMonitoringEnabled()) videoFrameClosed += 1;
      return origClose.apply(this, args);
    };
  }
}

function patchCanvas(): void {
  const origCreate = document.createElement.bind(document);
  document.createElement = function patchedCreate(tagName: string, options?: unknown) {
    const el = origCreate(tagName, options);
    if (isMonitoringEnabled() && String(tagName).toLowerCase() === 'canvas' && el instanceof HTMLCanvasElement) {
      canvasCreated += 1;
      canvasRegistry.add(el);
      const origRemove = el.remove.bind(el);
      el.remove = function patchedRemove(...args: unknown[]) {
        if (canvasRegistry.has(el)) {
          canvasRemoved += 1;
          canvasRegistry.delete(el);
        }
        return origRemove(...args);
      };
      const origGetContext = el.getContext.bind(el);
      el.getContext = function patchedGetContext(type: string, ...args: unknown[]) {
        const ctx = origGetContext(type, ...args);
        if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
          webglContextCreated += 1;
          ctx.canvas?.addEventListener?.('webglcontextlost', () => {
            webglContextLost += 1;
          });
        }
        return ctx;
      };
    }
    return el;
  };
}

/** 앱 시작 시 1회 호출 — 중복 패치 방지 */
export function initGpuResourceMonitor(): void {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  if (!isMonitoringEnabled()) return;
  try {
    patchImageBitmap();
    patchVideoFrame();
    patchCanvas();
    console.info('[GpuResourceMonitor] 패치 적용');
  } catch (err) {
    console.warn('[GpuResourceMonitor] 패치 실패', err);
  }
}
