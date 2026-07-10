/**
 * reconstructFrame 163s 벤치마크 실행 — Playwright + Vite preview
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`Server not ready: ${url}`);
}

const BASE_URL = 'https://127.0.0.1:5174';

async function main() {
  const preview = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let previewLog = '';
  preview.stdout?.on('data', (d) => { previewLog += d.toString(); });
  preview.stderr?.on('data', (d) => { previewLog += d.toString(); });

  try {
    await sleep(12000);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    const consoleLines = [];
    page.on('console', (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'table') {
        msg.args().forEach(async (arg) => {
          try {
            const val = await arg.jsonValue();
            console.log('\n--- console.table ---');
            console.table(val);
          } catch {
            console.log(msg.text());
          }
        });
      } else {
        console.log(`[${msg.type()}] ${msg.text()}`);
      }
    });

    await page.goto(`${BASE_URL}/benchmark.html`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => window.__BENCH_DONE__ === true, { timeout: 300000 });

    const result = await page.evaluate(() => window.__BENCH_RESULT__);
    const error = await page.evaluate(() => window.__BENCH_ERROR__ || null);

    if (error) {
      console.error('Benchmark error:', error);
      process.exit(1);
    }

    console.log('\n========== BENCHMARK RESULT (serialized) ==========');
    console.log(JSON.stringify(result, null, 2));

    await browser.close();
  } finally {
    preview.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
