// @ts-nocheck
import React from 'react';
import GroupStageCanvas from './GroupStageCanvas';

export default function GroupTVStageCanvas({ groupStage, className = '' }) {
  const myMemberId = groupStage?.myMemberId;
  const groupId = groupStage?.groupId;
  const referenceFrame = groupStage?.currentFrame ?? null;

  return (
    <div
      className={`group-dance-stage-2d group-tv-stage-canvas ${className}`.trim()}
      style={{ width: '100%', height: '100%' }}
    >
      <GroupStageCanvas
        referenceFrame={referenceFrame}
        groupId={groupId}
        focusMemberId={myMemberId}
        canvasClassName="group-dance-stage-2d-canvas group-studio-skeleton-layer"
      />
    </div>
  );
}
