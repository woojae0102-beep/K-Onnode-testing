// @ts-nocheck
import React from 'react';
import { drawAIAvatar } from '../../utils/groupSkeletonDraw';

export function AvatarRenderer({ ctx, joints, color, memberName, canvas }) {
  if (!ctx || !joints || !canvas) return null;
  drawAIAvatar(ctx, joints, color, memberName, canvas);
  return null;
}

export default AvatarRenderer;
