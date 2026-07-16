// @ts-nocheck
/**
 * Group Mode Production Stage — AI Avatar only (selected member = User Slot marker).
 * MediaPipe / SkeletonAvatar / RPM demo GLB 사용 금지.
 */
import React, { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { GroupPracticeEnvironment } from './GroupPracticeEnvironment';
import type { PracticeMotionSnapshot } from '../../../types/motionSnapshot';
import {
  snapshotAiAvatars,
  snapshotCurrentTime,
  snapshotFrame,
} from '../../../utils/motionSnapshotUtils';
import type { FormationHole } from '../../../types/danceDatabase';
import type { SkeletonFrameData } from '../../../types/groupPractice';
import { AvatarCharacter3D } from './AvatarCharacter3D';
import { AvatarAssetMissingMarker } from './AvatarAssetMissingMarker';
import { EmptyJointsMarker } from './EmptyJointsMarker';
import { LoadingStage } from './LoadingStage';
import { normalizedToStage } from '../../../services/group/FormationPositioning';
import type { ProductionAvatarAssetEntry } from '../../../hooks/useProductionAvatarAssets';
import SnapshotDebugOverlay from '../SnapshotDebugOverlay';
import StageAiDebugOverlay from '../StageAiDebugOverlay';
import { logSnapshotStatus } from '../../../utils/snapshotDebugLog';
import { buildStageAiDebugInfo, logAiStageDebug } from '../../../utils/stageAiDebugUtils';

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
      <EmptyJointsMarker memberId={hole.memberId} label={`USER · ${hole.label || 'YOU'}`} worldOffset={{ x: 0, y: 0, z: 0 }} />
    </group>
  );
}

function countJoints(joints: Record<string, unknown> | null | undefined) {
  return Object.keys(joints || {}).length;
}

export function GroupDanceStage3D({
  snapshot,
  className = '',
  showGrid = true,
  productionAvatarAssets = {},
  formationHole = null,
  snapshotLoading = false,
  skeletonFrames = [],
  currentTimeSec,
  stageBackgroundId = 'stage-default',
}: {
  snapshot: PracticeMotionSnapshot | null;
  className?: string;
  showGrid?: boolean;
  productionAvatarAssets?: Record<string, ProductionAvatarAssetEntry>;
  formationHole?: FormationHole | null;
  snapshotLoading?: boolean;
  skeletonFrames?: SkeletonFrameData[];
  currentTimeSec?: number;
  stageBackgroundId?: string;
}) {
  const aiList = snapshotAiAvatars(snapshot);
  const aiDebugInfo = useMemo(
    () => buildStageAiDebugInfo(snapshot, snapshotFrame(snapshot) ? [snapshotFrame(snapshot)] : skeletonFrames, currentTimeSec ?? snapshotCurrentTime(snapshot)),
    [snapshot, skeletonFrames, currentTimeSec],
  );

  useEffect(() => {
    logSnapshotStatus(snapshot, 'GroupDanceStage3D', { loading: snapshotLoading });
  }, [snapshot, snapshotLoading]);

  useEffect(() => {
    logAiStageDebug(snapshot, skeletonFrames, 'GroupDanceStage3D', currentTimeSec ?? snapshotCurrentTime(snapshot));
  }, [snapshot, skeletonFrames, currentTimeSec]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background: '#12101a' }}
    >
      <SnapshotDebugOverlay snapshot={snapshot} loading={snapshotLoading} />
      <StageAiDebugOverlay info={aiDebugInfo} />
      <Canvas gl={{ antialias: true, alpha: false }} shadows>
        <Suspense fallback={<LoadingStage />}>
          <PerspectiveCamera makeDefault position={[0, 1.6, 6.2]} fov={44} />
          <GroupPracticeEnvironment showGrid={showGrid} backgroundId={stageBackgroundId} />

          <FormationHoleMarker hole={formationHole} />

          {aiList.map((avatar) => {
            const asset = productionAvatarAssets[avatar.memberId];
            const jointCount = countJoints(avatar.joints);

            if (asset?.missing || !asset?.avatarAssetUrl) {
              return (
                <AvatarAssetMissingMarker
                  key={avatar.memberId}
                  memberId={avatar.memberId}
                  label={avatar.displayName}
                  worldOffset={avatar.worldOffset}
                />
              );
            }

            if (jointCount === 0) {
              return (
                <EmptyJointsMarker
                  key={avatar.memberId}
                  memberId={avatar.memberId}
                  label={avatar.displayName}
                  worldOffset={avatar.worldOffset}
                />
              );
            }

            return (
              <AvatarCharacter3D
                key={avatar.memberId}
                glbUrl={asset.avatarAssetUrl}
                joints={avatar.joints}
                boneRotations={avatar.boneRotations}
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

export default GroupDanceStage3D;
