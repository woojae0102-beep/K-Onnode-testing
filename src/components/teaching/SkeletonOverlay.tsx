// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import type { FrameData } from '../../types/teaching';

export const SKELETON_CONNECTIONS = [
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

export function calculateJointAccuracy(myJoint, refJoint) {
  if (!myJoint || !refJoint) return 'wrong';
  const distance = Math.sqrt((myJoint.x - refJoint.x) ** 2 + (myJoint.y - refJoint.y) ** 2);
  if (distance < 0.05) return 'correct';
  if (distance < 0.15) return 'close';
  return 'wrong';
}

export function drawSkeleton(ctx, frameData, width, height, mode = 'mine', comparisonData) {
  if (!frameData?.joints || !ctx) return;
  const scale = (j) => ({ x: j.x * width, y: j.y * height });

  SKELETON_CONNECTIONS.forEach(([start, end]) => {
    const startJoint = frameData.joints[start];
    const endJoint = frameData.joints[end];
    if (!startJoint || !endJoint) return;

    let color = '#FFFFFF';
    if (mode === 'mine' && comparisonData) {
      const accStart = calculateJointAccuracy(startJoint, comparisonData.joints[start]);
      const accEnd = calculateJointAccuracy(endJoint, comparisonData.joints[end]);
      const worst = accStart === 'wrong' || accEnd === 'wrong' ? 'wrong' : accStart === 'close' || accEnd === 'close' ? 'close' : 'correct';
      color = worst === 'correct' ? '#1DB971' : worst === 'close' ? '#FFD700' : '#FF1F8E';
    }

    const s = scale(startJoint);
    const e = scale(endJoint);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

export function SkeletonOverlay({ frame, comparisonFrame, mode = 'mine', className = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (frame) drawSkeleton(ctx, frame, rect.width, rect.height, mode, comparisonFrame);
  }, [frame, comparisonFrame, mode]);

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

export default SkeletonOverlay;
