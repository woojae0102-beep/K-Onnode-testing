// @ts-nocheck
/**
 * Playwright — Group Production Motion runtime E2E (DEV only).
 */
import { test, expect } from '@playwright/test';

test.describe('Group Production Motion UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__K_ONNODE_E2E_BYPASS_AUTH__ = true;
    });
  });

  test('Structural runtime — member_a, visible B/C/D, no user motion', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const api = (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__;
      return api?.runProductionMotionStructuralRuntimeE2E?.({ selectedMemberId: 'member_a' });
    });
    expect(result?.pass).toBe(true);
    expect(result?.isolation?.visibleAiMemberIds).toEqual(['member_b', 'member_c', 'member_d']);
    expect(new Set(result?.motionUrls || []).size).toBe(3);
  });

  test('Structural runtime — member_b, visible A/C/D', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      const api = (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__;
      return api?.runProductionMotionStructuralRuntimeE2E?.({ selectedMemberId: 'member_b' });
    });
    expect(result?.pass).toBe(true);
    expect(result?.isolation?.visibleAiMemberIds).toEqual(['member_a', 'member_c', 'member_d']);
  });

  test('Loader registry — production-motion-test contract', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const check = await page.evaluate(async () => {
      const api = (window as any).__K_ONNODE_GROUP_MOTION_DEBUG__;
      return api?.runProductionLoaderSelfTest?.();
    });
    expect(check?.pass).toBe(true);
    expect(check?.schemaVersion).toBe(2);
  });
});
