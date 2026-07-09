// @ts-nocheck
import React, { forwardRef } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import GroupStageCanvas, {
  type GroupStageCanvasHandle,
} from './GroupStageCanvas';
import type { GroupStudioRendererOptions } from '../../services/rendering/GroupStudioRenderer';
import type { SkeletonRenderTransform } from '../../utils/SkeletonRenderTransform';
import type { FormationHole, FormationTimeline } from '../../types/danceDatabase';

export interface GroupDanceStage2DProps {
  groupId?: string;
  focusMemberId?: string;
  formationTimeline?: FormationTimeline | null;
  formationHole?: FormationHole | null;
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
  function GroupDanceStage2D({
    groupId = '',
    focusMemberId = '',
    formationTimeline = null,
    formationHole = null,
    className = '',
  }, ref) {
    return (
      <GroupStageCanvas
        ref={ref as React.Ref<GroupStageCanvasHandle>}
        groupId={groupId}
        focusMemberId={focusMemberId}
        formationTimeline={formationTimeline}
        formationHole={formationHole}
        className={className}
      />
    );
  },
);

export default GroupDanceStage2D;
