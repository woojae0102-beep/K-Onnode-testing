// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { renderStageFrame } from '../../utils/groupSkeletonDraw';
import { computeAspectFitSize } from '../../utils/canvasSkeletonUtils';

export default function GroupTVStageCanvas({ groupStage, poseSnapshot, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const rect = parent.getBoundingClientRect();
      const parentW = rect.width > 0 ? rect.width : parent.clientWidth || 640;
      const parentH = rect.height > 0 ? rect.height : parent.clientHeight || 360;
      const { width: renderW, height: renderH } = computeAspectFitSize(16, 9, parentW, parentH);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(renderW * dpr);
      canvas.height = Math.round(renderH * dpr);
      canvas.style.width = `${renderW}px`;
      canvas.style.height = `${renderH}px`;
      canvas._logicalWidth = renderW;
      canvas._logicalHeight = renderH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const members = groupStage?.members || [];
      const myMember = members.find((m) => m.isUser);
      const myMemberId = groupStage?.myMemberId;
      const formationHole = groupStage?.formationHole;

      const anchorX = formationHole?.anchor?.x ?? myMember?.defaultX ?? 0.5;
      const anchorY = formationHole?.anchor?.y ?? myMember?.defaultY ?? 0.5;

      const aiMembers = [];
      const frame = groupStage?.currentFrame;
      frame?.members?.forEach((memberData) => {
        if (memberData.estimatedMemberId === myMemberId) return;
        const member = members.find((m) => m.id === memberData.estimatedMemberId);
        if (!member || !memberData.joints) return;
        aiMembers.push({
          joints: memberData.joints,
          color: member.color || groupStage?.myMemberColor,
          name: member.nameKr,
        });
      });

      renderStageFrame(ctx, canvas, {
        aiMembers,
        userJoints: poseSnapshot?.joints || null,
        userColor: myMember?.color || groupStage?.myMemberColor || '#FF1F8E',
        userAnchor: { x: anchorX, y: anchorY },
        ghostAnchor: {
          x: anchorX,
          y: anchorY,
          color: formationHole?.color || myMember?.color || '#FF1F8E',
          label: formationHole?.label || 'YOU',
        },
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [groupStage, poseSnapshot]);

  return (
    <canvas
      ref={canvasRef}
      className={`group-studio-stage-canvas ${className}`.trim()}
      style={{ display: 'block', margin: '0 auto' }}
    />
  );
}
