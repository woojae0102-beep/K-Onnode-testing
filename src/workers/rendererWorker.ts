// @ts-nocheck
/**
 * Renderer Worker — Group Skeleton / Camera Overlay를 OffscreenCanvas에서 그린다.
 * 메인 스레드 React는 resize·제어만 담당하고 픽셀 그리기는 이 Worker가 수행한다.
 */
import { renderGroupStudioFrame } from '../services/rendering/GroupStudioRenderer';
import { startWorkerMemoryReporter } from '../utils/memoryProfiler';

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let logicalW = 0;
let logicalH = 0;
let dpr = 1;

startWorkerMemoryReporter('renderer', (msg) => self.postMessage(msg));

function post(type: string, payload: Record<string, unknown> = {}) {
  self.postMessage({ type, ...payload });
}

function ensureCanvas(w: number, h: number, devicePixelRatio = 1) {
  if (!canvas) return;
  dpr = devicePixelRatio;
  logicalW = w;
  logicalH = h;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style = { width: `${w}px`, height: `${h}px` } as any;
  ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

self.onmessage = (event) => {
  const msg = event.data || {};

  if (msg.type === 'PING') {
    post('PONG', { pingId: msg.pingId, atMs: performance.now() });
    return;
  }

  if (msg.type === 'INIT') {
    canvas = msg.canvas as OffscreenCanvas;
    ensureCanvas(msg.width ?? 300, msg.height ?? 200, msg.dpr ?? 1);
    post('INIT_DONE');
    return;
  }

  if (msg.type === 'RESIZE') {
    ensureCanvas(msg.width ?? logicalW, msg.height ?? logicalH, msg.dpr ?? dpr);
    post('RESIZED');
    return;
  }

  if (msg.type === 'DRAW_GROUP_FRAME') {
    if (!ctx || !canvas) {
      post('DRAW_ERROR', { error: 'Canvas not initialized' });
      return;
    }
    const startedAt = performance.now();
    try {
      renderGroupStudioFrame(ctx, canvas as unknown as HTMLCanvasElement, msg.frame, {
        ...(msg.options || {}),
        memberColorMap: msg.memberColorMap || {},
        logicalSize: { width: logicalW, height: logicalH },
      });
      post('DRAW_DONE', {
        surface: msg.surface || 'group-stage',
        frameIndex: msg.frameIndex ?? 0,
        drawMs: performance.now() - startedAt,
      });
    } catch (err: any) {
      post('DRAW_ERROR', { error: err?.message || String(err) });
    }
    return;
  }

  if (msg.type === 'CLEAR') {
    if (ctx && canvas) {
      ctx.clearRect(0, 0, logicalW, logicalH);
    }
    post('CLEARED');
    return;
  }
};
