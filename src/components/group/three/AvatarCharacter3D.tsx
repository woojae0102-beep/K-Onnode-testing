// @ts-nocheck
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text } from '@react-three/drei';
import type { PersonaStyle, ChoreographyJoint } from '../../../types/groupChoreography';
import { applyAvatarRetarget } from '../../../services/motion/AvatarRetargetEngine';
import type { BoneQuaternion } from '../../../utils/quaternionInterpolation';

export function AvatarCharacter3D({
  glbUrl,
  joints,
  boneRotations,
  persona,
  label,
  position = [0, 0, 0] as [number, number, number],
}: {
  glbUrl: string;
  joints: Record<string, ChoreographyJoint>;
  boneRotations?: Record<string, BoneQuaternion>;
  persona?: PersonaStyle;
  label?: string;
  position?: [number, number, number];
}) {
  const groupRef = useRef(null);
  const { scene } = useGLTF(glbUrl);

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as any).isMesh) {
        (child as any).castShadow = true;
        (child as any).receiveShadow = true;
      }
    });
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current || !joints || !Object.keys(joints).length) return;
    applyAvatarRetarget(groupRef.current, joints, boneRotations);
  });

  const cloned = useMemo(() => scene.clone(true), [scene]);

  return (
    <group ref={groupRef} position={position}>
      <primitive object={cloned} scale={1.1} />
      {label ? (
        <Text
          position={[0, 1.8, 0]}
          fontSize={0.12}
          color={persona?.accentColor || '#fff'}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      ) : null}
    </group>
  );
}

export default AvatarCharacter3D;
