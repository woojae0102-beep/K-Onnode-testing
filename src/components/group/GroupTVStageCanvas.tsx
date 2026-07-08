// @ts-nocheck
import React, { useMemo } from 'react';
import GroupStageCanvas from './GroupStageCanvas';
import { buildStageRenderInput } from '../../utils/stageRenderInputBuilder';

export default function GroupTVStageCanvas({ groupStage, poseSnapshot, className = '' }) {
  const members = groupStage?.members || [];
  const myMember = members.find((m) => m.isUser);
  const myMemberId = groupStage?.myMemberId;
  const groupId = groupStage?.groupId;
  const formationHole = groupStage?.formationHole;
  const frame = groupStage?.currentFrame;
  const currentTime = groupStage?.currentTime ?? frame?.timestamp ?? 0;

  const renderInput = useMemo(() => buildStageRenderInput({
    frame,
    groupId,
    myMemberId,
    timeSec: currentTime,
    formationTimeline: groupStage?.formationTimeline ?? null,
    formationHole,
    userJoints: poseSnapshot?.joints || null,
    userColor: myMember?.color || groupStage?.myMemberColor || '#FF1F8E',
    userAnchor: {
      x: formationHole?.anchor?.x ?? myMember?.defaultX ?? 0.5,
      y: formationHole?.anchor?.y ?? myMember?.defaultY ?? 0.5,
    },
    showUserPose: Boolean(poseSnapshot?.joints),
    showGhost: true,
    ghostLabel: formationHole?.label || 'YOU',
  }), [
    frame,
    groupId,
    myMemberId,
    currentTime,
    groupStage?.formationTimeline,
    formationHole,
    poseSnapshot?.joints,
    myMember,
    groupStage?.myMemberColor,
  ]);

  return (
    <div
      className={`group-dance-stage-2d group-tv-stage-canvas ${className}`.trim()}
      style={{ width: '100%', height: '100%' }}
    >
      <GroupStageCanvas
        frame={frame}
        renderInput={renderInput}
        canvasClassName="group-dance-stage-2d-canvas group-studio-skeleton-layer"
      />
    </div>
  );
}
