// @ts-nocheck
import React, { useMemo } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import GroupStageCanvas from './GroupStageCanvas';
import type { FormationHole, FormationTimeline } from '../../types/danceDatabase';

export interface SkeletonRendererProps {
  referenceFrame?: SkeletonFrameData | null;
  groupId?: string;
  focusMemberId?: string;
  userMemberId?: string;
  formationTimeline?: FormationTimeline | null;
  formationHole?: FormationHole | null;
  className?: string;
}

/**
 * 선언형 Stage Skeleton — referenceFrames[currentFrame]만 렌더.
 */
export default function SkeletonRenderer({
  referenceFrame = null,
  groupId = '',
  focusMemberId = '',
  userMemberId = '',
  formationTimeline = null,
  formationHole = null,
  className = '',
}: SkeletonRendererProps) {
  const frame = useMemo(() => referenceFrame, [referenceFrame]);

  return (
    <GroupStageCanvas
      className={className}
      canvasClassName="group-dance-stage-2d-canvas group-studio-skeleton-layer"
      referenceFrame={frame}
      groupId={groupId}
      focusMemberId={focusMemberId || userMemberId}
      formationTimeline={formationTimeline}
      formationHole={formationHole}
    />
  );
}
