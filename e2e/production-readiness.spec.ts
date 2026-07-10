import { test, expect } from '@playwright/test';

test.describe('Production Readiness Bootstrap', () => {
  test('운영 품질 전역 API가 초기화된다', async ({ page }) => {
    await page.goto('/');

    const globals = await page.evaluate(() => ({
      flags: typeof (window as any).__K_ONNODE_FLAGS__?.getAll === 'function',
      telemetry: typeof (window as any).__K_ONNODE_TELEMETRY__?.getBuffer === 'function',
      benchmark: typeof (window as any).__K_ONNODE_BENCHMARK__?.getHistory === 'function',
      e2e: typeof (window as any).__K_ONNODE_E2E__?.runSmoke === 'function',
    }));

    expect(globals.flags).toBe(true);
    expect(globals.telemetry).toBe(true);
    expect(globals.benchmark).toBe(true);
    expect(globals.e2e).toBe(true);
  });

  test('Feature Flag 런타임 토글이 동작한다', async ({ page }) => {
    await page.goto('/');

    const toggled = await page.evaluate(() => {
      const mgr = (window as any).__K_ONNODE_FLAGS__;
      const before = mgr.get('rendererWorkerEnabled');
      mgr.set('rendererWorkerEnabled', !before);
      const after = mgr.get('rendererWorkerEnabled');
      mgr.reset('rendererWorkerEnabled');
      return { before, after, reset: mgr.get('rendererWorkerEnabled') };
    });

    expect(toggled.after).toBe(!toggled.before);
    expect(toggled.reset).toBe(toggled.before);
  });
});
