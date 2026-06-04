// @ts-nocheck
import React from 'react';

const JOINT_POSITIONS = {
  nose: { x: 50, y: 8 },
  left_shoulder: { x: 35, y: 22 },
  right_shoulder: { x: 65, y: 22 },
  left_elbow: { x: 28, y: 38 },
  right_elbow: { x: 72, y: 38 },
  left_wrist: { x: 22, y: 52 },
  right_wrist: { x: 78, y: 52 },
  left_hip: { x: 40, y: 48 },
  right_hip: { x: 60, y: 48 },
  left_knee: { x: 38, y: 68 },
  right_knee: { x: 62, y: 68 },
  left_ankle: { x: 36, y: 88 },
  right_ankle: { x: 64, y: 88 },
};

function scoreColor(score) {
  if (score >= 85) return '#1DB971';
  if (score >= 65) return '#FFD700';
  return '#FF1F8E';
}

export function JointHeatmap({ jointScores = {}, title = '관절별 정확도' }) {
  const entries = Object.entries(JOINT_POSITIONS);
  const aggregated = { ...jointScores };

  if (Object.keys(aggregated).length === 0 && jointScores.topProblems) {
    (jointScores.topProblems || []).forEach((j) => {
      aggregated[j] = 45;
    });
  }

  return (
    <div className="w-full max-w-xs mx-auto">
      <p className="text-sm text-white/60 text-center mb-3">{title}</p>
      <svg viewBox="0 0 100 100" className="w-full h-64">
        <ellipse cx="50" cy="50" rx="28" ry="42" fill="none" stroke="#333" strokeWidth="1" />
        {entries.map(([joint, pos]) => {
          const score = aggregated[joint] ?? 75;
          const r = 4 + (100 - score) / 25;
          return (
            <circle
              key={joint}
              cx={pos.x}
              cy={pos.y}
              r={r}
              fill={scoreColor(score)}
              opacity={0.85}
            />
          );
        })}
      </svg>
      <div className="flex justify-center gap-4 text-xs text-white/50 mt-2">
        <span><span className="text-[#1DB971]">●</span> 85%+</span>
        <span><span className="text-[#FFD700]">●</span> 65%+</span>
        <span><span className="text-[#FF1F8E]">●</span> 개선</span>
      </div>
    </div>
  );
}

export default JointHeatmap;
