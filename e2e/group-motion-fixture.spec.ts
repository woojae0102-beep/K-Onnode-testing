import { test, expect } from '@playwright/test';

test.describe('Group Motion DEV Fixture E2E', () => {
  test('Group motion debug API — member isolation self-test', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const api = (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__;
      if (!api?.runMemberIsolationSelfTest) {
        return { pass: false, reason: 'debug API missing' };
      }
      return api.runMemberIsolationSelfTest();
    });
    expect(result.pass).toBe(true);
    expect(result.results?.length).toBe(4);
  });

  test('Group motion debug API — fixture motion URLs are distinct gltf_animation', async ({ page }) => {
    await page.goto('/');
    const check = await page.evaluate(async () => {
      const mod = await import('/src/modes/group/fixtures/realMotionAssetFixture.ts');
      const fixture = mod.buildRealMotionAssetFixture({ songId: 'how-you-like-that' });
      const urls = fixture.members.map((m: { motionUrl: string }) => m.motionUrl);
      return {
        status: fixture.status,
        devFixture: fixture.devFixture,
        distinctUrls: new Set(urls).size,
        allGltf: fixture.members.every((m: { motionFormat: string }) => m.motionFormat === 'gltf_animation'),
        motionAssetIds: fixture.members.map((m: { motionAssetId: string }) => m.motionAssetId),
      };
    });
    expect(check.status).toBe('motion_asset_ready');
    expect(check.devFixture).toBe(true);
    expect(check.distinctUrls).toBe(4);
    expect(check.allGltf).toBe(true);
    expect(new Set(check.motionAssetIds).size).toBe(4);
  });
});
