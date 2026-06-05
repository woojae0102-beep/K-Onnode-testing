// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import type { PoseData } from '../../types/tv';
import { getOptimizedCanvasContext, syncCanvasToDisplayRect } from '../../utils/cameraFrameLoop';

const CONNECTIONS = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

export function SkeletonMirror({
  poseData,
  agencyColor = '#FF1F8E',
  mirror = true,
}: {
  poseData: PoseData | null;
  agencyColor?: string;
  mirror?: boolean;
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !poseData) return;

    const ctx = getOptimizedCanvasContext(canvas);
    if (!ctx) return;

    syncCanvasToDisplayRect(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { joints, jointAccuracies } = poseData;

    CONNECTIONS.forEach(([start, end]) => {
      const s = joints[start];
      const e = joints[end];
      if (!s || !e) return;

      const accuracy = ((jointAccuracies[start] || 0) + (jointAccuracies[end] || 0)) / 2;
      const color = accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444';

      ctx.beginPath();
      ctx.moveTo(s.x * canvas.width, s.y * canvas.height);
      ctx.lineTo(e.x * canvas.width, e.y * canvas.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    Object.entries(joints).forEach(([name, joint]) => {
      const accuracy = jointAccuracies[name] || 0;
      const color = accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444';
      ctx.beginPath();
      ctx.arc(joint.x * canvas.width, joint.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }, [poseData, agencyColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        transform: mirror ? 'scaleX(-1)' : 'none',
      }}
    />
  );
}

export default SkeletonMirror;
