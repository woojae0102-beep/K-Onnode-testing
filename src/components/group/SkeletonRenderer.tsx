// @ts-nocheck
import React, { useMemo } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import GroupStageCanvas from './GroupStageCanvas';

export interface SkeletonRendererProps {
  referenceFrame?: SkeletonFrameData | null;
  groupId?: string;
  focusMemberId?: string;
  className?: string;
}

/**
 * 선언형 Stage Skeleton — referenceFrames[currentFrame]만 렌더.
 */
export default function SkeletonRenderer({
  referenceFrame = null,
  groupId = '',
  focusMemberId = '',
  className = '',
}: SkeletonRendererProps) {
  const frame = useMemo(() => referenceFrame, [referenceFrame]);

  return (
    <GroupStageCanvas
      className={className}
      canvasClassName="group-dance-stage-2d-canvas group-studio-skeleton-layer"
      referenceFrame={frame}
      groupId={groupId}
      focusMemberId={focusMemberId}
    />
  );
}
