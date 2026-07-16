// @ts-nocheck
import React from 'react';
import { Text } from '@react-three/drei';

/** Production Mode — avatar asset 없을 때 명확한 에러 표시 (fake GLB 금지) */
export function AvatarAssetMissingMarker({
  memberId,
  label,
  worldOffset = { x: 0, y: 0, z: 0 },
}: {
  memberId: string;
  label?: string;
  worldOffset?: { x: number; y: number; z: number };
}) {
  return (
    <group position={[worldOffset.x * 4 - 2, worldOffset.y * 2, worldOffset.z ?? 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.35, 0.7, 0.2]} />
        <meshStandardMaterial color="#331111" emissive="#FF4444" emissiveIntensity={0.35} />
      </mesh>
      <Text position={[0, 1.2, 0]} fontSize={0.12} color="#FF6B6B" anchorX="center" anchorY="middle">
        {label || memberId}
      </Text>
      <Text position={[0, 1.0, 0]} fontSize={0.08} color="#FF9999" anchorX="center" anchorY="middle">
        AVATAR_ASSET_MISSING
      </Text>
    </group>
  );
}

export default AvatarAssetMissingMarker;
