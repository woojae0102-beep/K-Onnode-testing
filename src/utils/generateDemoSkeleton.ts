// @ts-nocheck
import { GROUP_DATA } from '../data/groupPracticeData';

function makeJoints(cx, cy, phase, amp = 0.04) {
  const sway = Math.sin(phase) * amp;
  const bounce = Math.abs(Math.sin(phase * 2)) * amp * 0.5;
  const armSwing = Math.sin(phase * 1.5) * amp * 1.2;

  return {
    nose: { x: cx, y: cy - 0.12 + bounce, z: 0, visibility: 1 },
    left_shoulder: { x: cx - 0.06, y: cy - 0.04 + bounce, z: 0, visibility: 1 },
    right_shoulder: { x: cx + 0.06, y: cy - 0.04 + bounce, z: 0, visibility: 1 },
    left_elbow: { x: cx - 0.1 - armSwing, y: cy + 0.02, z: 0, visibility: 1 },
    right_elbow: { x: cx + 0.1 + armSwing, y: cy + 0.02, z: 0, visibility: 1 },
    left_wrist: { x: cx - 0.12 - armSwing * 1.2, y: cy + 0.08, z: 0, visibility: 1 },
    right_wrist: { x: cx + 0.12 + armSwing * 1.2, y: cy + 0.08, z: 0, visibility: 1 },
    left_hip: { x: cx - 0.04 + sway, y: cy + 0.1, z: 0, visibility: 1 },
    right_hip: { x: cx + 0.04 + sway, y: cy + 0.1, z: 0, visibility: 1 },
    left_knee: { x: cx - 0.04 + sway, y: cy + 0.2, z: 0, visibility: 1 },
    right_knee: { x: cx + 0.04 - sway, y: cy + 0.2, z: 0, visibility: 1 },
    left_ankle: { x: cx - 0.05 + sway, y: cy + 0.28, z: 0, visibility: 1 },
    right_ankle: { x: cx + 0.05 - sway, y: cy + 0.28, z: 0, visibility: 1 },
  };
}

export function generateDemoSkeleton(groupId, duration = 30, fps = 10, bpm = 120) {
  const group = GROUP_DATA[groupId];
  if (!group) return [];

  const interval = 1 / fps;
  const beatPhase = (2 * Math.PI * bpm) / 60;
  const frames = [];

  for (let t = 0; t < duration; t += interval) {
    const phase = t * beatPhase;
    const members = group.members.map((member) => ({
      personIndex: 0,
      estimatedMemberId: member.id,
      joints: makeJoints(member.defaultX, member.defaultY, phase + member.defaultX * Math.PI),
    }));

    frames.push({ timestamp: t, members });
  }

  return frames;
}
