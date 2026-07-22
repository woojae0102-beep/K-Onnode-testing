// @ts-nocheck
/**
 * Group Mode — Avatar GLB 렌더 + Motion GLB AnimationClip (MODEL A).
 * Direct binding 또는 SkeletonUtils.retargetClip retargeting.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { PersonaStyle } from '../../../types/groupChoreography';
import { normalizedToStage } from '../../../services/group/FormationPositioning';
import { resolveMotionAnimationClip } from '../../../modes/group/runtime/resolveMotionAnimationClip';
import { extractTrackTargetNodeName, nodeExistsInHierarchy } from '../../../modes/group/runtime/analyzeMotionClipBinding';
import { cloneAvatarScene, auditAvatarSkeletonClone } from '../../../modes/group/runtime/auditAvatarSkeleton';
import { resolveAvatarMotionClip, runMotionPlaybackProof, finalizeAvatarMotionPlayback } from '../../../modes/group/runtime/resolveAvatarMotionClip';
import { resolveAvatarAnimationRoot } from '../../../modes/group/runtime/resolveAvatarAnimationRoot';
import type { SkeletonProfile } from '../../../modes/group/types/ProductionSkeletonContract';
import type { ProductionMotionFinalStatus } from '../../../modes/group/types/ProductionSkeletonContract';
import { ProductionMotionAssetError } from '../../../modes/group/types/ProductionMotionAssetV2';
import type { AssetProvenance } from '../../../modes/group/types/AssetProvenance';
import {
  shouldCreateProductionMotionMixer,
} from '../../../modes/group/runtime/productionMotionRuntimeAuthorityGate';
import { isVerifiedPlaybackStatus } from '../../../gx10/ingest/productionAuthorityVerificationResult';
import type { ProductionAuthorityVerificationFailure } from '../../../gx10/ingest/productionAuthorityVerificationResult';
import type { ProductionAuthorityVerificationResult } from '../../../gx10/ingest/productionAuthorityVerificationResult';
import {
  registerAvatarMixerDebugState,
  unregisterAvatarMixerDebugState,
  type AvatarMixerDebugState,
} from '../../../modes/group/runtime/groupMotionRuntimeDebug';
import {
  getOrCacheMotionClipResolve,
  motionClipCacheKey,
  recordAvatarMounted,
  recordAvatarUnmounted,
  recordFailedLoad,
  recordGltfUrlAccess,
  recordMixerCreated,
  recordMixerUpdateTimeMs,
  releaseGltfUrlAccess,
} from '../../../modes/group/runtime/productionMotionRuntimeCache';
import { disposeProductionMotionMixer } from '../../../modes/group/runtime/disposeProductionMotionMixer';

const STAGE = { width: 4, height: 3, depth: 2 };

function isPlaybackReady(finalStatus: ProductionMotionFinalStatus): boolean {
  return isVerifiedPlaybackStatus(finalStatus);
}

export function AvatarCharacterAnimated3D({
  memberId,
  glbUrl,
  motionUrl,
  motionAssetId,
  animationClipName,
  sourceSkeletonProfile,
  avatarSkeletonProfile,
  currentTimeSec = 0,
  isPlaying = false,
  persona,
  label,
  worldOffset = { x: 0.5, y: 0.5, z: 0 },
  assetProvenance,
  authorityVerification,
  authorityBlocked,
}: {
  memberId: string;
  glbUrl: string;
  motionUrl?: string;
  motionAssetId?: string;
  animationClipName?: string;
  sourceSkeletonProfile?: SkeletonProfile;
  avatarSkeletonProfile?: SkeletonProfile;
  currentTimeSec?: number;
  isPlaying?: boolean;
  persona?: PersonaStyle;
  label?: string;
  worldOffset?: { x: number; y: number; z: number };
  assetProvenance?: AssetProvenance;
  authorityVerification?: ProductionAuthorityVerificationResult;
  authorityBlocked?: ProductionAuthorityVerificationFailure;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const clipMetaRef = useRef<{ selectedClipName: string; clipDurationSec: number; clipCount: number; clipNames: string[] } | null>(null);
  const bindingRef = useRef(null);
  const transformProofRef = useRef(null);
  const skeletonAuditRef = useRef(null);
  const retargetResultRef = useRef(null);
  const playbackPathRef = useRef<'direct' | 'retargeted' | 'failed'>('failed');
  const finalStatusRef = useRef<ProductionMotionFinalStatus>('BLOCKED_MAPPING_FAILED');
  const skeletonValidationRef = useRef(null);
  const [clipError, setClipError] = useState<string | null>(null);

  const { scene: avatarScene } = useGLTF(glbUrl);
  const resolvedMotionUrl = motionUrl || '';
  const { scene: motionScene, animations: motionClips } = useGLTF(resolvedMotionUrl);

  useEffect(() => {
    if (glbUrl) recordGltfUrlAccess(glbUrl, true);
    if (resolvedMotionUrl) recordGltfUrlAccess(resolvedMotionUrl, true);
    recordAvatarMounted();
    return () => {
      if (glbUrl) releaseGltfUrlAccess(glbUrl);
      if (resolvedMotionUrl) releaseGltfUrlAccess(resolvedMotionUrl);
      recordAvatarUnmounted();
    };
  }, [glbUrl, resolvedMotionUrl]);

  const stagePos = useMemo(
    () => normalizedToStage(worldOffset, STAGE.width, STAGE.height, STAGE.depth),
    [worldOffset],
  );

  const avatarClone = useMemo(() => {
    const cloned = cloneAvatarScene(avatarScene);
    skeletonAuditRef.current = auditAvatarSkeletonClone({
      memberId,
      sourceScene: avatarScene,
      clonedScene: cloned,
    });
    return cloned;
  }, [avatarScene, memberId]);

  const publishDebug = (partial: Partial<AvatarMixerDebugState>) => {
    const action = actionRef.current;
    const clipMeta = clipMetaRef.current;
    registerAvatarMixerDebugState({
      memberId,
      avatarAssetId: glbUrl,
      motionAssetId: motionAssetId || resolvedMotionUrl,
      motionUrl: resolvedMotionUrl,
      avatarLoaded: Boolean(glbUrl),
      avatarMounted: true,
      motionLoaded: Boolean(resolvedMotionUrl),
      mixerCreated: Boolean(mixerRef.current),
      actionCreated: Boolean(actionRef.current),
      clipCount: clipMeta?.clipCount ?? motionClips.length,
      clipNames: clipMeta?.clipNames ?? motionClips.map((c) => c.name),
      selectedClipName: clipMeta?.selectedClipName,
      clipDurationSec: clipMeta?.clipDurationSec,
      currentTimeSec: action?.time ?? currentTimeSec,
      animationState: partial.animationState || 'loading',
      actionPaused: action ? action.paused : undefined,
      actionRunning: action ? action.isRunning() : undefined,
      formationPosition: worldOffset,
      clipError: clipError || undefined,
      motionBinding: bindingRef.current || undefined,
      transformProof: transformProofRef.current || undefined,
      skeletonAudit: skeletonAuditRef.current || undefined,
      retargetResult: retargetResultRef.current || undefined,
      playbackPath: playbackPathRef.current,
      skeletonValidation: skeletonValidationRef.current || undefined,
      avatarSkeletonProfile,
      motionSkeletonProfile: sourceSkeletonProfile,
      finalStatus: finalStatusRef.current,
      ...partial,
    });
  };

  useEffect(() => {
    publishDebug({ animationState: 'loading' });
    return () => unregisterAvatarMixerDebugState(memberId);
  }, [memberId]);

  useEffect(() => {
    avatarClone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    publishDebug({ avatarLoaded: true, avatarMounted: true, skeletonAudit: skeletonAuditRef.current });
  }, [avatarClone]);

  useEffect(() => {
    const mixerGate = shouldCreateProductionMotionMixer({
      assetProvenance,
      authorityVerification,
      authorityBlocked,
    });
    if (!mixerGate.allowed) {
      setClipError(mixerGate.message || mixerGate.blockedStatus || 'authority blocked');
      mixerRef.current = null;
      actionRef.current = null;
      playbackPathRef.current = 'failed';
      finalStatusRef.current = mixerGate.blockedStatus || 'BLOCKED_AUTHORITY_VERIFICATION_FAILED';
      publishDebug({
        animationState: 'error',
        mixerCreated: false,
        actionCreated: false,
        motionLoaded: false,
        playbackPath: 'failed',
        finalStatus: finalStatusRef.current,
        clipError: mixerGate.message || finalStatusRef.current,
      });
      return undefined;
    }

    if (!resolvedMotionUrl) {
      setClipError('motionUrl missing');
      mixerRef.current = null;
      actionRef.current = null;
      playbackPathRef.current = 'failed';
      publishDebug({ animationState: 'error', motionLoaded: false, playbackPath: 'failed' });
      return undefined;
    }

    try {
      const resolved = getOrCacheMotionClipResolve(
        motionClipCacheKey(resolvedMotionUrl, animationClipName, memberId),
        () => resolveMotionAnimationClip(motionClips, animationClipName, memberId),
      );
      clipMetaRef.current = resolved;

      const motionSceneClone = motionScene.clone(true);
      const motionResolved = resolveAvatarMotionClip({
        memberId,
        avatarRoot: avatarClone,
        motionScene: motionSceneClone,
        sourceClip: resolved.clip,
        skeletonAudit: skeletonAuditRef.current,
        declaredMotionProfile: sourceSkeletonProfile,
        declaredAvatarProfile: avatarSkeletonProfile,
        requireDeclaredProfiles: true,
      });

      bindingRef.current = motionResolved.binding;
      retargetResultRef.current = motionResolved.retargetResult || null;
      skeletonValidationRef.current = motionResolved.skeletonValidation || null;
      playbackPathRef.current = motionResolved.playbackPath;
      finalStatusRef.current = motionResolved.finalStatus;

      if (motionResolved.playbackPath === 'failed') {
        setClipError(motionResolved.error || motionResolved.finalStatus);
        mixerRef.current = null;
        actionRef.current = null;
        transformProofRef.current = null;
        publishDebug({
          animationState: 'error',
          mixerCreated: false,
          actionCreated: false,
          motionLoaded: true,
          motionBinding: motionResolved.binding,
          retargetResult: motionResolved.retargetResult,
          skeletonValidation: motionResolved.skeletonValidation,
          avatarSkeletonProfile: motionResolved.avatarSkeletonProfile,
          motionSkeletonProfile: motionResolved.motionSkeletonProfile,
          mappedSemanticBones: motionResolved.mappedSemanticBones,
          playbackPath: 'failed',
          finalStatus: motionResolved.finalStatus,
          clipError: motionResolved.error || motionResolved.finalStatus,
        });
        return undefined;
      }

      const playbackClip = motionResolved.clip;
      const mixerRoot = resolveAvatarAnimationRoot(avatarClone, playbackClip);
      const mixer = new THREE.AnimationMixer(mixerRoot);
      const action = mixer.clipAction(playbackClip, mixerRoot);
      action.play();
      action.paused = true;
      mixerRef.current = mixer;
      actionRef.current = action;
      recordMixerCreated(1);

      const sampleBoneNames = motionResolved.playbackPath === 'retargeted'
        ? (motionResolved.retargetResult?.mapping.map((m) => m.targetBoneName) || [])
        : [...new Set(
          resolved.clip.tracks
            .map((t) => extractTrackTargetNodeName(t.name))
            .filter((n) => n && nodeExistsInHierarchy(avatarClone, n)),
        )];

      transformProofRef.current = runMotionPlaybackProof({
        avatarRoot: avatarClone,
        clip: playbackClip,
        sampleBoneNames,
        isRetargeted: motionResolved.playbackPath === 'retargeted',
      });

      finalStatusRef.current = finalizeAvatarMotionPlayback({
        gateResult: motionResolved,
        transformProof: transformProofRef.current,
      });

      const ready = isPlaybackReady(finalStatusRef.current);

      setClipError(ready ? null : finalStatusRef.current);
      publishDebug({
        animationState: ready ? 'ready' : 'error',
        mixerCreated: true,
        actionCreated: true,
        motionLoaded: true,
        selectedClipName: resolved.selectedClipName,
        clipDurationSec: playbackClip.duration || resolved.clipDurationSec,
        clipCount: resolved.clipCount,
        clipNames: resolved.clipNames,
        motionBinding: motionResolved.binding,
        retargetResult: motionResolved.retargetResult,
        skeletonValidation: motionResolved.skeletonValidation,
        avatarSkeletonProfile: motionResolved.avatarSkeletonProfile,
        motionSkeletonProfile: motionResolved.motionSkeletonProfile,
        mappedSemanticBones: motionResolved.mappedSemanticBones,
        retargetedTrackCount: motionResolved.retargetResult?.retargetedClip?.tracks.length,
        transformProof: transformProofRef.current,
        playbackPath: motionResolved.playbackPath,
        finalStatus: finalStatusRef.current,
        clipError: ready ? undefined : finalStatusRef.current,
      });

      return () => {
        disposeProductionMotionMixer({
          mixer,
          root: mixerRoot,
          clip: playbackClip,
          actionCount: 1,
        });
        mixerRef.current = null;
        actionRef.current = null;
      };
    } catch (err) {
      recordFailedLoad();
      const message = err instanceof ProductionMotionAssetError
        ? `${err.code}: ${err.message}`
        : ((err as Error)?.message || 'clip resolve failed');
      setClipError(message);
      mixerRef.current = null;
      actionRef.current = null;
      playbackPathRef.current = 'failed';
      publishDebug({ animationState: 'error', mixerCreated: false, actionCreated: false, clipError: message, playbackPath: 'failed' });
      return undefined;
    }
  }, [avatarClone, motionScene, motionClips, animationClipName, resolvedMotionUrl, memberId, sourceSkeletonProfile, avatarSkeletonProfile, assetProvenance, authorityVerification, authorityBlocked]);

  useEffect(() => {
    const action = actionRef.current;
    if (!action) return;
    const clipDuration = action.getClip().duration || 1;
    const t = clipDuration > 0 ? currentTimeSec % clipDuration : currentTimeSec;
    action.time = t;
    mixerRef.current?.update(0);
    publishDebug({
      animationState: isPlaying ? 'playing' : 'paused',
      currentTimeSec: t,
      actionPaused: action.paused,
      actionRunning: action.isRunning(),
    });
  }, [currentTimeSec, isPlaying]);

  useFrame((_, delta) => {
    if (!isPlaying || !mixerRef.current || !actionRef.current) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    actionRef.current.paused = false;
    mixerRef.current.update(delta);
    if (typeof performance !== 'undefined') {
      recordMixerUpdateTimeMs(performance.now() - t0);
    }
    if (Math.floor(mixerRef.current.time * 10) % 3 === 0) {
      publishDebug({
        animationState: 'playing',
        currentTimeSec: actionRef.current.time,
        actionPaused: actionRef.current.paused,
        actionRunning: actionRef.current.isRunning(),
      });
    }
  });

  return (
    <group ref={groupRef} position={stagePos}>
      <primitive object={avatarClone} scale={1.1} />
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

export default AvatarCharacterAnimated3D;
