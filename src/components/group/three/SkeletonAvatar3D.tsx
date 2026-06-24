// @ts-nocheck
import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { SKELETON_CONNECTIONS } from '../../../types/groupPractice';
import type { ChoreographyJoint, PersonaStyle } from '../../../types/groupChoreography';
import { normalizedToStage } from '../../../services/group/FormationPositioning';

const STAGE = { width: 4, height: 3, depth: 2 };

export function SkeletonAvatar3D({
  joints,
  persona,
  label,
  lineWidth = 2,
}: {
  joints: Record<string, ChoreographyJoint>;
  persona?: PersonaStyle;
  label?: string;
  lineWidth?: number;
}) {
  const color = persona?.accentColor || '#FF1F8E';
  const scale = persona?.lineScale ?? 1;

  const segments = useMemo(() => {
    if (!joints || !Object.keys(joints).length) return [];
    return SKELETON_CONNECTIONS.map(([a, b]) => {
      const start = joints[a];
      const end = joints[b];
      if (!start || !end) return null;
      return {
        key: `${a}-${b}`,
        points: [normalizedToStage(start, STAGE.width, STAGE.height, STAGE.depth), normalizedToStage(end, STAGE.width, STAGE.height, STAGE.depth)],
      };
    }).filter(Boolean);
  }, [joints]);

  const jointPoints = useMemo(() => {
    return Object.entries(joints || {}).map(([name, j]) => ({
      name,
      pos: normalizedToStage(j, STAGE.width, STAGE.height, STAGE.depth),
    }));
  }, [joints]);

  if (!segments.length) return null;

  return (
    <group>
      {segments.map((seg) => (
        <Line
          key={seg.key}
          points={seg.points}
          color={color}
          lineWidth={lineWidth * scale}
          transparent
          opacity={0.9}
        />
      ))}
      {jointPoints.map((j) => (
        <mesh key={j.name} position={j.pos}>
          <sphereGeometry args={[0.035 * scale, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      {label && joints.nose ? (
        <mesh position={normalizedToStage(joints.nose, STAGE.width, STAGE.height, STAGE.depth)}>
          {/* label anchor — 실제 텍스트는 Html로 확장 가능 */}
          <sphereGeometry args={[0.01, 4, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0} />
        </mesh>
      ) : null}
    </group>
  );
}

export default SkeletonAvatar3D;
