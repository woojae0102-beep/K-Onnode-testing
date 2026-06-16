const {
  TRAINER_PERSONAS,
  collectYouTubeMetadata,
  transcribeAudioFromUrl,
  extractTrainingKnowledge,
  upsertKnowledge,
  searchKnowledge,
  collectAndIndexTrainingKnowledge,
  buildTrainerRagContext,
} = require('../lib/trainer-knowledge/engine');

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function getAction(req, body) {
  if (body?.action) return String(body.action);
  const url = new URL(req.url || '/', 'http://localhost');
  return (url.searchParams.get('path') || '').split('/').filter(Boolean)[0] || 'status';
}

function json(res, code, body) {
  return res.status(code).json(body);
}

async function handleCollectMetadata(body) {
  const rows = await collectYouTubeMetadata({
    query: body.query || 'KPOP vocal training',
    domain: body.domain || '',
    maxResults: body.maxResults || 8,
  });
  return { ok: true, items: rows };
}

async function handleProcessTranscript(body) {
  const transcript = body.audioUrl
    ? await transcribeAudioFromUrl(body.audioUrl)
    : body.transcript || body.text || '';
  const knowledge = await extractTrainingKnowledge({
    transcript,
    metadata: body.metadata || {},
    domain: body.domain || '',
  });
  const rows = knowledge.map((row, idx) => ({
    ...row,
    id: body.idPrefix ? `${body.idPrefix}_${idx}` : row.id,
  }));
  const upsert = body.skipUpsert ? null : await upsertKnowledge(rows);
  return { ok: true, transcript, knowledge: rows, upsert };
}

async function handleSearch(body) {
  const result = await searchKnowledge({
    query: body.query || '',
    domain: body.domain || '',
    personaId: body.personaId || '',
    topK: body.topK || 5,
  });
  return { ok: true, ...result };
}

async function handleCollectDaily(body) {
  const queries = body.queries || [
    'KPOP vocal training breath pitch lesson',
    'KPOP dance training choreography details',
    'KPOP idol audition vocal dance training',
    'Korean pronunciation KPOP lyrics training',
  ];
  const results = await collectAndIndexTrainingKnowledge({
    queries,
    maxResults: body.maxResults || 4,
    transcriptByVideoId: body.transcriptByVideoId || {},
  });
  return {
    ok: true,
    totalSources: results.length,
    totalKnowledge: results.reduce((sum, row) => sum + (row.knowledgeCount || 0), 0),
    results,
  };
}

async function handleFetchYouTubeCaptions(body) {
  const queries = body.queries || [
    'K-POP 댄스 트레이닝 팁',
    'K-POP 보컬 레슨 발성법',
    'K-POP dance tutorial technique',
    'K-POP vocal training method',
    '아이돌 댄스 교정 방법',
    '보컬 트레이닝 호흡법',
    'K-POP choreography tips',
    '연습생 댄스 훈련법',
  ];
  const results = await collectAndIndexTrainingKnowledge({
    queries,
    maxResults: body.maxResults || Number(process.env.TRAINER_KNOWLEDGE_DAILY_MAX_RESULTS || 3),
    transcriptByVideoId: body.transcriptByVideoId || {},
  });
  return {
    ok: true,
    message: `${results.reduce((sum, row) => sum + (row.knowledgeCount || 0), 0)}개 지식 추가 완료`,
    totalSources: results.length,
    totalKnowledge: results.reduce((sum, row) => sum + (row.knowledgeCount || 0), 0),
    results,
  };
}

async function handleBuildKnowledge(body) {
  const text = body.transcript || body.text || body.content || '';
  if (!text) throw new Error('text 또는 transcript가 필요합니다.');
  const knowledge = await extractTrainingKnowledge({
    transcript: text,
    metadata: { source: body.source || 'manual_trainer_knowledge', title: body.title || '전문 트레이너 지식', ...(body.metadata || {}) },
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
  return { ok: true, knowledge: rows, upsert };
}

async function handleCoachContext(body) {
  const context = await buildTrainerRagContext({
    query: body.query || JSON.stringify(body.practiceResult || body.session || {}),
    domain: body.domain || '',
    personaId: body.personaId || '',
    topK: body.topK || 5,
  });
  return { ok: true, context };
}

module.exports = async function handler(req, res) {
  try {
    const body = await readJsonBody(req);
    const action = getAction(req, body);
    if (action === 'status') return json(res, 200, { ok: true, personas: TRAINER_PERSONAS });
    if (action === 'collect-metadata') return json(res, 200, await handleCollectMetadata(body));
    if (action === 'process-transcript') return json(res, 200, await handleProcessTranscript(body));
    if (action === 'search') return json(res, 200, await handleSearch(body));
    if (action === 'collect-daily') return json(res, 200, await handleCollectDaily(body));
    if (action === 'fetch-youtube-captions') return json(res, 200, await handleFetchYouTubeCaptions(body));
    if (action === 'build-knowledge') return json(res, 200, await handleBuildKnowledge(body));
    if (action === 'update-knowledge') return json(res, 200, await handleFetchYouTubeCaptions(body));
    if (action === 'coach-context') return json(res, 200, await handleCoachContext(body));
    return json(res, 404, { error: 'Unknown knowledge action', action });
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) });
  }
};
