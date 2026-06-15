const cron = require('node-cron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BASE_URL = 'http://localhost:5173';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

function getBaseUrl() {
  return (
    process.env.SCHEDULER_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    process.env.VITE_PUBLIC_APP_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
}

async function callCronEndpoint(path) {
  const baseUrl = getBaseUrl();
  const headers = {};
  if (process.env.CRON_SECRET) {
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  }

  const url = `${baseUrl}${path}`;
  const response = await fetch(url, { method: 'GET', headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${data.message || data.error || response.statusText}`);
  }
  return data;
}

async function refreshInstagramTokens() {
  console.log('--- 인스타그램 정기 토큰 갱신 시작 ---');
  const result = await callCronEndpoint('/api/cron/refresh-instagram-tokens');
  console.log('--- 인스타그램 정기 토큰 갱신 완료 ---', {
    total: result.total,
    successCount: result.successCount,
    failedCount: result.failedCount,
  });
  return result;
}

async function refreshTikTokTokens() {
  console.log('--- 틱톡 정기 토큰 갱신 시작 ---');
  const result = await callCronEndpoint('/api/cron/refresh-tiktok-tokens');
  console.log('--- 틱톡 정기 토큰 갱신 완료 ---', {
    total: result.total,
    successCount: result.successCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
  });
  return result;
}

function startScheduler() {
  console.log('[social-token-scheduler] started', {
    baseUrl: getBaseUrl(),
    hasCronSecret: Boolean(process.env.CRON_SECRET),
  });

  // Instagram: 매월 1일과 15일 자정에 실행합니다.
  cron.schedule('0 0 1,15 * *', () => {
    refreshInstagramTokens().catch((err) => {
      console.error('Instagram token refresh scheduler failed:', err);
    });
  });

  // TikTok: 매일 밤 11시 50분에 실행합니다.
  cron.schedule('50 23 * * *', () => {
    refreshTikTokTokens().catch((err) => {
      console.error('TikTok token refresh scheduler failed:', err);
    });
  });
}

if (require.main === module) {
  startScheduler();
}

module.exports = {
  refreshInstagramTokens,
  refreshTikTokTokens,
  startScheduler,
};
