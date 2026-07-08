// @ts-nocheck
import React, { forwardRef } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import GroupStageCanvas, {
  type GroupStageCanvasHandle,
} from './GroupStageCanvas';
import type { StageFrameRenderInput } from '../../utils/groupSkeletonDraw';
import type { SkeletonRenderTransform } from '../../utils/SkeletonRenderTransform';

export interface GroupDanceStage2DProps {
  frame?: SkeletonFrameData | null;
  className?: string;
}

export interface GroupDanceStage2DHandle {
  draw: (input: StageFrameRenderInput) => SkeletonRenderTransform | null;
  resize: () => { width: number; height: number };
}

/** GroupStageCanvas imperative API — Session 하위 호환 */
const GroupDanceStage2D = forwardRef<GroupDanceStage2DHandle, GroupDanceStage2DProps>(
  function GroupDanceStage2D({ frame = null, className = '' }, ref) {
    return (
      <GroupStageCanvas
        ref={ref as React.Ref<GroupStageCanvasHandle>}
        frame={frame}
        className={className}
      />
    );
  },
);

export default GroupDanceStage2D;
