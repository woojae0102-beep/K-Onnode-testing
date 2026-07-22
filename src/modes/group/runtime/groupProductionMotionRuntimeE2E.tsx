// @ts-nocheck
/**
 * Production Motion Runtime E2E — 3D Stage mount + mixer/pause/seek 검증 (DEV browser).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  registerTestProductionMotionAsset,
  clearTestProductionMotionAssets,
  loadProductionMotionAsset,
} from '../services/ProductionMotionAssetLoader';
import {
  PRODUCTION_MOTION_TEST_CONTRACT,
  PRODUCTION_MOTION_TEST_GROUP_ID,
  PRODUCTION_MOTION_TEST_SONG_ID,
} from '../fixtures/productionMotionTestContract';
import {
  productionMotionAssetV2ToGroupMotionAsset,
  productionMotionAssetV2ToLegacyDanceAsset,
} from './productionMotionAssetV2Mapper';
import { buildGroupPracticeSessionFromMotionAsset } from '../services/buildGroupPracticeSession';
import { GroupDanceSyncEngine } from '../../../services/group/GroupDanceSyncEngine';
import { AvatarGroupManager } from '../../../services/group/AvatarGroupManager';
import { GROUP_DATA } from '../../../data/groupPracticeData';
import { computePracticeTimeline } from '../../../utils/practiceTimelineUtils';
import { assemblePracticeMotionSnapshot } from '../../../utils/motionSnapshotUtils';
import { resolveProductionAvatarAssets } from '../../../hooks/useProductionAvatarAssets';
import { GroupDanceStage3D } from '../../../components/group/three/GroupDanceStage3D';
import { useGLTF } from '@react-three/drei';
import {
  getLatestGroupMotionRuntimeDebugSnapshot,
  clearGroupMotionRuntimeDebug,
  buildGroupMotionRuntimeDebugSnapshot,
  appendGroupMotionRuntimeStep,
} from './groupMotionRuntimeDebug';
import {
  assertGroupMotionIsolationInvariants,
  buildGroupMotionIsolationSnapshot,
  validateSelectedMemberAndActors,
} from './validateGroupMotionRuntime';

const MOUNT_ID = 'k-onnode-group-motion-e2e-root';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function motionAssetToDataset(asset: ReturnType<typeof productionMotionAssetV2ToGroupMotionAsset>, groupMembers: typeof GROUP_DATA[string]['members']) {
  return {
    meta: {
      groupId: asset.groupId,
      songId: asset.songId,
      durationSec: asset.durationSec,
      formation: GROUP_DATA[asset.groupId]?.defaultFormation || 'diamond',
      fps: asset.fps,
    },
    members: asset.members.map((m) => {
      const gm = groupMembers.find((g) => g.id === m.memberId);
      const anchor = m.formationTimeline?.[0]?.position || { x: gm?.defaultX ?? 0.5, y: gm?.defaultY ?? 0.5, z: 0 };
      return {
        memberId: m.memberId,
        displayName: m.memberName || gm?.name || m.memberId,
        displayNameKr: gm?.nameKr,
        persona: { styleId: 'member', energy: 0.8, sharpness: 0.75, groove: 0.7, accentColor: gm?.color || '#FF1F8E' },
        formationAnchor: anchor,
      };
    }),
    frames: [],
  };
}

function buildTickSnapshot(pkg: { engine: GroupDanceSyncEngine; motionAsset: ReturnType<typeof productionMotionAssetV2ToGroupMotionAsset> }, selectedMemberId: string, timeSec: number) {
  const gm = GROUP_DATA[pkg.motionAsset.groupId]?.members.find((m) => m.id === selectedMemberId);
  const userAnchor = { x: gm?.defaultX ?? 0.5, y: gm?.defaultY ?? 0.5, z: 0 };
  const tick = pkg.engine.tick({ elapsedSec: timeSec, userFallbackAnchor: userAnchor });
  return {
    tick,
    assembled: assemblePracticeMotionSnapshot(tick, {
      groupId: pkg.motionAsset.groupId,
      songId: pkg.motionAsset.songId,
      userMemberId: selectedMemberId,
      referenceVideo: null,
    }),
  };
}

function RuntimeStageHarness({
  selectedMemberId,
  onReady,
}: {
  selectedMemberId: string;
  onReady: (ctrl: { setPlaying: (v: boolean) => void; setTime: (t: number) => void }) => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [timeSec, setTimeSec] = useState(0);
  const engineRef = useRef(null);
  const pkg = useMemo(() => {
    const motionAsset = productionMotionAssetV2ToGroupMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);
    const productionAsset = productionMotionAssetV2ToLegacyDanceAsset(PRODUCTION_MOTION_TEST_CONTRACT);
    const group = GROUP_DATA[motionAsset.groupId];
    const timeline = computePracticeTimeline(motionAsset.durationSec, motionAsset.fps || 30);
    const dataset = motionAssetToDataset(motionAsset, group.members);
    const manager = new AvatarGroupManager({
      dataset,
      groupMembers: group.members,
      userMemberId: selectedMemberId,
    });
    const engine = new GroupDanceSyncEngine(motionAsset, manager, { timeline });
    engineRef.current = engine;
    return { motionAsset, productionAsset, engine, group };
  }, [selectedMemberId]);

  const [snapshot, setSnapshot] = useState(() => buildTickSnapshot(pkg, selectedMemberId, 0).assembled);

  useEffect(() => {
    onReady({ setPlaying, setTime: setTimeSec });
  }, [onReady]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setTimeSec((t) => t + 0.05);
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const { tick, assembled } = buildTickSnapshot(pkg, selectedMemberId, timeSec);
    setSnapshot(assembled);

    const visibleIds = tick.aiAvatars.map((a) => a.memberId);
    buildGroupMotionRuntimeDebugSnapshot({
      currentTimeSec: timeSec,
      durationSec: pkg.motionAsset.durationSec,
      isPlaying: playing,
      selectedMemberId,
      visibleMemberIds: visibleIds,
      loadedMotionAssetIds: tick.aiAvatars.map((a) => a.motionAssetId).filter(Boolean),
      motionAssetStatus: pkg.motionAsset.status,
      schemaVersion: 2,
      devFixture: false,
    });
  }, [timeSec, playing, pkg, selectedMemberId]);

  const aiIds = snapshot?.motion?.aiAvatars?.map((a) => a.memberId) || [];
  const avatarAssets = resolveProductionAvatarAssets(pkg.productionAsset, aiIds);

  return (
    <div style={{ width: 640, height: 480 }}>
      <GroupDanceStage3D
        snapshot={snapshot}
        currentTimeSec={timeSec}
        isPlaying={playing}
        productionAvatarAssets={avatarAssets}
        className="group-studio-stage-3d"
      />
    </div>
  );
}

async function waitForMixers(visibleIds: string[], timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = getLatestGroupMotionRuntimeDebugSnapshot();
    if (snap && visibleIds.every((id) => snap.mixerCreatedMemberIds.includes(id))) {
      const allClips = visibleIds.every((id) => {
        const st = snap.memberMixerStates[id];
        return st?.selectedClipName && !st?.clipError;
      });
      if (allClips) return snap;
    }
    await sleep(250);
  }
  return getLatestGroupMotionRuntimeDebugSnapshot();
}

export async function runProductionMotionStructuralRuntimeE2E(opts: { selectedMemberId: string }) {
  const steps: string[] = [];
  const selectedMemberId = opts.selectedMemberId;
  try {
    clearTestProductionMotionAssets();
    registerTestProductionMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);
    steps.push('registerTestAsset');

    const { asset, source } = await loadProductionMotionAsset({
      groupId: PRODUCTION_MOTION_TEST_GROUP_ID,
      songId: PRODUCTION_MOTION_TEST_SONG_ID,
    });
    if (source !== 'test_registry') {
      return { pass: false, steps, reason: `unexpected source: ${source}` };
    }

    const visible = validateSelectedMemberAndActors(asset, selectedMemberId).visibleAiMembers.map((m) => m.memberId);
    steps.push(`visibleAi:${visible.join(',')}`);

    const motionAsset = productionMotionAssetV2ToGroupMotionAsset(asset);
    const group = GROUP_DATA[motionAsset.groupId];
    const timeline = computePracticeTimeline(motionAsset.durationSec, motionAsset.fps || 30);
    const dataset = motionAssetToDataset(motionAsset, group.members);
    const manager = new AvatarGroupManager({ dataset, groupMembers: group.members, userMemberId: selectedMemberId });
    const engine = new GroupDanceSyncEngine(motionAsset, manager, { timeline });
    const gm = group.members.find((m) => m.id === selectedMemberId);
    const tick = engine.tick({
      elapsedSec: 0,
      userFallbackAnchor: { x: gm?.defaultX ?? 0.5, y: gm?.defaultY ?? 0.5, z: 0 },
    });

    const userMotionLoaded = tick.aiAvatars.some((a) => a.memberId === selectedMemberId);
    if (userMotionLoaded) {
      return { pass: false, steps, reason: 'selected member must not appear in aiAvatars tick' };
    }

    const isolation = {
      selectedMemberId,
      userSlot: selectedMemberId,
      visibleAiMemberIds: visible,
      mountedAvatarMemberIds: [],
      loadedMotionMemberIds: tick.aiAvatars.map((a) => a.memberId),
      mixerCreatedMemberIds: [],
      currentTimeSecByMember: {},
    };

    steps.push('engineTick');
    return { pass: true, steps, isolation, motionUrls: tick.aiAvatars.map((a) => a.motionUrl) };
  } catch (err) {
    return { pass: false, steps, reason: (err as Error)?.message || String(err) };
  } finally {
    clearTestProductionMotionAssets();
  }
}

export async function runProductionMotionRuntimeE2E(opts: { selectedMemberId: string }) {
  return Promise.race([
    runProductionMotionRuntimeE2EInternal(opts),
    sleep(55000).then(() => ({
      pass: false,
      steps: ['overallTimeout'],
      reason: 'runtime e2e overall timeout (GLB/Suspense)',
    })),
  ]);
}

async function runProductionMotionRuntimeE2EInternal(opts: { selectedMemberId: string }) {
  const steps: string[] = [];
  const selectedMemberId = opts.selectedMemberId;
  let root: ReturnType<typeof createRoot> | null = null;
  let controls: { setPlaying: (v: boolean) => void; setTime: (t: number) => void } | null = null;

  try {
    clearGroupMotionRuntimeDebug();
    clearTestProductionMotionAssets();
    registerTestProductionMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);
    steps.push('registerTestAsset');

    const { asset } = await loadProductionMotionAsset({
      groupId: PRODUCTION_MOTION_TEST_GROUP_ID,
      songId: PRODUCTION_MOTION_TEST_SONG_ID,
    });
    validateSelectedMemberAndActors(asset, selectedMemberId);
    steps.push('loadProductionAsset');

    const visible = validateSelectedMemberAndActors(asset, selectedMemberId).visibleAiMembers.map((m) => m.memberId);
    steps.push(`visibleAi:${visible.join(',')}`);

    let mount = document.getElementById(MOUNT_ID);
    if (!mount) {
      mount = document.createElement('div');
      mount.id = MOUNT_ID;
      mount.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:480px;z-index:99999;opacity:0.01;pointer-events:none;';
      document.body.appendChild(mount);
    }

    root = createRoot(mount);
    await new Promise<void>((resolve) => {
      root!.render(
        <RuntimeStageHarness
          selectedMemberId={selectedMemberId}
          onReady={(ctrl) => {
            controls = ctrl;
            resolve();
          }}
        />,
      );
    });
    steps.push('mount3DStage');
    appendGroupMotionRuntimeStep('e2e.mount3DStage');

    PRODUCTION_MOTION_TEST_CONTRACT.members.forEach((m) => {
      useGLTF.preload(m.avatar.glbUrl);
      useGLTF.preload(m.motion.motionUrl);
    });
    await sleep(3000);

    const snap = await waitForMixers(visible, 45000);
    if (!snap || !visible.every((id) => snap.mixerCreatedMemberIds.includes(id))) {
      const partial = getLatestGroupMotionRuntimeDebugSnapshot();
      return {
        pass: false,
        steps,
        reason: 'mixer timeout (headless GLB load)',
        snapshot: partial,
        memberMixerStates: partial?.memberMixerStates || {},
        isolation: buildGroupMotionIsolationSnapshot({
          selectedMemberId,
          visibleAiMemberIds: visible,
          memberMixerStates: partial?.memberMixerStates || {},
        }),
      };
    }
    steps.push('mixersReady');

    const isolation = buildGroupMotionIsolationSnapshot({
      selectedMemberId,
      visibleAiMemberIds: visible,
      memberMixerStates: snap.memberMixerStates,
    });
    try {
      assertGroupMotionIsolationInvariants(isolation);
      steps.push('isolationInvariants');
    } catch (err) {
      return { pass: false, steps, reason: (err as Error).message, isolation };
    }

    const t0 = { ...snap.currentTimeSecByMember };
    await sleep(600);
    const snap1 = getLatestGroupMotionRuntimeDebugSnapshot();
    const increased = visible.some((id) => (snap1?.currentTimeSecByMember[id] ?? 0) > (t0[id] ?? 0));
    if (!increased) {
      return { pass: false, steps, reason: 'currentTimeSec did not increase while playing', snap1 };
    }
    steps.push('timeIncreased');

    controls?.setPlaying(false);
    appendGroupMotionRuntimeStep('pause');
    await sleep(400);
    const pausedSnap = getLatestGroupMotionRuntimeDebugSnapshot();
    const pausedAt = { ...pausedSnap?.currentTimeSecByMember };
    await sleep(500);
    const stillPaused = getLatestGroupMotionRuntimeDebugSnapshot();
    const frozen = visible.every((id) => Math.abs((stillPaused?.currentTimeSecByMember[id] ?? 0) - (pausedAt[id] ?? 0)) < 0.05);
    if (!frozen) {
      return { pass: false, steps, reason: 'time continued during pause', stillPaused };
    }
    steps.push('pauseVerified');

    controls?.setPlaying(true);
    appendGroupMotionRuntimeStep('resume');
    await sleep(600);
    steps.push('resumeVerified');

    controls?.setTime(10);
    appendGroupMotionRuntimeStep('seek(10)');
    await sleep(400);
    const seekSnap = getLatestGroupMotionRuntimeDebugSnapshot();
    const seekOk = visible.every((id) => {
      const t = seekSnap?.currentTimeSecByMember[id] ?? 0;
      return t >= 9 && t <= 11;
    });
    if (!seekOk) {
      return { pass: false, steps, reason: 'seek(10) not applied', seekSnap };
    }
    steps.push('seekVerified');

    return {
      pass: true,
      steps,
      selectedMemberId,
      isolation,
      snapshot: seekSnap,
    };
  } catch (err) {
    return {
      pass: false,
      steps,
      reason: (err as Error)?.message || String(err),
      snapshot: getLatestGroupMotionRuntimeDebugSnapshot(),
    };
  } finally {
    root?.unmount();
    clearTestProductionMotionAssets();
  }
}

export default runProductionMotionRuntimeE2E;
