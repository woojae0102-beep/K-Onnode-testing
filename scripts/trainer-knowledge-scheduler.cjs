const cron = require('node-cron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BASE_URL = 'http://localhost:5173';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
  return (process.env.SCHEDULER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function collectTrainerKnowledge() {
  const headers = {};
  if (process.env.CRON_SECRET) headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  const response = await fetch(`${getBaseUrl()}/api/cron/knowledge-updater`, {
    method: 'GET',
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || response.statusText);
  }
  console.log('[trainer-knowledge] collection complete', {
    totalSources: data.totalSources,
    totalKnowledge: data.totalKnowledge,
  });
  return data;
}

function startScheduler() {
  console.log('[trainer-knowledge-scheduler] started', {
    baseUrl: getBaseUrl(),
    schedule: '0 3 * * *',
  });
  cron.schedule('0 3 * * *', () => {
    collectTrainerKnowledge().catch((err) => {
      console.error('[trainer-knowledge] collection failed:', err);
    });
  });
}

if (require.main === module) {
  startScheduler();
}

module.exports = {
  collectTrainerKnowledge,
  startScheduler,
};
