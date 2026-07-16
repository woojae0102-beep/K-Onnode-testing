// @ts-nocheck
import React from 'react';
import { ContactShadows, Grid } from '@react-three/drei';

export type StagePresetId = 'stage-default' | 'stage-dark' | 'stage-concert' | 'stage-neon';

const STAGE_PRESETS: Record<StagePresetId, {
  background: string;
  fog: string;
  floor: string;
  accent: string;
  gridCell: string;
  gridSection: string;
}> = {
  'stage-default': {
    background: '#12101a',
    fog: '#12101a',
    floor: '#1a1528',
    accent: '#FF1F8E',
    gridCell: '#2a2438',
    gridSection: '#FF1F8E44',
  },
  'stage-dark': {
    background: '#050508',
    fog: '#050508',
    floor: '#0a0a10',
    accent: '#888888',
    gridCell: '#1a1a22',
    gridSection: '#44444466',
  },
  'stage-concert': {
    background: '#0a0618',
    fog: '#1a0830',
    floor: '#150820',
    accent: '#FFD700',
    gridCell: '#2a1840',
    gridSection: '#FFD70055',
  },
  'stage-neon': {
    background: '#060612',
    fog: '#0a0820',
    floor: '#0d0d1a',
    accent: '#00FFFF',
    gridCell: '#1a2a3a',
    gridSection: '#00FFFF55',
  },
};

/**
 * Group Mode 전용 Stage — Teaching 배경과 분리, backgroundId preset.
 */
export function GroupPracticeEnvironment({
  showGrid = true,
  backgroundId = 'stage-default',
}: {
  showGrid?: boolean;
  backgroundId?: string;
}) {
  const preset = STAGE_PRESETS[backgroundId as StagePresetId] || STAGE_PRESETS['stage-default'];

  return (
    <>
      <color attach="background" args={[preset.background]} />
      <fog attach="fog" args={[preset.fog, 10, 22]} />
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[4, 8, 5]} intensity={1} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 3, 2]} intensity={0.4} color={preset.accent} />
      <pointLight position={[3, 2, -3]} intensity={0.3} color="#6C5CE7" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color={preset.floor} roughness={0.85} metalness={0.1} />
      </mesh>
      {showGrid ? (
        <Grid
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.35}
          sectionSize={2}
          sectionThickness={0.7}
          fadeDistance={14}
          fadeStrength={1}
          position={[0, -1.19, 0]}
          cellColor={preset.gridCell}
          sectionColor={preset.gridSection}
        />
      ) : null}
      <ContactShadows position={[0, -1.18, 0]} opacity={0.5} scale={10} blur={2.5} far={4.5} />
    </>
  );
}

export default GroupPracticeEnvironment;
