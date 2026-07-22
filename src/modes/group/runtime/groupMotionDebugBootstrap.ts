// @ts-nocheck
import { isDevEnvironment } from '../../../utils/isDevEnvironment';
import {
  getLatestGroupMotionRuntimeDebugSnapshot,
  buildGroupMotionRuntimeDebugSnapshot,
  clearGroupMotionRuntimeDebug,
} from './groupMotionRuntimeDebug';
import { runMemberMotionIsolationSelfTest } from './memberMotionIsolationSelfTest';
import { runMemberMotionIsolationV2SelfTest } from './memberMotionIsolationV2SelfTest';
import { runProductionMotionLoaderSelfTest } from './productionMotionLoaderSelfTest';
import { runProductionMotionRuntimeE2E, runProductionMotionStructuralRuntimeE2E } from './groupProductionMotionRuntimeE2E';
import { loadDevMotionFixturePractice } from '../fixtures/realMotionAssetFixture';
import {
  registerTestProductionMotionAsset,
  clearTestProductionMotionAssets,
} from '../services/ProductionMotionAssetLoader';
import { PRODUCTION_MOTION_TEST_CONTRACT } from '../fixtures/productionMotionTestContract';

export async function loadDevAnimationMixerFixture(opts: {
  selectedMemberId: string;
  songId?: string;
}) {
  if (!isDevEnvironment()) {
    throw new Error('DEV fixture load is DEV-only');
  }
  return loadDevMotionFixturePractice({
    selectedMemberId: opts.selectedMemberId,
    songId: opts.songId || 'how-you-like-that',
  });
}

export function registerRealMultiMemberMotionTestAsset() {
  if (!isDevEnvironment()) {
    throw new Error('Test asset registration is DEV-only');
  }
  registerTestProductionMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);
}

export function installGroupMotionDebugGlobals(): void {
  if (!isDevEnvironment() || typeof window === 'undefined') return;

  (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__ = {
    getSnapshot: () => getLatestGroupMotionRuntimeDebugSnapshot(),
    buildSnapshot: buildGroupMotionRuntimeDebugSnapshot,
    runMemberIsolationSelfTest: runMemberMotionIsolationSelfTest,
    runMemberIsolationV2SelfTest: runMemberMotionIsolationV2SelfTest,
    runProductionLoaderSelfTest: runProductionMotionLoaderSelfTest,
    runProductionMotionRuntimeE2E,
    runProductionMotionStructuralRuntimeE2E,
    clearDebug: clearGroupMotionRuntimeDebug,
  };

  (window as any).__K_ONNODE_GROUP_DEBUG__ = {
    loadFixture: loadDevAnimationMixerFixture,
    registerRealMultiMemberMotionTestAsset,
    clearTestAssets: clearTestProductionMotionAssets,
  };
}

export default installGroupMotionDebugGlobals;
