// @ts-nocheck
import React, { useCallback, useEffect, useRef } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import { computeAspectFitSize } from '../../utils/canvasSkeletonUtils';
import { renderStageFrame, type StageFrameRenderInput } from '../../utils/groupSkeletonDraw';

export interface SkeletonRendererProps {
  frame: SkeletonFrameData | null;
  aiMembers: StageFrameRenderInput['aiMembers'];
  userJoints?: StageFrameRenderInput['userJoints'];
  userColor?: string;
  userAnchor?: StageFrameRenderInput['userAnchor'];
  ghostAnchor?: StageFrameRenderInput['ghostAnchor'];
  videoWidth?: number;
  videoHeight?: number;
  className?: string;
}

/**
 * Stage Skeleton Layer — 매 프레임 SkeletonRenderTransform 적용.
 */
export default function SkeletonRenderer({
  frame,
  aiMembers,
  userJoints,
  userColor,
  userAnchor,
  ghostAnchor,
  videoWidth = 1920,
  videoHeight = 1080,
  className = '',
}: SkeletonRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const parentW = rect.width > 0 ? rect.width : canvas.parentElement.clientWidth || 640;
    const parentH = rect.height > 0 ? rect.height : canvas.parentElement.clientHeight || 360;
    const { width: renderW, height: renderH } = computeAspectFitSize(videoWidth, videoHeight, parentW, parentH);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(renderW * dpr);
    canvas.height = Math.round(renderH * dpr);
    canvas.style.width = `${renderW}px`;
    canvas.style.height = `${renderH}px`;
    canvas._logicalWidth = renderW;
    canvas._logicalHeight = renderH;
    canvas._videoWidth = videoWidth;
    canvas._videoHeight = videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [videoWidth, videoHeight]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let members = aiMembers;
    if (frame?.members?.length && !aiMembers.length) {
      members = frame.members
        .filter((m) => m.estimatedMemberId && m.joints && Object.keys(m.joints).length)
        .map((m) => ({
          joints: m.joints,
          color: '#FF1F8E',
          name: m.estimatedMemberId,
          isEstimated: m.isEstimated,
        }));
    }

    renderStageFrame(ctx, canvas, {
      aiMembers: members,
      userJoints,
      userColor,
      userAnchor,
      ghostAnchor,
    });
  }, [frame, aiMembers, userJoints, userColor, userAnchor, ghostAnchor]);

  useEffect(() => {
    resizeCanvas();
    draw();
    window.addEventListener('resize', resizeCanvas);
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { resizeCanvas(); draw(); })
      : null;
    if (canvasRef.current?.parentElement && ro) {
      ro.observe(canvasRef.current.parentElement);
    }
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      ro?.disconnect();
    };
  }, [resizeCanvas, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`group-studio-stage-canvas group-studio-skeleton-layer ${className}`.trim()}
      aria-hidden
    />
  );
}
