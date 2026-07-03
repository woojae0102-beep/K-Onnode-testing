// @ts-nocheck
import React, { useEffect } from 'react';
import { Html } from '@react-three/drei';
import { normalizedToStage } from '../../../services/group/FormationPositioning';

const STAGE = { width: 4, height: 3, depth: 2 };

/** joints가 비어 있을 때 스켈레톤/GLB 대신 표시하는 디버그 마커 */
export function EmptyJointsMarker({
  memberId,
  label,
  worldOffset,
}: {
  memberId: string;
  label?: string;
  worldOffset?: { x: number; y: number; z: number };
}) {
  useEffect(() => {
    console.warn(`[Avatar] empty joints — ${memberId} (${label || 'no label'})`);
  }, [memberId, label]);

  const pos = normalizedToStage(
    { x: worldOffset?.x ?? 0.5, y: worldOffset?.y ?? 0.5, z: worldOffset?.z ?? 0 },
    STAGE.width,
    STAGE.height,
    STAGE.depth,
  );

  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={[0.18, 0.45, 0.18]} />
        <meshBasicMaterial color="#FF4444" wireframe />
      </mesh>
      <Html distanceFactor={8} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            background: 'rgba(255,68,68,0.15)',
            border: '1px solid rgba(255,68,68,0.45)',
            color: '#FF8A8A',
            fontSize: 10,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {label || memberId}: NO JOINTS
        </div>
      </Html>
    </group>
  );
}

export default EmptyJointsMarker;
