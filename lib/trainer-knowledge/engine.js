const { getAdmin } = require(`${process.cwd()}/lib/api-lib/firebaseAdmin.js`);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX_URL = process.env.PINECONE_INDEX_URL || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TRAINER_PERSONAS = {
  liaKim: {
    id: 'liaKim',
    label: '리아킴 스타일',
    domains: ['dance'],
    evaluationCriteria: ['라인', '무게중심', '리듬 해석', '동작 연결', '표현 밀도'],
    tone: '차분하지만 날카롭게 핵심을 짚는 전문 트레이너 말투',
    feedbackStyle: '동작의 원인과 교정 드릴을 연결해서 설명',
    priorities: ['기본기', '디테일', '음악 해석', '반복 가능한 연습 루틴'],
  },
  kpopVocalMaster: {
    id: 'kpopVocalMaster',
    label: 'KPOP Vocal Master 스타일',
    domains: ['vocal'],
    evaluationCriteria: ['호흡 지지', '피치 안정', '공명', '발음', '감정 전달'],
    tone: '따뜻하지만 기술 용어를 정확히 쓰는 보컬 마스터 말투',
    feedbackStyle: '소리가 흔들리는 이유를 호흡/성대/공명으로 분해',
    priorities: ['호흡', '음정', '톤', '소절별 연습 과제'],
  },
  yg: {
    id: 'yg',
    label: 'YG 스타일',
    domains: ['dance', 'vocal', 'audition'],
    evaluationCriteria: ['스타성', '그루브', '카리스마', '개성', '무대 장악력'],
    tone: '직설적이고 에너지 있는 프로듀서형 말투',
    feedbackStyle: '잘 보이는 장점과 무대에서 죽는 지점을 강하게 대비',
    priorities: ['개성', '자신감', '그루브', '킬링 포인트'],
  },
  jyp: {
    id: 'jyp',
    label: 'JYP 스타일',
    domains: ['dance', 'vocal', 'audition'],
    evaluationCriteria: ['기본기', '박자', '라이브 안정성', '태도', '성실함'],
    tone: '정확하고 현실적인 심사위원형 말투',
    feedbackStyle: '점수보다 훈련 태도와 반복 가능한 교정법 강조',
    priorities: ['박자', '호흡', '정확도', '루틴'],
  },
  starship: {
    id: 'starship',
    label: 'Starship 스타일',
    domains: ['dance', 'vocal', 'audition'],
    evaluationCriteria: ['청량감', '팀 밸런스', '표정', '비주얼 임팩트', '안정성'],
    tone: '밝고 세밀하게 성장 포인트를 잡아주는 말투',
    feedbackStyle: '팀 안에서 돋보이는 방법과 안정적인 완성도를 함께 제시',
    priorities: ['표정', '팀워크', '안정감', '콘셉트 소화력'],
  },
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value, max = 12000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function chunkText(text, size = 1100, overlap = 160) {
  const clean = sanitizeText(text, 50000);
  if (!clean) return [];
  const chunks = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    chunks.push(clean.slice(start, start + size));
    if (start + size >= clean.length) break;
  }
  return chunks;
}

function makeKnowledgeId(sourceId, idx = 0) {
  return `${String(sourceId || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_')}_${idx}`;
}

function inferDomain(text = '') {
  const value = text.toLowerCase();
  if (/vocal|sing|voice|pitch|breath|보컬|노래|발성|호흡|음정/.test(value)) return 'vocal';
  if (/korean|pronunciation|발음|한국어|받침|억양/.test(value)) return 'korean';
  if (/audition|judge|심사|오디션/.test(value)) return 'audition';
  return 'dance';
}

function selectPersona(personaId, domain) {
  if (personaId && TRAINER_PERSONAS[personaId]) return TRAINER_PERSONAS[personaId];
  if (domain === 'vocal') return TRAINER_PERSONAS.kpopVocalMaster;
  if (domain === 'audition') return TRAINER_PERSONAS.jyp;
  if (domain === 'korean') return TRAINER_PERSONAS.starship;
  return TRAINER_PERSONAS.liaKim;
}

async function callOpenAIJson(prompt, { system = '', maxTokens = 900 } = {}) {
  if (!OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.25,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '';
  try { return JSON.parse(raw); } catch { return null; }
}

async function callClaudeJson(prompt, { system = '', maxTokens = 900 } = {}) {
  if (!ANTHROPIC_API_KEY) return null;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: system || undefined,
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

async function extractTrainingKnowledge({ transcript = '', metadata = {}, domain = '' }) {
  const resolvedDomain = domain || inferDomain(`${metadata.title || ''} ${transcript}`);
  const sourceText = sanitizeText(transcript || metadata.description || metadata.title || '', 12000);
  if (!sourceText) return [];
  const prompt = `K-POP ${resolvedDomain} 트레이닝 자료에서 실제 레슨에 쓸 지식만 추출하세요.
영상 메타데이터: ${JSON.stringify(metadata)}
전사/설명: ${sourceText}

JSON 형식:
{
  "knowledge": [
    {
      "title": "짧은 지식 제목",
      "domain": "dance|vocal|korean|audition",
      "skill": "예: 호흡, 무게중심, 박자, 발음",
      "why": "왜 문제가 생기는지",
      "howToFix": "어떻게 고치는지",
      "drill": "오늘 바로 할 연습",
      "mistakes": ["흔한 실수"],
      "trainerCue": "트레이너가 현장에서 하는 한 문장"
    }
  ]
}`;
  const parsed = await callOpenAIJson(prompt, {
    system: 'You are a K-POP trainer knowledge extraction engine. Return only JSON.',
    maxTokens: 1200,
  }) || await callClaudeJson(prompt, {
    system: 'You are a K-POP trainer knowledge extraction engine. Return only JSON.',
    maxTokens: 1200,
  });
  const rows = Array.isArray(parsed?.knowledge) ? parsed.knowledge : [];
  return rows.map((row) => ({
    title: sanitizeText(row.title, 160),
    domain: row.domain || resolvedDomain,
    skill: sanitizeText(row.skill, 80),
    why: sanitizeText(row.why, 700),
    howToFix: sanitizeText(row.howToFix, 700),
    drill: sanitizeText(row.drill, 700),
    mistakes: Array.isArray(row.mistakes) ? row.mistakes.map((v) => sanitizeText(v, 160)).slice(0, 6) : [],
    trainerCue: sanitizeText(row.trainerCue, 300),
    sourceMetadata: metadata,
    createdAt: nowIso(),
  })).filter((row) => row.title && (row.why || row.howToFix || row.drill));
}

async function embedText(text) {
  if (!OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: sanitizeText(text, 8000),
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}

function knowledgeToText(row) {
  return [
    row.title,
    `domain:${row.domain}`,
    `skill:${row.skill}`,
    `why:${row.why}`,
    `fix:${row.howToFix}`,
    `drill:${row.drill}`,
    `cue:${row.trainerCue}`,
    ...(row.mistakes || []).map((m) => `mistake:${m}`),
  ].filter(Boolean).join('\n');
}

async function getDb() {
  const { admin, error } = getAdmin();
  if (!admin) throw new Error(error || 'Firebase Admin 초기화 실패');
  return admin.firestore();
}

async function saveMetadata(metadata) {
  const db = await getDb();
  const id = metadata.videoId || metadata.id || `${Date.now()}`;
  await db.collection('trainer_knowledge_sources').doc(id).set({
    ...metadata,
    updatedAt: new Date(),
  }, { merge: true });
  return id;
}

async function saveKnowledgeFirestore(rows) {
  if (!rows.length) return [];
  const db = await getDb();
  const saved = [];
  for (const [idx, row] of rows.entries()) {
    const id = row.id || makeKnowledgeId(row.sourceMetadata?.videoId || row.sourceMetadata?.id, idx);
    const payload = { ...row, id, text: knowledgeToText(row), updatedAt: new Date() };
    await db.collection('trainer_knowledge_chunks').doc(id).set(payload, { merge: true });
    saved.push(payload);
  }
  return saved;
}

async function upsertPinecone(rows) {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_URL || !rows.length) return { skipped: true };
  const vectors = [];
  for (const row of rows) {
    const values = await embedText(row.text || knowledgeToText(row));
    if (!values) continue;
    vectors.push({
      id: row.id,
      values,
      metadata: {
        title: row.title,
        domain: row.domain,
        skill: row.skill,
        trainerCue: row.trainerCue,
        text: row.text || knowledgeToText(row),
        sourceUrl: row.sourceMetadata?.youtubeUrl || '',
      },
    });
  }
  if (!vectors.length) return { skipped: true, reason: 'no_embeddings' };
  const response = await fetch(`${PINECONE_INDEX_URL.replace(/\/+$/, '')}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
    },
    body: JSON.stringify({ vectors }),
  });
  if (!response.ok) return { skipped: false, error: await response.text() };
  return { skipped: false, count: vectors.length };
}

async function upsertSupabase(rows) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !rows.length) return { skipped: true };
  const payload = [];
  for (const row of rows) {
    payload.push({
      id: row.id,
      title: row.title,
      domain: row.domain,
      skill: row.skill,
      content: row.text || knowledgeToText(row),
      metadata: row,
      embedding: await embedText(row.text || knowledgeToText(row)),
    });
  }
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/trainer_knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return { skipped: false, error: await response.text() };
  return { skipped: false, count: payload.length };
}

async function upsertKnowledge(rows) {
  const saved = await saveKnowledgeFirestore(rows);
  const pinecone = await upsertPinecone(saved);
  const supabase = pinecone.skipped ? await upsertSupabase(saved) : { skipped: true, reason: 'pinecone_used' };
  return { savedCount: saved.length, pinecone, supabase };
}

function lexicalScore(query, row) {
  const terms = sanitizeText(query).toLowerCase().split(/\s+/).filter((v) => v.length > 1);
  const text = sanitizeText(row.text || knowledgeToText(row), 5000).toLowerCase();
  return terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
}

async function searchPinecone({ query, domain, topK = 5 }) {
  if (!PINECONE_API_KEY || !PINECONE_INDEX_URL) return [];
  const vector = await embedText(query);
  if (!vector) return [];
  const response = await fetch(`${PINECONE_INDEX_URL.replace(/\/+$/, '')}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': PINECONE_API_KEY,
    },
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true,
      filter: domain ? { domain: { $eq: domain } } : undefined,
    }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.matches || []).map((m) => ({
    id: m.id,
    score: m.score,
    title: m.metadata?.title,
    domain: m.metadata?.domain,
    skill: m.metadata?.skill,
    trainerCue: m.metadata?.trainerCue,
    text: m.metadata?.text,
    sourceUrl: m.metadata?.sourceUrl,
  }));
}

async function searchSupabase({ query, domain, topK = 5 }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];
  const embedding = await embedText(query);
  if (!embedding) return [];
  const response = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/match_trainer_knowledge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query_embedding: embedding, match_count: topK, filter_domain: domain || null }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data || []).map((row) => ({
    id: row.id,
    score: row.similarity,
    title: row.title,
    domain: row.domain,
    skill: row.skill,
    text: row.content,
    sourceUrl: row.metadata?.sourceMetadata?.youtubeUrl || '',
  }));
}

async function searchFirestore({ query, domain, topK = 5 }) {
  const db = await getDb();
  const snap = domain
    ? await db.collection('trainer_knowledge_chunks').where('domain', '==', domain).limit(80).get()
    : await db.collection('trainer_knowledge_chunks').limit(120).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .map((row) => ({ ...row, score: lexicalScore(query, row) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

async function searchKnowledge({ query, domain = '', personaId = '', topK = 5 }) {
  const resolvedDomain = domain || inferDomain(query);
  const expandedQuery = `${query}\npersona:${selectPersona(personaId, resolvedDomain).label}`;
  const pinecone = await searchPinecone({ query: expandedQuery, domain: resolvedDomain, topK });
  if (pinecone.length) return { results: pinecone, source: 'pinecone', domain: resolvedDomain };
  const supabase = await searchSupabase({ query: expandedQuery, domain: resolvedDomain, topK });
  if (supabase.length) return { results: supabase, source: 'supabase', domain: resolvedDomain };
  const firestore = await searchFirestore({ query: expandedQuery, domain: resolvedDomain, topK });
  return { results: firestore, source: 'firestore', domain: resolvedDomain };
}

async function collectYouTubeMetadata({ query, domain = '', maxResults = 8 }) {
  if (!YOUTUBE_API_KEY) return [];
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoDuration: 'medium',
    maxResults: String(Math.max(1, Math.min(25, Number(maxResults) || 8))),
    key: YOUTUBE_API_KEY,
  });
  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
  const searchData = await searchRes.json();
  if (!searchRes.ok) throw new Error(searchData.error?.message || 'YouTube search failed');
  const ids = (searchData.items || []).map((it) => it.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const videosParams = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    id: ids.join(','),
    key: YOUTUBE_API_KEY,
  });
  const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`);
  const videosData = await videosRes.json();
  if (!videosRes.ok) throw new Error(videosData.error?.message || 'YouTube videos failed');
  const captionMap = {};
  for (const id of ids) {
    try {
      const captionParams = new URLSearchParams({
        part: 'snippet',
        videoId: id,
        key: YOUTUBE_API_KEY,
      });
      const captionRes = await fetch(`https://www.googleapis.com/youtube/v3/captions?${captionParams.toString()}`);
      const captionData = await captionRes.json().catch(() => ({}));
      captionMap[id] = {
        hasCaptions: captionRes.ok && Array.isArray(captionData.items) && captionData.items.length > 0,
        captionLanguages: (captionData.items || []).map((caption) => caption.snippet?.language).filter(Boolean),
      };
    } catch {
      captionMap[id] = { hasCaptions: false, captionLanguages: [] };
    }
  }
  return (videosData.items || []).map((item) => ({
    id: item.id,
    videoId: item.id,
    domain: domain || inferDomain(`${item.snippet?.title || ''} ${query}`),
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    channelTitle: item.snippet?.channelTitle || '',
    publishedAt: item.snippet?.publishedAt || '',
    duration: item.contentDetails?.duration || '',
    viewCount: Number(item.statistics?.viewCount || 0),
    likeCount: Number(item.statistics?.likeCount || 0),
    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
    youtubeUrl: `https://youtube.com/watch?v=${item.id}`,
    hasCaptions: captionMap[item.id]?.hasCaptions || false,
    captionLanguages: captionMap[item.id]?.captionLanguages || [],
    collectedAt: nowIso(),
    sourcePolicy: 'youtube_data_api_metadata_only',
  }));
}

async function transcribeAudioBlob(blob, filename = 'training-audio.mp3') {
  if (!blob || !OPENAI_API_KEY) return '';
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model', 'whisper-1');
  form.append('language', 'ko');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Whisper transcription failed: ${await response.text()}`);
  const data = await response.json();
  return data.text || '';
}

async function transcribeAudioFromUrl(audioUrl) {
  if (!audioUrl || !OPENAI_API_KEY) return '';
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error('audioUrl 다운로드 실패');
  const blob = await audioRes.blob();
  return transcribeAudioBlob(blob, 'training-audio.mp3');
}

async function collectAndIndexTrainingKnowledge({
  queries = ['KPOP vocal training', 'KPOP dance training', 'KPOP choreography tutorial'],
  maxResults = 5,
  transcriptByVideoId = {},
} = {}) {
  const all = [];
  for (const query of queries) {
    const domain = inferDomain(query);
    const rows = await collectYouTubeMetadata({ query, domain, maxResults });
    for (const metadata of rows) {
      await saveMetadata(metadata);
      let transcript = transcriptByVideoId[metadata.videoId] || '';
      if (!transcript) transcript = metadata.description || metadata.title;
      const knowledge = await extractTrainingKnowledge({ transcript, metadata, domain: metadata.domain });
      const indexed = knowledge.map((row, idx) => ({
        ...row,
        id: makeKnowledgeId(metadata.videoId, idx),
      }));
      const upsert = await upsertKnowledge(indexed);
      all.push({ metadata, knowledgeCount: indexed.length, upsert });
    }
  }
  return all;
}

function formatRagContext(results = []) {
  return results.slice(0, 5).map((r, i) => {
    const text = r.text || knowledgeToText(r);
    return `[${i + 1}] ${sanitizeText(r.title || r.skill || '트레이닝 지식', 100)}\n${sanitizeText(text, 900)}`;
  }).join('\n\n');
}

async function buildTrainerRagContext({ query, domain, personaId, topK = 5 }) {
  try {
    const search = await searchKnowledge({ query, domain, personaId, topK });
    const persona = selectPersona(personaId, search.domain);
    return {
      persona,
      domain: search.domain,
      source: search.source,
      results: search.results,
      contextText: formatRagContext(search.results),
    };
  } catch (err) {
    const resolvedDomain = domain || inferDomain(query);
    return {
      persona: selectPersona(personaId, resolvedDomain),
      domain: resolvedDomain,
      source: 'none',
      results: [],
      contextText: '',
      error: err.message || String(err),
    };
  }
}

function buildTrainerSystemPrompt({ persona, domain, contextText }) {
  return `당신은 ONNODE Trainer Knowledge Engine의 ${persona.label} AI 코치입니다.
도메인: ${domain}
평가 기준: ${persona.evaluationCriteria.join(', ')}
말투: ${persona.tone}
피드백 방식: ${persona.feedbackStyle}
우선순위: ${persona.priorities.join(', ')}

아래 Trainer Knowledge Base 검색 결과를 근거로 답변하세요.
검색 결과가 부족하면 일반론으로 단정하지 말고, 현재 지표에서 확실한 부분만 말하세요.

답변은 실제 트레이너 레슨 형식이어야 합니다:
1) 왜 틀렸는지
2) 어떻게 고쳐야 하는지
3) 오늘 무엇을 연습해야 하는지
4) 바로 따라 할 수 있는 한 문장 큐

Trainer Knowledge Base:
${contextText || '(검색된 지식 없음)'}`;
}

module.exports = {
  TRAINER_PERSONAS,
  selectPersona,
  inferDomain,
  collectYouTubeMetadata,
  transcribeAudioFromUrl,
  extractTrainingKnowledge,
  upsertKnowledge,
  searchKnowledge,
  collectAndIndexTrainingKnowledge,
  buildTrainerRagContext,
  buildTrainerSystemPrompt,
};
