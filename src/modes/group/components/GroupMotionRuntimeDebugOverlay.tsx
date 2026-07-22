// @ts-nocheck
import React from 'react';
import type { GroupMotionRuntimeDebugSnapshot } from '../runtime/groupMotionRuntimeDebug';

export function GroupMotionRuntimeDebugOverlay({
  snapshot,
}: {
  snapshot: GroupMotionRuntimeDebugSnapshot | null;
}) {
  if (!snapshot) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 30,
        maxWidth: 360,
        maxHeight: '70vh',
        overflow: 'auto',
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(0,0,0,0.78)',
        color: '#a8f0c8',
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        lineHeight: 1.45,
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: '#7ec8ff', fontWeight: 700, marginBottom: 6 }}>GROUP MOTION RUNTIME</div>
      {snapshot.devFixture ? (
        <div style={{ color: '#FFD700', fontWeight: 700, marginBottom: 4 }}>DEV MOTION FIXTURE</div>
      ) : null}
      <div>selected: {snapshot.selectedMemberId}</div>
      <div>userSlot: {snapshot.userSlotMemberId || '—'}</div>
      <div>visible AI: {snapshot.visibleAiMemberIds.join(', ') || '—'}</div>
      <div>mounted: {snapshot.mountedAvatarMemberIds.join(', ') || '—'}</div>
      <div>motion loaded: {snapshot.loadedMotionMemberIds.join(', ') || '—'}</div>
      <div>mixers: {snapshot.mixerCreatedMemberIds.join(', ') || '—'}</div>
      <div>status: {snapshot.groupMotionAssetStatus}</div>
      <div>schema: v{snapshot.groupMotionAssetSchemaVersion ?? '?'}</div>
      <div>time: {snapshot.currentTimeSec.toFixed(2)} / {snapshot.durationSec.toFixed(1)}s · playing={String(snapshot.isPlaying)}</div>
      <div style={{ marginTop: 6, color: '#ccc' }}>motions: {snapshot.loadedMotionAssetIds.join(', ') || '—'}</div>

      <div style={{ marginTop: 8, borderTop: '1px solid rgba(127,200,255,0.25)', paddingTop: 6, color: '#7ec8ff' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>[PERFORMANCE]</div>
        <div>avatars: {snapshot.performanceMetrics.avatarCount} · mixers: {snapshot.performanceMetrics.mixerCount} · actions: {snapshot.performanceMetrics.activeActionCount}</div>
        <div>loaded GLBs: {snapshot.performanceMetrics.loadedGltfUrls} · cache hits/miss GLTF: {snapshot.performanceMetrics.cachedGltfHits}/{snapshot.performanceMetrics.cachedGltfMisses}</div>
        <div>clip cache: {snapshot.performanceMetrics.cachedMotionClipHits}/{snapshot.performanceMetrics.cachedMotionClipMisses}</div>
        <div>retarget cache: {snapshot.performanceMetrics.cachedRetargetHits}/{snapshot.performanceMetrics.cachedRetargetMisses}</div>
        <div>mapping cache: {snapshot.performanceMetrics.cachedBoneMappingHits}/{snapshot.performanceMetrics.cachedBoneMappingMisses}</div>
        <div>skeleton cache: {snapshot.performanceMetrics.cachedSkeletonRuntimeHits}/{snapshot.performanceMetrics.cachedSkeletonRuntimeMisses}</div>
        <div>update avg/peak ms: {snapshot.performanceMetrics.averageUpdateTimeMs.toFixed(3)}/{snapshot.performanceMetrics.peakUpdateTimeMs.toFixed(3)}</div>
        <div>memory objects: {snapshot.performanceMetrics.memoryObjectCount} · disposed mixers: {snapshot.performanceMetrics.disposedMixerCount}</div>
        <div>failed loads: {snapshot.performanceMetrics.failedLoadCount}</div>
      </div>

      {Object.values(snapshot.memberMixerStates).map((m) => (
        <div key={m.memberId} style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
          <div style={{ color: '#ffb347' }}>{m.memberId}</div>
          <div>motionAssetId: {m.motionAssetId || '—'}</div>
          <div>avatarLoaded: {String(m.avatarLoaded)} · motionLoaded: {String(m.motionLoaded)}</div>
          <div>mixer: {String(m.mixerCreated)} · clips: {m.clipCount} [{m.clipNames.join(', ')}]</div>

          <div style={{ marginTop: 4, color: '#9fd4ff' }}>[SKELETON CONTRACT]</div>
          <div>avatarProfile: {m.avatarSkeletonProfile || '—'}</div>
          <div>motionProfile: {m.motionSkeletonProfile || '—'}</div>
          {m.skeletonValidation ? (
            <>
              <div>required: {m.skeletonValidation.matchedRequiredBoneCount}/{m.skeletonValidation.requiredBoneCount}</div>
              <div>missing: {m.skeletonValidation.missingRequiredBones.join(', ') || '—'}</div>
              <div>duplicate: {m.skeletonValidation.duplicateSemanticBones.join(', ') || '—'}</div>
              <div>mappingRatio: {m.skeletonValidation.mappingRatio.toFixed(2)}</div>
            </>
          ) : null}

          {m.motionBinding ? (
            <>
              <div style={{ marginTop: 4, color: '#9fd4ff' }}>[BINDING]</div>
              <div>binding: {m.motionBinding.bindingStatus} · ratio={m.motionBinding.bindingRatio.toFixed(2)}</div>
              <div>strategy: {m.motionBinding.motionBindingStrategy}</div>
            </>
          ) : null}

          <div style={{ marginTop: 4, color: '#9fd4ff' }}>[RETARGET]</div>
          <div>playbackPath: {m.playbackPath || '—'}</div>
          <div>retargetStatus: {m.retargetResult?.status || '—'}</div>
          <div>mappedSemantic: {Object.keys(m.mappedSemanticBones || {}).join(', ') || '—'}</div>
          <div>retargetedTracks: {m.retargetedTrackCount ?? '—'}</div>

          <div style={{ marginTop: 4, color: '#9fd4ff' }}>[PROOF]</div>
          {m.transformProof ? (
            <div>
              changed: {m.transformProof.changedBoneCount}/{m.transformProof.sampledBoneCount}
              {' · '}
              {('proof' in m.transformProof ? m.transformProof.proof : m.transformProof.transformProof)}
            </div>
          ) : null}
          <div>finalStatus: {m.finalStatus || '—'}</div>

          <div>clip: {m.selectedClipName || '—'} · dur={m.clipDurationSec?.toFixed(2) ?? '?'}</div>
          <div>state: {m.animationState} · t={m.currentTimeSec.toFixed(2)}</div>
          {m.clipError ? <div style={{ color: '#ff8080' }}>error: {m.clipError}</div> : null}
        </div>
      ))}

      {snapshot.runtimeSteps.length ? (
        <div style={{ marginTop: 8, color: '#888', fontSize: 9 }}>
          steps: {snapshot.runtimeSteps.slice(-5).join(' | ')}
        </div>
      ) : null}
    </div>
  );
}

export default GroupMotionRuntimeDebugOverlay;
