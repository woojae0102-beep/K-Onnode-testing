// @ts-nocheck
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import { useStageCanvasResize } from '../../hooks/useStageCanvasResize';
import {
  renderStageFrame,
  type StageFrameRenderInput,
} from '../../utils/groupSkeletonDraw';
import type { SkeletonRenderTransform } from '../../utils/SkeletonRenderTransform';

export interface GroupStageCanvasProps {
  /** 선언형 — props 변경 시 자동 draw */
  renderInput?: StageFrameRenderInput | null;
  frame?: SkeletonFrameData | null;
  className?: string;
  canvasClassName?: string;
}

export interface GroupStageCanvasHandle {
  draw: (input: StageFrameRenderInput) => SkeletonRenderTransform | null;
  resize: () => { width: number; height: number };
}

/**
 * Group Studio 통합 Stage Canvas — Session / TV / 미러 공용.
 * ResizeObserver(부모 추적) + BBox Auto Fit + Formation 파이프라인.
 */
const GroupStageCanvas = forwardRef<GroupStageCanvasHandle, GroupStageCanvasProps>(
  function GroupStageCanvas({
    renderInput = null,
    frame = null,
    className = '',
    canvasClassName = 'group-dance-stage-2d-canvas group-studio-stage-canvas',
  }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { resizeCanvas, logicalSizeRef } = useStageCanvasResize(canvasRef);
    const lastInputRef = useRef<StageFrameRenderInput | null>(null);

    const draw = useCallback((input: StageFrameRenderInput) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const size = resizeCanvas();
      lastInputRef.current = input;

      let members = input.aiMembers;
      if (!members.length && frame?.members?.length) {
        members = frame.members
          .filter((m) => m.estimatedMemberId && m.joints && Object.keys(m.joints).length)
          .map((m) => ({
            memberId: m.estimatedMemberId,
            joints: m.joints,
            color: '#FF1F8E',
            name: m.estimatedMemberId,
            isEstimated: m.isEstimated,
          }));
      }

      return renderStageFrame(ctx, canvas, { ...input, aiMembers: members }, size);
    }, [frame, resizeCanvas]);

    useImperativeHandle(ref, () => ({
      draw,
      resize: resizeCanvas,
    }), [draw, resizeCanvas]);

    useEffect(() => {
      resizeCanvas();
      const input = renderInput || lastInputRef.current;
      if (input) draw(input);
    }, [resizeCanvas, draw, renderInput]);

    return (
      <div className={`group-dance-stage-2d group-stage-canvas ${className}`.trim()}>
        <canvas
          ref={canvasRef}
          className={canvasClassName}
          aria-label="Group dance stage"
        />
      </div>
    );
  },
);

export default GroupStageCanvas;
