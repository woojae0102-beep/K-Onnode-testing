const { getAdmin } = require(`${process.cwd()}/lib/api-lib/firebaseAdmin.cjs`);
const { collectAndIndexTrainingKnowledge, extractTrainingKnowledge, upsertKnowledge } = require(`${process.cwd()}/lib/trainer-knowledge/engine.js`);

function okAuth(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return (req.headers.authorization || req.headers.Authorization) === `Bearer ${secret}`;
}

async function callClaudeJson(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = String(data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(raw); } catch { return null; }
}

async function cleanup(admin) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const snap = await admin.firestore().collection('trainer_knowledge_chunks').where('updatedAt', '<', cutoff).limit(100).get();
  if (snap.empty) return 0;
  const batch = admin.firestore().batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function extractUserPatterns(admin) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const issues = [];
  for (const name of ['practice_sessions', 'training_sessions', 'tv_training_results']) {
    try {
      const snap = await admin.firestore().collection(name).where('createdAt', '>', cutoff).limit(250).get();
      snap.docs.forEach((doc) => {
        const data = doc.data() || {};
        if (Array.isArray(data.topProblems)) issues.push(...data.topProblems);
        if (Array.isArray(data.weaknesses)) issues.push(...data.weaknesses);
        if (data.nextFocus) issues.push(data.nextFocus);
      });
    } catch {}
  }
  if (!issues.length) return { count: 0, patterns: [] };
  const parsed = await callClaudeJson(`최근 ONNODE ?�용??공통 문제:\n${issues.slice(0, 160).join('\n')}\nJSON { "commonPatterns": [{ "issue": "...", "solution": "...", "topic": "dance|vocal|korean", "tags": [] }] }`);
  const patterns = Array.isArray(parsed?.commonPatterns) ? parsed.commonPatterns : [];
  const rows = [];
  for (const [idx, p] of patterns.entries()) {
    const extracted = await extractTrainingKnowledge({
      transcript: `${p.issue}\n${p.solution}`,
      metadata: { source: 'user_pattern_analysis', title: p.issue },
      domain: p.topic || '',
    });
    extracted.forEach((row, rowIdx) => rows.push({
      ...row,
      id: `user_pattern_${Date.now()}_${idx}_${rowIdx}`,
      topic: row.domain,
      tags: p.tags || [row.skill].filter(Boolean),
      content: row.trainerCue || row.howToFix || row.drill || row.why,
      source: 'user_pattern_analysis',
      isActive: true,
    }));
  }
  const upsert = await upsertKnowledge(rows);
  return { count: rows.length, patterns, upsert };
}

async function stats(admin) {
  const snap = await admin.firestore().collection('trainer_knowledge_chunks').limit(1000).get();
  const byTopic = {};
  snap.docs.forEach((doc) => {
    const topic = doc.data()?.domain || doc.data()?.topic || 'unknown';
    byTopic[topic] = (byTopic[topic] || 0) + 1;
  });
  await admin.firestore().collection('system_stats').doc('knowledge').set({ totalEntries: snap.size, byTopic, lastUpdated: new Date() }, { merge: true });
  return { totalEntries: snap.size, byTopic };
}

module.exports = async function handler(req, res) {
  if (!okAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: error || 'Firebase Admin unavailable' });
  try {
    const results = await collectAndIndexTrainingKnowledge({
      queries: ['KPOP vocal training breath pitch lesson', 'KPOP dance training choreography details', 'KPOP idol audition training dance vocal', 'Korean pronunciation KPOP lyrics training'],
      maxResults: Number(process.env.TRAINER_KNOWLEDGE_DAILY_MAX_RESULTS || 3),
    });
    const deletedOld = await cleanup(admin);
    const userPatterns = await extractUserPatterns(admin);
    const knowledgeStats = await stats(admin);
    return res.status(200).json({ success: true, message: '지??베이???�데?�트 ?�료', totalSources: results.length, deletedOld, userPatterns, stats: knowledgeStats });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};

