// @ts-nocheck
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useStageCanvasResize } from '../../hooks/useStageCanvasResize';
import {
  renderGroupStudioFrame,
  type GroupStudioRendererOptions,
} from '../../services/rendering/GroupStudioRenderer';
import type { SkeletonRenderTransform } from '../../utils/SkeletonRenderTransform';

export interface GroupStageCanvasProps {
  /** referenceFrames[currentFrame] — 렌더러 유일 입력 */
  referenceFrame?: SkeletonFrameData | null;
  groupId?: string;
  excludeMemberId?: string;
  className?: string;
  canvasClassName?: string;
}

export interface GroupStageCanvasHandle {
  drawReferenceFrame: (
    frame: SkeletonFrameData | null | undefined,
    options?: GroupStudioRendererOptions,
  ) => SkeletonRenderTransform | null;
  resize: () => { width: number; height: number };
}

/**
 * Group Studio Stage Canvas — referenceFrames[currentFrame]만 렌더.
 */
const GroupStageCanvas = forwardRef<GroupStageCanvasHandle, GroupStageCanvasProps>(
  function GroupStageCanvas({
    referenceFrame = null,
    groupId = '',
    excludeMemberId = '',
    className = '',
    canvasClassName = 'group-dance-stage-2d-canvas group-studio-stage-canvas',
  }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { resizeCanvas } = useStageCanvasResize(canvasRef);
    const lastFrameRef = useRef<SkeletonFrameData | null>(null);

    const memberColorMap = useMemo(() => {
      const group = GROUP_DATA[groupId];
      const map: Record<string, { color: string; name: string }> = {};
      group?.members.forEach((m) => {
        map[m.id] = { color: m.color, name: m.nameKr };
      });
      return map;
    }, [groupId]);

    const drawReferenceFrame = useCallback((
      frame: SkeletonFrameData | null | undefined,
      options: GroupStudioRendererOptions = {},
    ) => {
      const canvas = canvasRef.current;
      if (!canvas || !frame) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const size = resizeCanvas();
      lastFrameRef.current = frame;

      return renderGroupStudioFrame(ctx, canvas, frame, {
        memberColorMap: options.memberColorMap ?? memberColorMap,
        excludeMemberId: options.excludeMemberId ?? excludeMemberId,
        logicalSize: size,
      });
    }, [resizeCanvas, memberColorMap, excludeMemberId]);

    useImperativeHandle(ref, () => ({
      drawReferenceFrame,
      resize: resizeCanvas,
    }), [drawReferenceFrame, resizeCanvas]);

    useEffect(() => {
      resizeCanvas();
      const frame = referenceFrame || lastFrameRef.current;
      if (frame) drawReferenceFrame(frame);
    }, [resizeCanvas, drawReferenceFrame, referenceFrame]);

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
