// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import {
  drawStageBackground,
  drawMySpot,
  drawAIAvatar,
  drawUserSkeleton,
} from '../../utils/groupSkeletonDraw';

export default function GroupTVStageCanvas({ groupStage, poseSnapshot, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      drawStageBackground(ctx, canvas.width, canvas.height);

      const members = groupStage?.members || [];
      const myMember = members.find((m) => m.isUser);
      const myMemberId = groupStage?.myMemberId;

      if (myMember) {
        drawMySpot(
          ctx,
          { x: myMember.defaultX * canvas.width, y: myMember.defaultY * canvas.height },
          myMember.color || groupStage?.myMemberColor || '#FF1F8E',
        );
      }

      const frame = groupStage?.currentFrame;
      frame?.members?.forEach((memberData) => {
        if (memberData.estimatedMemberId === myMemberId) return;
        const member = members.find((m) => m.id === memberData.estimatedMemberId);
        if (!member) return;
        drawAIAvatar(ctx, memberData.joints, member.color, member.nameKr, canvas);
      });

      if (poseSnapshot?.joints && myMember) {
        drawUserSkeleton(
          ctx,
          poseSnapshot.joints,
          myMember.color || groupStage?.myMemberColor,
          canvas,
          myMember.defaultX ?? 0.5,
          myMember.defaultY ?? 0.5,
        );
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [groupStage, poseSnapshot]);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
