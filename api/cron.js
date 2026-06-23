const { collectTrending, setCache } = require('../lib/api-lib/trending.cjs');
const { collectAndIndexTrainingKnowledge } = require('../lib/trainer-knowledge/engine');
const refreshInstagramTokens = require('../lib/api-handlers/cron/refresh-instagram-tokens');
const refreshTikTokTokens = require('../lib/api-handlers/cron/refresh-tiktok-tokens');
const knowledgeUpdater = require('../lib/api-handlers/cron/knowledge-updater');

function getAction(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const raw = url.searchParams.get('path') || '';
  return raw.split('/').filter(Boolean)[0] || '';
}

function assertCronAuth(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = req.headers.authorization || req.headers.Authorization;
  return auth === `Bearer ${cronSecret}`;
}

async function updateTrending(req, res) {
  if (!assertCronAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = await collectTrending();
    setCache(payload);
    return res.status(200).json({
      success: true,
      updated: new Date().toISOString(),
      counts: {
        trending: payload.trending.length,
        dance: payload.dance.length,
        songs: payload.songs.length,
        challenges: payload.challenges.length,
      },
      usedFallback: payload.usedFallback,
      reason: payload.reason,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Update failed', message: String(error?.message || error) });
  }
}

async function collectTrainerKnowledge(req, res) {
  if (!assertCronAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const results = await collectAndIndexTrainingKnowledge({
      queries: [
        'KPOP vocal training breath pitch lesson',
        'KPOP vocal coach idol training resonance',
        'KPOP dance training choreography details',
        'KPOP dance basic groove isolation lesson',
        'KPOP idol audition training dance vocal',
        'Korean pronunciation KPOP lyrics training',
      ],
      maxResults: Number(process.env.TRAINER_KNOWLEDGE_DAILY_MAX_RESULTS || 3),
    });
    return res.status(200).json({
      success: true,
      collectedAt: new Date().toISOString(),
      totalSources: results.length,
      totalKnowledge: results.reduce((sum, row) => sum + (row.knowledgeCount || 0), 0),
      results,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Trainer knowledge collection failed',
      message: err.message || String(err),
    });
  }
}

module.exports = async function handler(req, res) {
  const action = getAction(req);
  if (action === 'update-trending') return updateTrending(req, res);
  if (action === 'refresh-instagram-tokens') return refreshInstagramTokens(req, res);
  if (action === 'refresh-tiktok-tokens') return refreshTikTokTokens(req, res);
  if (action === 'knowledge-updater') return knowledgeUpdater(req, res);
  if (action === 'collect-trainer-knowledge') return collectTrainerKnowledge(req, res);
  return res.status(404).json({ error: 'Unknown cron action', action });
};

