// @ts-nocheck
import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface StageCanvasLogicalSize {
  width: number;
  height: number;
}

/** 부모 Div 크기 → Canvas logical/pixel 동기화 (고정 크기 없음) */
export function syncStageCanvasToParent(
  canvas: HTMLCanvasElement | null | undefined,
): StageCanvasLogicalSize {
  if (!canvas?.parentElement) return { width: 0, height: 0 };

  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
  const parentW = Math.max(1, Math.round(rect.width > 0 ? rect.width : parent.clientWidth));
  const parentH = Math.max(1, Math.round(rect.height > 0 ? rect.height : parent.clientHeight));
  const dpr = window.devicePixelRatio || 1;
  const pixelW = Math.round(parentW * dpr);
  const pixelH = Math.round(parentH * dpr);

  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  canvas.style.width = `${parentW}px`;
  canvas.style.height = `${parentH}px`;
  canvas._logicalWidth = parentW;
  canvas._logicalHeight = parentH;

  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { width: parentW, height: parentH };
}

/** Stage Canvas — ResizeObserver + 프레임마다 부모 크기 추적 */
export function useStageCanvasResize(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const logicalSizeRef = useRef<StageCanvasLogicalSize>({ width: 0, height: 0 });

  const resizeCanvas = useCallback(() => {
    const size = syncStageCanvasToParent(canvasRef.current);
    logicalSizeRef.current = size;
    return size;
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return undefined;

    resizeCanvas();

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resizeCanvas())
      : null;
    ro?.observe(parent);

    const onWindowResize = () => resizeCanvas();
    window.addEventListener('resize', onWindowResize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [canvasRef, resizeCanvas]);

  return { resizeCanvas, logicalSizeRef, syncToParent: resizeCanvas };
}

export default useStageCanvasResize;
