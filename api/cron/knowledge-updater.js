const { getAdmin } = require('../_lib/firebaseAdmin');
const updateKnowledge = require('../knowledge/update-knowledge');
const { extractTrainingKnowledge, upsertKnowledge } = require('../../lib/trainer-knowledge/engine');

function assertCronAuth(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  return authHeader === `Bearer ${cronSecret}`;
}

function createMemoryRes() {
  const holder = { statusCode: 200, body: null };
  return {
    status(code) {
      holder.statusCode = code;
      return this;
    },
    json(body) {
      holder.body = body;
      return holder;
    },
    _holder: holder,
  };
}

async function callClaudeJson(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
  if (!response.ok) return null;
  const data = await response.json();
  const raw = String(data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

async function cleanupOldKnowledge(admin) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const oldDocs = await admin.firestore()
    .collection('trainer_knowledge_chunks')
    .where('updatedAt', '<', cutoffDate)
    .limit(100)
    .get();

  if (oldDocs.empty) return 0;
  const batch = admin.firestore().batch();
  oldDocs.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return oldDocs.size;
}

async function extractCommonIssuesFromUserData(admin) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const collections = ['practice_sessions', 'training_sessions', 'tv_training_results'];
  const allIssues = [];

  for (const name of collections) {
    try {
      const snap = await admin.firestore()
        .collection(name)
        .where('createdAt', '>', cutoff)
        .limit(250)
        .get();
      snap.docs.forEach((doc) => {
        const data = doc.data() || {};
        if (Array.isArray(data.topProblems)) allIssues.push(...data.topProblems);
        if (Array.isArray(data.weaknesses)) allIssues.push(...data.weaknesses);
        if (data.nextFocus) allIssues.push(data.nextFocus);
        if (data.feedback?.length) {
          data.feedback.slice(-3).forEach((item) => {
            if (typeof item === 'string') allIssues.push(item);
            else if (item?.message) allIssues.push(item.message);
          });
        }
      });
    } catch {
      // Some deployments may not have every collection yet.
    }
  }

  if (!allIssues.length) return { count: 0, patterns: [] };

  const parsed = await callClaudeJson(`ONNODE 사용자들이 최근 7일간 가장 많이 겪은 문제들:
${allIssues.slice(0, 160).join('\n')}

이 데이터를 분석해서 가장 흔한 패턴 TOP 5와 각각에 대한 효과적인 트레이닝 방법을 JSON으로 반환하세요:
{
  "commonPatterns": [
    {
      "issue": "문제",
      "frequency": "빈도",
      "solution": "해결 방법 (구체적으로 3~4문장)",
      "topic": "dance 또는 vocal 또는 korean",
      "tags": ["태그들"]
    }
  ]
}`);

  const patterns = Array.isArray(parsed?.commonPatterns) ? parsed.commonPatterns : [];
  if (!patterns.length) return { count: 0, patterns: [] };

  const rows = [];
  for (const [idx, pattern] of patterns.entries()) {
    const extracted = await extractTrainingKnowledge({
      transcript: `${pattern.issue}\n${pattern.solution}`,
      metadata: {
        source: 'user_pattern_analysis',
        title: pattern.issue,
        frequency: pattern.frequency,
      },
      domain: pattern.topic || '',
    });
    extracted.forEach((row, rowIdx) => {
      rows.push({
        ...row,
        id: `user_pattern_${Date.now()}_${idx}_${rowIdx}`,
        topic: row.domain,
        tags: pattern.tags || [row.skill].filter(Boolean),
        content: row.trainerCue || row.howToFix || row.drill || row.why,
        source: 'user_pattern_analysis',
        isActive: true,
      });
    });
  }

  const upsert = await upsertKnowledge(rows);
  return { count: rows.length, patterns, upsert };
}

async function updateKnowledgeStats(admin) {
  const snap = await admin.firestore().collection('trainer_knowledge_chunks').limit(1000).get();
  const byTopic = {};
  snap.docs.forEach((doc) => {
    const topic = doc.data()?.domain || doc.data()?.topic || 'unknown';
    byTopic[topic] = (byTopic[topic] || 0) + 1;
  });
  await admin.firestore().collection('system_stats').doc('knowledge').set({
    totalEntries: snap.size,
    byTopic,
    lastUpdated: new Date(),
  }, { merge: true });
  return { totalEntries: snap.size, byTopic };
}

module.exports = async function handler(req, res) {
  if (!assertCronAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { admin, error } = getAdmin();
  if (!admin) return res.status(500).json({ error: error || 'Firebase Admin 초기화 실패' });

  try {
    const updateReq = {
      ...req,
      method: 'POST',
      body: {
        maxResults: Number(process.env.TRAINER_KNOWLEDGE_DAILY_MAX_RESULTS || 3),
      },
    };
    const updateRes = createMemoryRes();
    await updateKnowledge(updateReq, updateRes);

    const deletedOld = await cleanupOldKnowledge(admin);
    const userPatterns = await extractCommonIssuesFromUserData(admin);
    const stats = await updateKnowledgeStats(admin);

    return res.status(200).json({
      success: true,
      message: '지식 베이스 업데이트 완료',
      youtube: updateRes._holder.body,
      deletedOld,
      userPatterns,
      stats,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};
