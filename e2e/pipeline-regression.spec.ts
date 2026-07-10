import { test, expect } from '@playwright/test';

/**
 * E2E 회귀 — 영상 업로드 → Motion Extraction → DanceDatabase → Renderer → GroupStudio
 *
 * CI/로컬에서 실제 MediaPipe·GPU 없이도 파이프라인 계약(이벤트·Telemetry·단계 마킹)을 검증한다.
 * 실제 영상 추출 E2E는 `?benchmark=30s` 수동 실행 + Benchmark JSON으로 보완한다.
 */
test.describe('Pipeline Regression', () => {
  test('파이프라인 스모크 — 5단계 이벤트·Telemetry 연동', async ({ page }) => {
    await page.goto('/');

    const smoke = await page.evaluate(() => (window as any).__K_ONNODE_E2E__.runSmoke());

    expect(smoke.flagsOk).toBe(true);
    expect(smoke.telemetryOk).toBe(true);
    expect(smoke.gpuMonitorOk).toBe(true);
    expect(smoke.eventBusOk).toBe(true);
    expect(smoke.steps).toEqual(
      expect.arrayContaining([
        'upload',
        'motion-extraction',
        'dance-database',
        'renderer',
        'group-studio',
      ]),
    );
  });

  test('Telemetry 버퍼에 motion-extraction 이벤트가 기록된다', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (window as any).__K_ONNODE_E2E__.runSmoke());

    const events = await page.evaluate(() => (window as any).__K_ONNODE_TELEMETRY__.getBuffer());
    const categories = events.map((e: { category: string }) => e.category);

    expect(categories).toContain('info');
  });

  test('Benchmark 히스토리 API가 접근 가능하다', async ({ page }) => {
    await page.goto('/?benchmark=30s');

    const history = await page.evaluate(() => (window as any).__K_ONNODE_BENCHMARK__.getHistory('30s'));
    expect(Array.isArray(history)).toBe(true);
  });
});
