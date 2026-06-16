const { extractTrainingKnowledge, upsertKnowledge } = require('../../lib/trainer-knowledge/engine');

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const body = await readJsonBody(req);
    const text = body.transcript || body.text || body.content || '';
    if (!text) return res.status(400).json({ error: 'text 또는 transcript가 필요합니다.' });

    const knowledge = await extractTrainingKnowledge({
      transcript: text,
      metadata: {
        source: body.source || 'manual_trainer_knowledge',
        title: body.title || '전문 트레이너 지식',
        ...body.metadata,
      },
      domain: body.topic || body.domain || '',
    });

    const rows = knowledge.map((row, idx) => ({
      ...row,
      id: body.idPrefix ? `${body.idPrefix}_${idx}` : row.id,
      topic: row.domain,
      tags: [row.skill, ...(row.mistakes || [])].filter(Boolean).slice(0, 8),
      content: row.trainerCue || row.howToFix || row.drill || row.why,
      source: body.source || 'manual_trainer_knowledge',
      isActive: true,
    }));

    const upsert = await upsertKnowledge(rows);
    return res.status(200).json({ ok: true, knowledge: rows, upsert });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
};
