// @ts-nocheck
import React, { forwardRef } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import GroupStageCanvas, {
  type GroupStageCanvasHandle,
} from './GroupStageCanvas';
import type { GroupStudioRendererOptions } from '../../services/rendering/GroupStudioRenderer';
import type { SkeletonRenderTransform } from '../../utils/SkeletonRenderTransform';

export interface GroupDanceStage2DProps {
  groupId?: string;
  focusMemberId?: string;
  className?: string;
}

export interface GroupDanceStage2DHandle {
  drawReferenceFrame: (
    frame: SkeletonFrameData | null | undefined,
    options?: GroupStudioRendererOptions,
  ) => SkeletonRenderTransform | null;
  resize: () => { width: number; height: number };
}

const GroupDanceStage2D = forwardRef<GroupDanceStage2DHandle, GroupDanceStage2DProps>(
  function GroupDanceStage2D({ groupId = '', focusMemberId = '', className = '' }, ref) {
    return (
      <GroupStageCanvas
        ref={ref as React.Ref<GroupStageCanvasHandle>}
        groupId={groupId}
        focusMemberId={focusMemberId}
        className={className}
      />
    );
  },
);

export default GroupDanceStage2D;
