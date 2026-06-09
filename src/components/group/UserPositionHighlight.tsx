// @ts-nocheck
import React from 'react';
import { drawMySpot } from '../../utils/groupSkeletonDraw';

export function UserPositionHighlight({ ctx, pos, color }) {
  if (!ctx || !pos) return null;
  drawMySpot(ctx, pos, color);
  return null;
}

export default UserPositionHighlight;
