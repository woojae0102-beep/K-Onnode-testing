// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import type { Agency, TrainingMode } from '../../types/tv';
import { useAgencyPersona } from '../../hooks/useAgencyPersona';
import PlaybackSpeedControl from '../teaching/PlaybackSpeedControl';

export function AICoachPanel({
  agency,
  mode,
  agencyColor,
  playbackSpeed: controlledSpeed,
  onSpeedChange,
}: {
  agency: Agency;
  mode: TrainingMode;
  agencyColor: string;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}) {
  const [internalSpeed, setInternalSpeed] = useState(1);
  const speed = controlledSpeed ?? internalSpeed;
  const setSpeed = onSpeedChange ?? setInternalSpeed;
  const [isPlaying, setIsPlaying] = useState(true);
  const canvasRef = useRef(null);
  const animRef = useRef(0);
  const persona = useAgencyPersona(agency);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = Math.min(canvas.width, canvas.height) * 0.35;
      const t = (frame * speed * 0.05) % (Math.PI * 2);

      const joints = {
        head: [cx, cy - scale * 0.9],
        shoulderL: [cx - scale * 0.4, cy - scale * 0.5],
        shoulderR: [cx + scale * 0.4, cy - scale * 0.5],
        elbowL: [cx - scale * 0.6, cy - scale * 0.1 + Math.sin(t) * 20],
        elbowR: [cx + scale * 0.6, cy - scale * 0.1 - Math.sin(t) * 20],
        wristL: [cx - scale * 0.5, cy + scale * 0.2 + Math.sin(t) * 30],
        wristR: [cx + scale * 0.5, cy + scale * 0.2 - Math.sin(t) * 30],
        hipL: [cx - scale * 0.25, cy + scale * 0.3],
        hipR: [cx + scale * 0.25, cy + scale * 0.3],
        kneeL: [cx - scale * 0.3, cy + scale * 0.7],
        kneeR: [cx + scale * 0.3, cy + scale * 0.7],
        ankleL: [cx - scale * 0.3, cy + scale],
        ankleR: [cx + scale * 0.3, cy + scale],
      };

      const lines = [
        ['head', 'shoulderL'],
        ['head', 'shoulderR'],
        ['shoulderL', 'shoulderR'],
        ['shoulderL', 'elbowL'],
        ['elbowL', 'wristL'],
        ['shoulderR', 'elbowR'],
        ['elbowR', 'wristR'],
        ['shoulderL', 'hipL'],
        ['shoulderR', 'hipR'],
        ['hipL', 'hipR'],
        ['hipL', 'kneeL'],
        ['kneeL', 'ankleL'],
        ['hipR', 'kneeR'],
        ['kneeR', 'ankleR'],
      ];

      ctx.strokeStyle = agencyColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = agencyColor;
      ctx.shadowBlur = 10;

      lines.forEach(([a, b]) => {
        const p1 = joints[a];
        const p2 = joints[b];
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      });

      Object.values(joints).forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = agencyColor;
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        mode === 'dance' ? 'AI 시범 동작' : 'AI 보컬 가이드',
        cx,
        canvas.height - 12,
      );

      if (isPlaying) frame += 1;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [agencyColor, speed, isPlaying, mode]);

  return (
    <div
      className="tv-panel"
      style={{
        background: '#0a0a14',
        border: `1px solid ${agencyColor}33`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${agencyColor}, transparent)`,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00FF88',
              boxShadow: '0 0 8px #00FF88',
              animation: 'tv-pulse 2s infinite',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
            }}
          >
            AI 코치
          </span>
        </div>
        <div style={{ fontSize: 11, color: agencyColor, fontWeight: 500 }}>
          {agency.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          position: 'relative',
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `${agencyColor}18`,
            border: `2px solid ${agencyColor}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            boxShadow: `0 0 40px ${agencyColor}30`,
            marginBottom: 12,
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {persona.coachAvatar}
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: `1px solid ${agencyColor}33`,
              borderTopColor: agencyColor,
              animation: 'tv-spin 4s linear infinite',
            }}
          />
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
          {persona.coachName}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
          {persona.coachTagline}
        </div>

        <div
          style={{
            width: '100%',
            flex: 1,
            minHeight: 100,
            background: '#111120',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          {isPlaying && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#FF1F8E',
                  animation: 'tv-pulse 1s infinite',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: '#FF1F8E',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                LIVE
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <PlaybackSpeedControl
          value={speed}
          onChange={setSpeed}
          variant="dark"
          compact={false}
          label="재생 속도"
        />
      </div>
    </div>
  );
}

export default AICoachPanel;
