// @ts-nocheck
import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import type { GroupDanceRenderSnapshot } from '../../../types/groupChoreography';
import type { FormationHole } from '../../../types/danceDatabase';
import { SkeletonAvatar3D } from './SkeletonAvatar3D';
import { AvatarCharacterWithFallback } from './AvatarCharacterWithFallback';
import { normalizedToStage } from '../../../services/group/FormationPositioning';

const STAGE = { width: 4, height: 3, depth: 2 };

function FormationHoleMarker({ hole }: { hole: FormationHole | null }) {
  if (!hole) return null;
  const pos = normalizedToStage(hole.anchor, STAGE.width, STAGE.height, STAGE.depth);
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
        <ringGeometry args={[0.35, 0.42, 32]} />
        <meshBasicMaterial color={hole.color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.5]} />
        <meshBasicMaterial color={hole.color} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

/**
 * Three.js 그룹 스테이지
 * - Motion Extraction Layer: SkeletonAvatar3D (fallback/debug)
 * - Render Layer: AvatarCharacter3D (RPM GLB + retarget)
 */
export function GroupDanceStage3D({
  snapshot,
  className = '',
  showGrid = true,
  avatarAssets = {},
  formationHole = null,
  useCharacterAvatars = true,
}: {
  snapshot: GroupDanceRenderSnapshot | null;
  className?: string;
  showGrid?: boolean;
  avatarAssets?: Record<string, { glbUrl?: string }>;
  formationHole?: FormationHole | null;
  useCharacterAvatars?: boolean;
}) {
  const aiList = snapshot?.aiAvatars || [];

  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: 320, background: '#0a0a14' }}>
      <Canvas gl={{ antialias: true, alpha: false }} shadows>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 1.4, 5.8]} fov={46} />
          <color attach="background" args={['#0a0a14']} />
          <fog attach="fog" args={['#0a0a14', 8, 18]} />
          <ambientLight intensity={0.45} />
          <directionalLight castShadow position={[3, 7, 4]} intensity={0.9} shadow-mapSize={[1024, 1024]} />
          <pointLight position={[-2, 2.5, 2]} intensity={0.35} color="#FF1F8E" />
          <pointLight position={[2, 1, -2]} intensity={0.25} color="#6C5CE7" />

          {showGrid ? (
            <Grid
              args={[8, 8]}
              cellSize={0.5}
              cellThickness={0.4}
              sectionSize={2}
              sectionThickness={0.8}
              fadeDistance={12}
              fadeStrength={1}
              position={[0, -1.2, 0]}
              cellColor="#1a1a2e"
              sectionColor="#FF1F8E33"
            />
          ) : null}

          <ContactShadows position={[0, -1.19, 0]} opacity={0.45} scale={8} blur={2} far={4} />

          <FormationHoleMarker hole={formationHole} />

          {snapshot?.userJoints ? (
            useCharacterAvatars ? (
              <SkeletonAvatar3D
                joints={translateUserJointsToAnchor(snapshot.userJoints, snapshot.userAnchor)}
                persona={{ styleId: 'user', energy: 1, sharpness: 1, groove: 1, accentColor: '#FFFFFF', lineScale: 1.2 }}
                lineWidth={2.5}
              />
            ) : (
              <SkeletonAvatar3D
                joints={translateUserJointsToAnchor(snapshot.userJoints, snapshot.userAnchor)}
                persona={{ styleId: 'user', energy: 1, sharpness: 1, groove: 1, accentColor: '#FFFFFF', lineScale: 1.2 }}
                lineWidth={3}
              />
            )
          ) : null}

          {aiList.map((avatar) => {
            const glbUrl = avatarAssets[avatar.memberId]?.glbUrl;
            if (useCharacterAvatars && glbUrl) {
              return (
                <AvatarCharacterWithFallback
                  key={avatar.memberId}
                  glbUrl={glbUrl}
                  joints={avatar.joints}
                  persona={avatar.persona}
                  label={avatar.displayName}
                />
              );
            }
            return (
              <SkeletonAvatar3D
                key={avatar.memberId}
                joints={avatar.joints}
                persona={avatar.persona}
                label={avatar.displayName}
              />
            );
          })}

          <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={3.5} maxDistance={11} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function translateUserJointsToAnchor(
  joints: GroupDanceRenderSnapshot['userJoints'],
  anchor: GroupDanceRenderSnapshot['userAnchor'],
) {
  if (!joints) return {};
  const nose = joints.nose;
  const refX = nose?.x ?? 0.5;
  const refY = nose?.y ?? 0.5;
  const offsetX = anchor.x - refX;
  const offsetY = anchor.y - refY;
  return Object.fromEntries(
    Object.entries(joints).map(([name, j]) => [
      name,
      { ...j, x: j.x + offsetX, y: j.y + offsetY, z: (j.z ?? 0) + (anchor.z ?? 0) },
    ]),
  );
}

export default GroupDanceStage3D;
