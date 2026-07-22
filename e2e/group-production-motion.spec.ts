import { test, expect } from '@playwright/test';

test.describe('Group Production Motion Asset E2E', () => {
  test('Production loader self-test — no fixture auto fallback', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const api = (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__;
      if (!api?.runProductionLoaderSelfTest) {
        return { pass: false, reason: 'runProductionLoaderSelfTest missing' };
      }
      return api.runProductionLoaderSelfTest();
    });
    expect(result.pass).toBe(true);
    expect(result.schemaVersion).toBe(2);
    expect(result.memberIds?.length).toBe(4);
    expect(new Set(result.motionAssetIds || []).size).toBe(4);
    expect(result.steps).toContain('fixtureAutoLoadBlocked');
    expect(result.steps).toContain('loadProductionMotionAsset');
  });

  test('REAL_MULTI_MEMBER_MOTION_ASSET_TEST — 4 distinct gltf_animation URLs', async ({ page }) => {
    await page.goto('/');
    const check = await page.evaluate(async () => {
      const mod = await import('/src/modes/group/fixtures/productionMotionTestContract.ts');
      const asset = mod.PRODUCTION_MOTION_TEST_CONTRACT;
      const urls = asset.members.map((m: { motion: { motionUrl: string } }) => m.motion.motionUrl);
      return {
        songId: 'production-motion-test',
        schemaVersion: asset.schemaVersion,
        status: asset.status,
        distinctUrls: new Set(urls).size,
        allGltf: asset.members.every(
          (m: { motion: { motionFormat: string } }) => m.motion.motionFormat === 'gltf_animation',
        ),
        motionAssetIds: asset.members.map((m: { motion: { motionAssetId: string } }) => m.motion.motionAssetId),
      };
    });
    expect(check.schemaVersion).toBe(2);
    expect(check.songId).toBe('production-motion-test');
    expect(check.status).toBe('ready');
    expect(check.distinctUrls).toBe(4);
    expect(check.allGltf).toBe(true);
    expect(new Set(check.motionAssetIds).size).toBe(4);
  });

  test('Member isolation V2 self-test (TEST 19~22 structural)', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const api = (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__;
      return api?.runMemberIsolationV2SelfTest?.() ?? { pass: false };
    });
    expect(result.pass).toBe(true);
    expect(result.results?.length).toBe(4);
  });
});
