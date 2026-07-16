/**
 * STUDIO_SONGS 기준 choreography stub JSON 생성.
 * 실행: npx tsx scripts/generate-choreography-stubs.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO_SONGS } from '../src/data/groupStudioSongs.ts';
import { GROUP_DATA } from '../src/data/groupPracticeData.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/data/choreography');

const JOINT_NAMES = ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'];

function buildJoints(anchor: { x: number; y: number; z?: number }, phase: number) {
  const wobble = Math.sin(phase) * 0.02;
  const x = anchor.x;
  const y = anchor.y;
  const z = anchor.z ?? 0;
  return {
    nose: { x, y: y - 0.08 + wobble, z, visibility: 1 },
    left_shoulder: { x: x - 0.04, y: y - 0.02 + wobble, z, visibility: 1 },
    right_shoulder: { x: x + 0.04, y: y - 0.02 - wobble, z, visibility: 1 },
    left_hip: { x: x - 0.03, y: y + 0.08, z, visibility: 1 },
    right_hip: { x: x + 0.03, y: y + 0.08, z, visibility: 1 },
  };
}

function generateDataset(song: typeof STUDIO_SONGS[number]) {
  const group = GROUP_DATA[song.groupId];
  if (!group) return null;

  const durationSec = Math.min(Math.max(song.duration, 8), 30);
  const fps = 10;
  const frameCount = Math.max(3, Math.round(durationSec * fps / 10));
  const members = group.members.map((m) => ({
    memberId: m.id,
    displayName: m.name,
    displayNameKr: m.nameKr,
    persona: {
      styleId: m.id,
      energy: 0.85,
      sharpness: 0.85,
      groove: 0.8,
      accentColor: m.color || '#FF1F8E',
      lineScale: 1,
    },
    formationAnchor: {
      x: m.defaultX ?? 0.5,
      y: m.defaultY ?? 0.5,
      z: 0,
    },
  }));

  const frames = Array.from({ length: frameCount }, (_, i) => {
    const timestamp = (i / (frameCount - 1 || 1)) * durationSec;
    const phase = (i / frameCount) * Math.PI * 2;
    return {
      timestamp,
      members: members.map((meta) => ({
        memberId: meta.memberId,
        joints: buildJoints(meta.formationAnchor, phase + meta.formationAnchor.x),
      })),
    };
  });

  return {
    meta: {
      groupId: song.groupId,
      songId: song.id,
      title: song.title,
      bpm: song.bpm,
      durationSec,
      formation: group.defaultFormation || 'diamond',
      fps,
      version: '2',
      preserveVideoFormation: true,
      stub: true,
    },
    members,
    frames,
  };
}

mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const song of STUDIO_SONGS) {
  const dataset = generateDataset(song);
  if (!dataset) continue;
  const filename = `${song.groupId}-${song.id}.json`;
  writeFileSync(join(OUT_DIR, filename), `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  written += 1;
  console.log(`[choreography-stub] ${filename}`);
}

console.log(`[choreography-stub] Done — ${written} files in ${OUT_DIR}`);
