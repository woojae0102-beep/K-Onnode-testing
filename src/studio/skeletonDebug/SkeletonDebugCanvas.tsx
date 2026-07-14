// @ts-nocheck
import React, { useCallback, useEffect, useRef } from 'react';
import type { DetectionFrame } from '../../services/MultiPersonTracker';
import { SKELETON_CONNECTIONS } from '../../types/groupPractice';
import { drawAccurateSkeleton, buildRenderConfig } from '../../utils/canvasSkeletonUtils';
import type { SkeletonDebugOverlayOptions } from './types';
import type { TrackHistoryEntry } from './types';
import { getSkeletonDebugTrackColor, hexToRgba } from './skeletonDebugColors';
import { getTrackEventsAtFrame } from './trackHistoryBuilder';

interface SkeletonDebugCanvasProps {
  frame: DetectionFrame | null;
  prevFrame: DetectionFrame | null;
  videoWidth: number;
  videoHeight: number;
  overlay: SkeletonDebugOverlayOptions;
  trackHistory: TrackHistoryEntry[];
  frameIndex: number;
  className?: string;
}

function computeBBox(joints: Record<string, { x: number; y: number }>) {
  const pts = Object.values(joints).filter((j) => Number.isFinite(j.x) && Number.isFinite(j.y));
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 0.02;
  return {
    minX: Math.max(0, Math.min(...xs) - pad),
    minY: Math.max(0, Math.min(...ys) - pad),
    maxX: Math.min(1, Math.max(...xs) + pad),
    maxY: Math.min(1, Math.max(...ys) + pad),
  };
}

function computeCenter(joints: Record<string, { x: number; y: number }>) {
  const lh = joints.left_hip;
  const rh = joints.right_hip;
  if (lh && rh) return { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const ls = joints.left_shoulder;
  const rs = joints.right_shoulder;
  if (ls && rs) return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const nose = joints.nose;
  return nose ? { x: nose.x, y: nose.y } : null;
}

export function SkeletonDebugCanvas({
  frame,
  prevFrame,
  videoWidth,
  videoHeight,
  overlay,
  trackHistory,
  frameIndex,
  className,
}: SkeletonDebugCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!frame?.detectedPeople?.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillText('No skeleton data', 12, 24);
      return;
    }

    const config = buildRenderConfig(videoWidth || 1280, videoHeight || 720, rect.width, rect.height);
    const events = getTrackEventsAtFrame(trackHistory, frameIndex);
    const prevByTrack = new Map(
      (prevFrame?.detectedPeople || []).map((p) => [p.trackId, p]),
    );

    frame.detectedPeople.forEach((person) => {
      const trackId = person.trackId;
      const color = overlay.trackColor ? getSkeletonDebugTrackColor(trackId) : '#FF1F8E';
      const isEstimated = Boolean(person.isEstimated);
      const isLost = events.lost.includes(trackId);
      const isRecovered = events.recovered.includes(trackId);
      const isCreated = events.created.includes(trackId);

      let strokeColor = color;
      if (overlay.lostTrack && isLost) strokeColor = '#FF4444';
      if (overlay.recoveredTrack && isRecovered) strokeColor = '#44FF88';
      if (overlay.recoveredTrack && isCreated) strokeColor = '#44AAFF';

      if (overlay.boundingBox) {
        const box = computeBBox(person.joints);
        if (box) {
          const tl = config.videoWidth ? normalizedToCanvasLocal(box.minX, box.minY, config) : { x: 0, y: 0 };
          const br = normalizedToCanvasLocal(box.maxX, box.maxY, config);
          ctx.strokeStyle = hexToRgba(strokeColor, 0.8);
          ctx.lineWidth = 2;
          ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        }
      }

      if (overlay.skeleton || overlay.bone) {
        drawAccurateSkeleton(
          ctx,
          person.joints,
          strokeColor,
          overlay.trackId ? `T${trackId}` : '',
          config,
          isEstimated,
        );
      }

      if (overlay.prediction && isEstimated) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([6, 4]);
        drawAccurateSkeleton(ctx, person.joints, '#AAAAAA', '', config, true, { boneWidth: 2, jointRadius: 4 });
        ctx.restore();
      }

      if (overlay.kalmanPrediction && isEstimated) {
        const center = computeCenter(person.joints);
        if (center) {
          const px = normalizedToCanvasLocal(center.x, center.y, config);
          ctx.beginPath();
          ctx.arc(px.x, px.y, 10, 0, Math.PI * 2);
          ctx.strokeStyle = '#88CCFF';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#88CCFF';
          ctx.font = '9px monospace';
          ctx.fillText('K', px.x + 12, px.y + 4);
        }
      }

      if (overlay.centerPoint) {
        const center = computeCenter(person.joints);
        if (center) {
          const px = normalizedToCanvasLocal(center.x, center.y, config);
          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.arc(px.x, px.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (overlay.velocity && prevByTrack.has(trackId)) {
        const prev = prevByTrack.get(trackId);
        const prevCenter = computeCenter(prev.joints);
        const curCenter = computeCenter(person.joints);
        if (prevCenter && curCenter) {
          const p0 = normalizedToCanvasLocal(prevCenter.x, prevCenter.y, config);
          const p1 = normalizedToCanvasLocal(curCenter.x, curCenter.y, config);
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x - 8 * Math.cos(angle - 0.4), p1.y - 8 * Math.sin(angle - 0.4));
          ctx.lineTo(p1.x - 8 * Math.cos(angle + 0.4), p1.y - 8 * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fillStyle = '#FFD700';
          ctx.fill();
        }
      }

      if (overlay.trackId || overlay.confidence) {
        const nose = person.joints.nose;
        if (nose) {
          const px = normalizedToCanvasLocal(nose.x, nose.y - 0.04, config);
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.fillStyle = strokeColor;
          const label = [
            overlay.trackId ? `#${trackId}` : '',
            overlay.confidence ? `${(person.confidence * 100).toFixed(0)}%` : '',
            isEstimated ? '(est)' : '',
          ].filter(Boolean).join(' ');
          ctx.fillText(label, px.x, px.y);
        }
      }

      if (overlay.jointName) {
        ctx.font = '9px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        Object.entries(person.joints).forEach(([name, joint]) => {
          const px = normalizedToCanvasLocal(joint.x, joint.y, config);
          ctx.fillText(name, px.x + 4, px.y - 4);
        });
      }

      if (overlay.confidence && !overlay.trackId) {
        Object.entries(person.joints).forEach(([name, joint]) => {
          const conf = joint.confidence ?? joint.visibility ?? 0;
          if (conf < 0.3) return;
          const px = normalizedToCanvasLocal(joint.x, joint.y, config);
          ctx.font = '8px monospace';
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, conf)})`;
          ctx.fillText(conf.toFixed(2), px.x, px.y + 10);
        });
      }
    });
  }, [frame, prevFrame, videoWidth, videoHeight, overlay, trackHistory, frameIndex]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#0a0a12',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}

function normalizedToCanvasLocal(nx: number, ny: number, config: ReturnType<typeof buildRenderConfig>) {
  const videoAspect = config.videoWidth / config.videoHeight;
  const canvasAspect = config.canvasWidth / config.canvasHeight;
  let scaleX: number;
  let scaleY: number;
  let offsetX = 0;
  let offsetY = 0;
  if (videoAspect > canvasAspect) {
    scaleX = config.canvasWidth;
    scaleY = config.canvasWidth / videoAspect;
    offsetY = (config.canvasHeight - scaleY) / 2;
  } else {
    scaleY = config.canvasHeight;
    scaleX = config.canvasHeight * videoAspect;
    offsetX = (config.canvasWidth - scaleX) / 2;
  }
  return { x: nx * scaleX + offsetX, y: ny * scaleY + offsetY };
}

export default SkeletonDebugCanvas;
