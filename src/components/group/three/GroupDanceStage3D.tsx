// @ts-nocheck
/**
 * Group Mode Production Stage — AI Avatar animation playback (Motion Asset).
 * SkeletonFrameData / joint retarget / MediaPipe 금지.
 */
import React, { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { GroupPracticeEnvironment } from './GroupPracticeEnvironment';
import type { PracticeMotionSnapshot } from '../../../types/motionSnapshot';
import {
  snapshotAiAvatars,
  snapshotCurrentTime,
} from '../../../utils/motionSnapshotUtils';
import type { FormationHole } from '../../../types/danceDatabase';
import { AvatarCharacterAnimated3D } from './AvatarCharacterAnimated3D';
import { AvatarAssetMissingMarker } from './AvatarAssetMissingMarker';
import { LoadingStage } from './LoadingStage';
import type { ProductionAvatarAssetEntry } from '../../../hooks/useProductionAvatarAssets';
import type { ProductionAuthorityVerificationFailure } from '../../../gx10/ingest/productionAuthorityVerificationResult';
import type { ProductionAuthorityVerificationResult } from '../../../gx10/ingest/productionAuthorityVerificationResult';
import type { AssetProvenance } from '../../../modes/group/types/AssetProvenance';
import SnapshotDebugOverlay from '../SnapshotDebugOverlay';
import { logSnapshotStatus } from '../../../utils/snapshotDebugLog';

export function GroupDanceStage3D({
  snapshot,
  className = '',
  showGrid = true,
  productionAvatarAssets = {},
  formationHole = null,
  snapshotLoading = false,
  currentTimeSec,
  isPlaying = false,
  stageBackgroundId = 'stage-default',
  motionAssetMissing = false,
  devMotionFixture = false,
  assetProvenance,
  authorityVerification,
  authorityBlocked = null,
}: {
  snapshot: PracticeMotionSnapshot | null;
  className?: string;
  showGrid?: boolean;
  productionAvatarAssets?: Record<string, ProductionAvatarAssetEntry>;
  formationHole?: FormationHole | null;
  snapshotLoading?: boolean;
  currentTimeSec?: number;
  isPlaying?: boolean;
  stageBackgroundId?: string;
  motionAssetMissing?: boolean;
  devMotionFixture?: boolean;
  assetProvenance?: AssetProvenance;
  authorityVerification?: ProductionAuthorityVerificationResult;
  authorityBlocked?: ProductionAuthorityVerificationFailure | null;
}) {
  const aiList = snapshotAiAvatars(snapshot);
  const playbackTime = currentTimeSec ?? snapshotCurrentTime(snapshot);

  useEffect(() => {
    logSnapshotStatus(snapshot, 'GroupDanceStage3D', { loading: snapshotLoading });
  }, [snapshot, snapshotLoading]);

  const productionAuthorityBlocked = Boolean(authorityBlocked);

  const missingBanner = motionAssetMissing ? (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,10,20,0.72)',
        color: '#ffb4b4',
        fontSize: 13,
        zIndex: 20,
        padding: 24,
        textAlign: 'center',
      }}
    >
      Production Motion Asset이 준비되지 않았습니다.
    </div>
  ) : productionAuthorityBlocked ? (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,10,20,0.82)',
        color: '#ffb4b4',
        fontSize: 13,
        zIndex: 20,
        padding: 24,
        textAlign: 'center',
      }}
    >
      Production Authority 검증 실패 — 재생이 차단되었습니다.
      <br />
      <span style={{ fontSize: 11, opacity: 0.85 }}>{authorityBlocked?.failureCode}</span>
    </div>
  ) : devMotionFixture ? (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 25,
        padding: '4px 8px',
        borderRadius: 6,
        background: 'rgba(255,215,0,0.2)',
        border: '1px solid rgba(255,215,0,0.5)',
        color: '#FFD700',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      DEV MOTION FIXTURE
    </div>
  ) : null;

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320, background: '#12101a' }}
    >
      {missingBanner}
      <SnapshotDebugOverlay snapshot={snapshot} loading={snapshotLoading} />
      <Canvas gl={{ antialias: true, alpha: false }} shadows>
        <Suspense fallback={<LoadingStage />}>
          <PerspectiveCamera makeDefault position={[0, 1.6, 6.2]} fov={44} />
          <GroupPracticeEnvironment showGrid={showGrid} backgroundId={stageBackgroundId} />

          {formationHole ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
              <ringGeometry args={[0.35, 0.42, 32]} />
              <meshBasicMaterial color={formationHole.color || '#FF1F8E'} transparent opacity={0.35} />
            </mesh>
          ) : null}

          {aiList.map((avatar) => {
            const asset = productionAvatarAssets[avatar.memberId];
            const hasMotion = Boolean(avatar.motionUrl);
            const glbUrl = asset?.avatarAssetUrl;

            if (productionAuthorityBlocked || asset?.missing || !glbUrl || !hasMotion) {
              return (
                <AvatarAssetMissingMarker
                  key={avatar.memberId}
                  memberId={avatar.memberId}
                  label={avatar.displayName}
                  worldOffset={avatar.worldOffset}
                />
              );
            }

            return (
              <AvatarCharacterAnimated3D
                key={avatar.memberId}
                memberId={avatar.memberId}
                glbUrl={glbUrl}
                motionUrl={avatar.motionUrl}
                motionAssetId={avatar.motionAssetId}
                animationClipName={avatar.animationClipName}
                sourceSkeletonProfile={avatar.sourceSkeletonProfile}
                avatarSkeletonProfile={avatar.avatarSkeletonProfile}
                currentTimeSec={playbackTime}
                isPlaying={isPlaying}
                persona={avatar.persona}
                label={avatar.displayName}
                worldOffset={avatar.worldOffset}
                assetProvenance={assetProvenance}
                authorityVerification={authorityVerification}
                authorityBlocked={authorityBlocked || undefined}
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
