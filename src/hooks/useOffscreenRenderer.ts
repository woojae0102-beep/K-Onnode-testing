// @ts-nocheck
/**
 * OffscreenCanvas Renderer Bridge — GroupStageCanvas / CameraPreviewStack용.
 * Feature Flag(RENDERER_WORKER_ENABLED)가 false이거나 transferControlToOffscreen 미지원 시
 * 호출부는 기존 메인 스레드 renderGroupStudioFrame 경로를 그대로 사용한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isRendererWorkerEnabled } from '../config/pipelineConfig';
import { pipelineEventBus, pipelineRegistry } from '../utils/pipelineEventBus';
import { createManagedWorker } from '../utils/workerRecovery';
import { recordWorkerError } from '../utils/pipelineTelemetry';
import { handleWorkerMessageForHealth, registerWorkerHealth } from '../utils/workerHealthMonitor';
import { pipelineDiagnostics } from '../utils/pipelineDiagnostics';
import type { SkeletonFrameData } from '../types/groupPractice';
import type { GroupStudioRendererOptions } from '../services/rendering/GroupStudioRenderer';

export function isOffscreenRendererSupported(): boolean {
  if (!isRendererWorkerEnabled()) return false;
  if (typeof Worker === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return typeof canvas.transferControlToOffscreen === 'function';
}

export type OffscreenRendererBridge = {
  enabled: boolean;
  drawGroupFrame: (
    frame: SkeletonFrameData,
    options: GroupStudioRendererOptions,
    memberColorMap: Record<string, { color: string; name: string }>,
    frameIndex?: number,
  ) => void;
  clear: () => void;
  resize: (width: number, height: number, dpr?: number) => void;
};

export function useOffscreenRenderer(
  canvasRef,
  surface = 'group-stage',
): OffscreenRendererBridge {
  const managedRef = useRef<ReturnType<typeof createManagedWorker> | null>(null);
  const unregisterHealthRef = useRef<(() => void) | null>(null);
  const [enabled, setEnabled] = useState(false);
  const unregisterRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOffscreenRendererSupported()) return;

    let disposed = false;
    const workerUrl = new URL('../workers/rendererWorker.ts', import.meta.url);
    const initRenderer = (worker: Worker) => {
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({
        type: 'INIT',
        canvas: offscreen,
        width: canvas.clientWidth || 300,
        height: canvas.clientHeight || 200,
        dpr: window.devicePixelRatio || 1,
      }, [offscreen]);
    };

    const managed = createManagedWorker({
      name: `renderer-${surface}`,
      workerUrl,
      subsystem: 'renderer',
      maxRestarts: 2,
      onWorkerCreated: (worker, attempt) => {
        if (attempt > 0) {
          // OffscreenCanvas는 1회만 transfer 가능 — 재생성 시 메인 스레드 폴백
          recordWorkerError(`renderer-${surface}`, 'Offscreen 재전송 불가 — 메인 스레드 폴백');
          if (!disposed) setEnabled(false);
          throw new Error('offscreen-retransfer-unsupported');
        }
        initRenderer(worker);
      },
      onFatal: () => {
        if (!disposed) setEnabled(false);
      },
    });

    managedRef.current = managed;
    unregisterHealthRef.current = registerWorkerHealth({
      name: `renderer-${surface}`,
      subsystem: 'renderer',
      postMessage: (m) => managed.postMessage(m),
      managed: true,
    });
    setEnabled(true);
    unregisterRef.current = pipelineRegistry.register({
      name: `rendererWorker:${surface}`,
      subsystem: 'renderer',
      kind: 'renderer',
      meta: { surface },
    });

    const onMessage = (event: MessageEvent) => {
      const msg = event.data || {};
      if (handleWorkerMessageForHealth(`renderer-${surface}`, msg)) return;
      if (msg.type === 'DRAW_DONE') {
        pipelineEventBus.emit('renderer-frame-drawn', {
          surface: msg.surface || surface,
          frameIndex: msg.frameIndex ?? 0,
          drawMs: msg.drawMs ?? 0,
        });
      }
    };
    managed.addEventListener('message', onMessage);

    return () => {
      disposed = true;
      managed.removeEventListener('message', onMessage);
      managed.terminate();
      managedRef.current = null;
      unregisterHealthRef.current?.();
      unregisterHealthRef.current = null;
      setEnabled(false);
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, [canvasRef, surface]);

  const drawGroupFrame = useCallback((
    frame: SkeletonFrameData,
    options: GroupStudioRendererOptions,
    memberColorMap: Record<string, { color: string; name: string }>,
    frameIndex = 0,
  ) => {
    if (!enabled || !managedRef.current) return;
    pipelineDiagnostics.markTimeline((frameIndex ?? 0) / 30, 'renderer-start', frameIndex);
    managedRef.current.postMessage({
      type: 'DRAW_GROUP_FRAME',
      surface,
      frame,
      options,
      memberColorMap,
      frameIndex,
    });
  }, [surface]);

  const clear = useCallback(() => {
    managedRef.current?.postMessage({ type: 'CLEAR' });
  }, []);

  const resize = useCallback((width: number, height: number, dpr = window.devicePixelRatio || 1) => {
    managedRef.current?.postMessage({ type: 'RESIZE', width, height, dpr });
  }, []);

  return {
    enabled,
    drawGroupFrame,
    clear,
    resize,
  };
}
