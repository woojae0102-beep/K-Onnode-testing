// @ts-nocheck
import React, { useMemo } from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import GroupStageCanvas from './GroupStageCanvas';
import { buildStageRenderInput } from '../../utils/stageRenderInputBuilder';
import type { StageFrameRenderInput } from '../../utils/groupSkeletonDraw';

export interface SkeletonRendererProps extends StageFrameRenderInput {
  frame?: SkeletonFrameData | null;
  memberColorMap?: Record<string, { color: string; name: string }>;
  className?: string;
}

function buildAiMembersFromFrame(
  frame: SkeletonFrameData | null | undefined,
  memberColorMap: Record<string, { color: string; name: string }> = {},
  fallbackAiMembers: StageFrameRenderInput['aiMembers'] = [],
): StageFrameRenderInput['aiMembers'] {
  if (fallbackAiMembers.length) return fallbackAiMembers;
  if (!frame?.members?.length) return [];

  return frame.members
    .filter((m) => m.joints && Object.keys(m.joints).length > 0)
    .map((m) => {
      const meta = memberColorMap[m.estimatedMemberId] || {};
      return {
        memberId: m.estimatedMemberId,
        joints: m.joints,
        color: meta.color || '#FF1F8E',
        name: meta.name || m.estimatedMemberId || 'AI',
        isEstimated: m.isEstimated,
      };
    });
}

/**
 * 선언형 Stage Skeleton Layer — GroupStageCanvas 래퍼.
 */
export default function SkeletonRenderer({
  frame = null,
  aiMembers = [],
  userJoints,
  userColor,
  userAnchor,
  ghostAnchor,
  formation = null,
  memberColorMap = {},
  className = '',
}: SkeletonRendererProps) {
  const renderInput = useMemo(() => ({
    aiMembers: buildAiMembersFromFrame(frame, memberColorMap, aiMembers),
    userJoints,
    userColor,
    userAnchor,
    ghostAnchor,
    formation,
  }), [frame, aiMembers, userJoints, userColor, userAnchor, ghostAnchor, formation, memberColorMap]);

  return (
    <GroupStageCanvas
      className={className}
      canvasClassName="group-dance-stage-2d-canvas group-studio-skeleton-layer"
      frame={frame}
      renderInput={renderInput}
    />
  );
}

export { buildStageRenderInput };
