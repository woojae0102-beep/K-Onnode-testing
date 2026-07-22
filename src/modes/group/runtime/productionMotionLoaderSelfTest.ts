// @ts-nocheck
/**
 * Production Motion Asset loader + isolation structural self-test (DEV browser/e2e).
 */
import {
  loadProductionMotionAsset,
  registerTestProductionMotionAsset,
  clearTestProductionMotionAssets,
} from '../services/ProductionMotionAssetLoader';
import { PRODUCTION_MOTION_TEST_CONTRACT } from '../fixtures/productionMotionTestContract';
import { runMemberMotionIsolationV2SelfTest } from './memberMotionIsolationV2SelfTest';
import { shouldUseDevMotionFixture } from '../fixtures/realMotionAssetFixture';

export async function runProductionMotionLoaderSelfTest() {
  const steps: string[] = [];
  try {
    steps.push('fixtureAutoLoadBlocked');
    if (shouldUseDevMotionFixture('how-you-like-that')) {
      return { pass: false, steps, reason: 'shouldUseDevMotionFixture must be false' };
    }

    steps.push('registerTestAsset');
    clearTestProductionMotionAssets();
    registerTestProductionMotionAsset(PRODUCTION_MOTION_TEST_CONTRACT);

    steps.push('loadProductionMotionAsset');
    const { asset, source } = await loadProductionMotionAsset({
      groupId: PRODUCTION_MOTION_TEST_CONTRACT.groupId,
      songId: PRODUCTION_MOTION_TEST_CONTRACT.songId,
    });

    if (source !== 'test_registry') {
      return { pass: false, steps, reason: `unexpected source: ${source}` };
    }
    if (asset.schemaVersion !== 2 || asset.members.length !== 4) {
      return { pass: false, steps, reason: 'invalid asset shape' };
    }

    const motionUrls = asset.members.map((m) => m.motion.motionUrl);
    if (new Set(motionUrls).size !== 4) {
      return { pass: false, steps, reason: 'motion URLs not distinct' };
    }

    steps.push('memberIsolationV2');
    const isolation = runMemberMotionIsolationV2SelfTest();
    if (!isolation.pass) {
      return { pass: false, steps, reason: 'member isolation failed', isolation };
    }

    steps.push('complete');
    return {
      pass: true,
      steps,
      schemaVersion: asset.schemaVersion,
      memberIds: asset.members.map((m) => m.memberId),
      motionAssetIds: asset.members.map((m) => m.motion.motionAssetId),
    };
  } catch (err) {
    return {
      pass: false,
      steps,
      reason: (err as Error)?.message || String(err),
    };
  } finally {
    clearTestProductionMotionAssets();
  }
}

export default runProductionMotionLoaderSelfTest;
