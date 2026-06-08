// @ts-nocheck
import React, { useEffect, useRef } from 'react';

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

export default function StudioSkeletonCanvas({ poseSnapshot, accent = '#FF1F8E', className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const joints = poseSnapshot?.joints;
    const accuracies = poseSnapshot?.jointAccuracies || {};
    if (!joints) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('스켈레톤 대기 중', rect.width / 2, rect.height / 2);
      return;
    }

    const w = rect.width;
    const h = rect.height;

    CONNECTIONS.forEach(([start, end]) => {
      const s = joints[start];
      const e = joints[end];
      if (!s || !e) return;
      const accuracy = ((accuracies[start] || 0) + (accuracies[end] || 0)) / 2;
      const color = accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444';
      ctx.beginPath();
      ctx.moveTo(s.x * w, s.y * h);
      ctx.lineTo(e.x * w, e.y * h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    Object.entries(joints).forEach(([name, joint]) => {
      const accuracy = accuracies[name] || 0;
      const color = accuracy > 80 ? '#00FF88' : accuracy > 60 ? '#FFD700' : '#FF4444';
      ctx.beginPath();
      ctx.arc(joint.x * w, joint.y * h, 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [poseSnapshot, accent]);

  return <canvas ref={canvasRef} className={`studio-skeleton-canvas ${className}`} />;
}
