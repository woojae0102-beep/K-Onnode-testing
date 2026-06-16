const { collectAndIndexTrainingKnowledge } = require('../../lib/trainer-knowledge/engine');

function assertCronAuth(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = req.headers.authorization || req.headers.Authorization;
  return auth === `Bearer ${cronSecret}`;
}

module.exports = async function handler(req, res) {
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
};
