// @ts-nocheck
/**
 * Group Mode 2D stage — formation markers only (skeleton draw 없음).
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { FormationHole } from '../../../types/danceDatabase';

export type GroupFormationStage2DHandle = {
  clear: () => void;
};

export const GroupFormationStage2D = forwardRef<
  GroupFormationStage2DHandle,
  {
    formationHole?: FormationHole | null;
    visibleMemberCount?: number;
    className?: string;
  }
>(function GroupFormationStage2D({ formationHole, visibleMemberCount = 0, className = '' }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    if (formationHole) {
      const x = (formationHole.anchor?.x ?? 0.5) * width;
      const y = (formationHole.anchor?.y ?? 0.5) * height;
      ctx.strokeStyle = formationHole.color || '#FF1F8E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px monospace';
      ctx.fillText(`USER · ${formationHole.label || formationHole.memberId}`, x - 40, y - 36);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px monospace';
    ctx.fillText(`Motion Asset Mode · AI ${visibleMemberCount}`, 12, height - 12);
  }, [formationHole, visibleMemberCount]);

  useEffect(() => {
    draw();
  }, [draw]);

  useImperativeHandle(ref, () => ({
    clear: draw,
  }), [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={640}
      height={360}
      style={{ width: '100%', height: '100%', display: 'block', background: '#0a0a14' }}
    />
  );
});

export default GroupFormationStage2D;
